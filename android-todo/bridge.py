#!/usr/bin/env python3
"""
Seantinel CLAUDE-tile bridge. Runs inside Termux, serves on 127.0.0.1:8787.

GET /sessions
  -> [{sid, tab, label, cwd, pid, age}] for each screen window whose shell
     has a `node claude` child.

GET /hardcopy?sid=<sid>&tab=<tab>
  -> {text} — latest screen hardcopy for that window.

POST /record/start
  -> {ok} — starts termux-microphone-record to ~/tmp/speak.m4a.

POST /record/stop?sid=<sid>&tab=<tab>
  -> {text, stuffed} — stops recording, transcodes to WAV, runs whisper.cpp,
     stuffs transcript + Enter into screen window.

Start:  python3 bridge.py
"""
import http.server, json, os, re, subprocess, time, urllib.parse
from pathlib import Path

PORT = 8787
HOME = os.path.expanduser("~")
SCREEN_DIR = Path(HOME) / ".screen"


def _run(cmd, timeout=3):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout).stdout
    except Exception:
        return ""


def _all_shells_by_session():
    """{screen_pid: [shell_pid, ...]} — shells parented to each screen master."""
    out = _run(["ps", "-e", "-o", "pid=,ppid=,comm="])
    shells = {}
    for ln in out.splitlines():
        parts = ln.split(None, 2)
        if len(parts) < 3:
            continue
        pid, ppid, comm = int(parts[0]), int(parts[1]), parts[2].strip()
        if comm == "bash" or comm.endswith("/bash"):
            shells.setdefault(ppid, []).append(pid)
    for k in shells:
        shells[k].sort()
    return shells


def _children(pid):
    out = _run(["ps", "-e", "-o", "pid=,ppid=,comm=,args="])
    kids = []
    for ln in out.splitlines():
        parts = ln.split(None, 3)
        if len(parts) < 4:
            continue
        p, pp, comm, args = int(parts[0]), int(parts[1]), parts[2], parts[3]
        if pp == pid:
            kids.append((p, comm, args))
    return kids


def _claude_pid_for_shell(shell_pid):
    for p, comm, args in _children(shell_pid):
        if "claude" in args and "node" in comm:
            return p
    return None


def _cwd_of(pid):
    try:
        cwd = os.readlink(f"/proc/{pid}/cwd")
        return cwd.replace(HOME, "~", 1)
    except OSError:
        return "?"


def _screen_sockets():
    """[(screen_pid, name, mtime)] from ~/.screen."""
    out = []
    if not SCREEN_DIR.exists():
        return out
    for p in SCREEN_DIR.iterdir():
        m = re.match(r"(\d+)\.(.+)", p.name)
        if not m:
            continue
        out.append((int(m.group(1)), m.group(2), p.stat().st_mtime))
    return out


def _fmt_age(sec):
    sec = max(0, int(sec))
    if sec < 60:   return f"{sec}s"
    if sec < 3600: return f"{sec//60}m"
    if sec < 86400:return f"{sec//3600}h"
    return f"{sec//86400}d"


def list_sessions():
    """Only tabs with claude running. Tab index = PID order (heuristic)."""
    shells_by_session = _all_shells_by_session()
    now = time.time()
    rows = []
    for spid, name, mtime in _screen_sockets():
        shells = shells_by_session.get(spid, [])
        for idx, sh in enumerate(shells):
            cpid = _claude_pid_for_shell(sh)
            if cpid is None:
                continue
            tab = f"Tab{idx+1}"
            rows.append({
                "sid": name,
                "tab": tab,
                "label": f"{name} / {tab}",
                "cwd": _cwd_of(cpid),
                "pid": cpid,
                "age": _fmt_age(now - mtime),
            })
    return rows


def hardcopy(sid, tab):
    """Snapshot current screen of (sid, tab). tab = 'TabN' -> window N-1."""
    m = re.match(r"Tab(\d+)", tab)
    if not m:
        return ""
    win = int(m.group(1)) - 1
    tmp = f"/tmp/hc_{sid}_{win}_{os.getpid()}.txt"
    # Fall back to $HOME/tmp if /tmp not writable.
    if not os.access("/tmp", os.W_OK):
        os.makedirs(f"{HOME}/tmp", exist_ok=True)
        tmp = f"{HOME}/tmp/hc_{sid}_{win}_{os.getpid()}.txt"
    _run(["screen", "-S", sid, "-p", str(win), "-X", "hardcopy", tmp])
    try:
        with open(tmp) as f:
            txt = f.read()
    except OSError:
        txt = ""
    finally:
        try: os.remove(tmp)
        except OSError: pass
    # Strip trailing blank lines so the view doesn't float up.
    return "\n".join(txt.rstrip().splitlines())


WHISPER_CLI = os.path.expanduser("~/whisper.cpp/build/bin/whisper-cli")
WHISPER_MODEL = os.path.expanduser("~/whisper.cpp/models/ggml-base.bin")
REC_M4A = os.path.expanduser("~/tmp/speak.m4a")
REC_WAV = os.path.expanduser("~/tmp/speak.wav")


def record_start():
    os.makedirs(os.path.dirname(REC_M4A), exist_ok=True)
    _run(["termux-microphone-record", "-q"], timeout=3)  # drop any prior
    try: os.remove(REC_M4A)
    except OSError: pass
    _run(["termux-microphone-record", "-f", REC_M4A, "-l", "0"], timeout=5)
    # Wait up to 2s for the mic to actually be active, so clicks < 500ms don't race it.
    for _ in range(20):
        info = _run(["termux-microphone-record", "-i"], timeout=1)
        if '"isRecording": true' in info:
            return
        time.sleep(0.1)


MIC_LOG = os.path.expanduser("~/tmp/bridge-mic.log")
APK_M4A = os.path.expanduser("~/tmp/speak_apk.m4a")


def _max_db(wav_path):
    """Return peak dBFS as float, or None on failure."""
    try:
        r = subprocess.run(
            ["ffmpeg", "-i", wav_path, "-af", "volumedetect", "-f", "null", "-"],
            capture_output=True, text=True, timeout=10,
        )
        m = re.search(r"max_volume:\s*(-?[\d.]+)\s*dB", r.stderr)
        return float(m.group(1)) if m else None
    except Exception:
        return None


def _transcribe_m4a(m4a_path, tag):
    """Shared: m4a -> wav -> whisper -> {text, bytes, max_db}, plus log."""
    info = {"text": "", "bytes": 0, "max_db": None}
    if not os.path.exists(m4a_path):
        return info
    info["bytes"] = os.path.getsize(m4a_path)
    wav = m4a_path.rsplit(".", 1)[0] + ".wav"
    try: os.remove(wav)
    except OSError: pass
    r = subprocess.run(
        ["ffmpeg", "-y", "-i", m4a_path, "-ar", "16000", "-ac", "1", wav],
        capture_output=True, text=True, timeout=30,
    )
    if r.returncode != 0 or not os.path.exists(wav):
        return info
    info["max_db"] = _max_db(wav)
    r = subprocess.run(
        [WHISPER_CLI, "-m", WHISPER_MODEL, "-f", wav,
         "-l", "en", "-nt", "--no-prints"],
        capture_output=True, text=True, timeout=120,
    )
    text = r.stdout.strip()
    if re.fullmatch(r"[\[\(][^\]\)]+[\]\)]", text or ""):
        text = ""
    info["text"] = text
    try:
        os.makedirs(os.path.dirname(MIC_LOG), exist_ok=True)
        with open(MIC_LOG, "a") as f:
            f.write(
                f"{time.strftime('%Y-%m-%d %H:%M:%S')}  src={tag}  "
                f"bytes={info['bytes']}  max_db={info['max_db']}  "
                f"text={text!r}\n"
            )
    except OSError:
        pass
    return info


def record_stop_and_transcribe():
    """Shell/bridge-mic path (termux-microphone-record)."""
    _run(["termux-microphone-record", "-q"], timeout=5)
    return _transcribe_m4a(REC_M4A, "shell")


def transcribe_apk_upload(body_bytes):
    """APK-native MediaRecorder path: bytes come in via HTTP POST body."""
    os.makedirs(os.path.dirname(APK_M4A), exist_ok=True)
    with open(APK_M4A, "wb") as f:
        f.write(body_bytes)
    return _transcribe_m4a(APK_M4A, "apk")


def stuff_into_tab(sid, tab, text):
    m = re.match(r"Tab(\d+)", tab)
    if not m: return False
    win = str(int(m.group(1)) - 1)
    # Strip control chars except tab. Append CR to submit.
    clean = "".join(c for c in text if c == "\t" or ord(c) >= 0x20)
    if not clean: return False
    # Send text, pause, then Enter — some TUIs ignore CR that arrives in the
    # same buffer chunk as a long paste.
    _run(["screen", "-S", sid, "-p", win, "-X", "stuff", clean])
    time.sleep(0.15)
    _run(["screen", "-S", sid, "-p", win, "-X", "stuff", "\r"])
    return True


class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code); self._cors()
        self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = dict(urllib.parse.parse_qsl(u.query))
        if u.path == "/sessions":
            return self._json(list_sessions())
        if u.path == "/hardcopy":
            return self._json({"text": hardcopy(q.get("sid",""), q.get("tab",""))})
        self.send_response(404); self._cors(); self.end_headers()

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        q = dict(urllib.parse.parse_qsl(u.query))
        if u.path == "/record/start":
            record_start()
            return self._json({"ok": True})
        if u.path == "/record/stop":
            sid, tab = q.get("sid",""), q.get("tab","")
            info = record_stop_and_transcribe()
            stuffed = stuff_into_tab(sid, tab, info["text"]) if info["text"] else False
            return self._json({
                "text": info["text"],
                "stuffed": stuffed,
                "bytes": info["bytes"],
                "max_db": info["max_db"],
            })
        if u.path == "/transcribe":
            sid, tab = q.get("sid",""), q.get("tab","")
            n = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(n) if n > 0 else b""
            info = transcribe_apk_upload(body)
            stuffed = stuff_into_tab(sid, tab, info["text"]) if info["text"] else False
            return self._json({
                "text": info["text"],
                "stuffed": stuffed,
                "bytes": info["bytes"],
                "max_db": info["max_db"],
            })
        self.send_response(404); self._cors(); self.end_headers()

    def log_message(self, *a, **kw):
        pass


if __name__ == "__main__":
    print(f"bridge listening on 127.0.0.1:{PORT}")
    # Threaded: whisper runs ~2-3s per /transcribe; single-threaded server
    # would block /hardcopy polls and queue up next SPEAK fetches.
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
