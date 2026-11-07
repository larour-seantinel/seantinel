(() => {
'use strict';

// ---------- state ----------
const S = {
  cfg: loadCfg(),
  sha: null,           // github blob sha for optimistic concurrency
  raw: '',             // current TODO.md text (truth)
  doc: null,           // parsed { preamble, sections: [{name, prose, items:[{text}]}] }
  selected: null,      // {sectionIdx, itemIdx}
  undo: [],            // stack of previous raw strings
  pushTimer: null,
};

function loadCfg() {
  try {
    return Object.assign(
      { pat:'', owner:'larour-seantinel', repo:'seantinel', branch:'master', path:'TODO.md' },
      JSON.parse(localStorage.getItem('cfg') || '{}')
    );
  } catch { return { pat:'', owner:'larour-seantinel', repo:'seantinel', branch:'master', path:'TODO.md' }; }
}
function saveCfg(c) { S.cfg = c; localStorage.setItem('cfg', JSON.stringify(c)); }

// ---------- nav ----------
const TTY_COLS = 38; // must match stty cols in bridge.py new_session / addtab
const fitTranscriptFont = () => {
  const t = document.getElementById('claude-transcript');
  if (!t) return;
  // Measure actual monospace char width with a probe at a known font-size,
  // then scale font-size so TTY_COLS chars + horizontal padding fit innerWidth.
  const probe = document.createElement('span');
  probe.style.cssText =
    'font-family:"Menlo","Courier New",monospace;' +
    'position:absolute;visibility:hidden;white-space:pre;' +
    'font-size:20px;left:-9999px;top:0';
  probe.textContent = 'X'.repeat(TTY_COLS);
  document.body.appendChild(probe);
  const widthAt20 = probe.getBoundingClientRect().width;
  probe.remove();
  if (widthAt20 <= 0) return;
  const cs = getComputedStyle(t);
  const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 2; // +2 safety
  const target = Math.max(0, window.innerWidth - pad);
  const px = Math.max(9, Math.min(36, target * 20 / widthAt20));
  t.style.fontSize = px.toFixed(2) + 'px';
};
const show = id => {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  document.body.classList.toggle('in-claude-session', id === 'claude-session');
  if (id === 'claude-session') fitTranscriptFont();
  window.scrollTo(0, 0);
};
window.addEventListener('resize', fitTranscriptFont);
document.querySelectorAll('[data-tile]').forEach(b => b.addEventListener('click', () => {
  const t = b.dataset.tile;
  if (t === 'todo') { show('todo'); loadTodo(); }
  else if (t === 'claude') { show('claude'); loadClaudeSessions(); }
  else setStatus(t.toUpperCase() + ': not wired yet.');
}));
document.getElementById('back').addEventListener('click', () => show('home'));
document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
  stopTranscriptPoll();
  show(b.dataset.nav);
}));

// ---------- github ----------
function ghHeaders() {
  const h = { 'Accept': 'application/vnd.github+json' };
  if (S.cfg.pat) h['Authorization'] = 'Bearer ' + S.cfg.pat;
  return h;
}
function ghUrl() {
  const { owner, repo, path, branch } = S.cfg;
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
}

async function ghRead() {
  const r = await fetch(ghUrl(), { headers: ghHeaders() });
  if (!r.ok) throw new Error(`GET ${r.status}: ${await r.text()}`);
  const j = await r.json();
  S.sha = j.sha;
  // j.content is base64 with embedded newlines
  return b64decode(j.content.replace(/\n/g, ''));
}

async function ghWrite(text, msg) {
  if (!S.cfg.pat) throw new Error('No PAT. Open settings.');
  const body = {
    message: msg || `Update ${S.cfg.path} via Seantinel TO-DO`,
    content: b64encode(text),
    sha: S.sha,
    branch: S.cfg.branch,
  };
  const r = await fetch(`https://api.github.com/repos/${S.cfg.owner}/${S.cfg.repo}/contents/${S.cfg.path}`, {
    method: 'PUT',
    headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders()),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PUT ${r.status}: ${await r.text()}`);
  const j = await r.json();
  S.sha = j.content.sha;
}

function b64encode(s) {
  // UTF-8 safe
  return btoa(unescape(encodeURIComponent(s)));
}
function b64decode(s) {
  return decodeURIComponent(escape(atob(s)));
}

// ---------- markdown ----------
// Parse: everything before first "## " is preamble.
// Each "## name" starts a section. Section body: non-bullet lines → prose,
// lines starting with "- " → items.
function parseMd(src) {
  const lines = src.split('\n');
  const sections = [];
  let preamble = '';
  let cur = null;
  const flushCur = () => { if (cur) sections.push(cur); };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushCur();
      cur = { name: line.slice(3).trim(), prose: '', items: [] };
      continue;
    }
    if (!cur) { preamble += line + '\n'; continue; }
    if (line.startsWith('- ')) {
      cur.items.push({ text: line.slice(2) });
    } else {
      cur.prose += line + '\n';
    }
  }
  flushCur();
  return { preamble, sections };
}

function serializeMd(doc) {
  let out = doc.preamble.replace(/\n+$/, '\n');
  for (const sec of doc.sections) {
    out += '\n## ' + sec.name + '\n';
    const prose = sec.prose.replace(/^\n+|\n+$/g, '');
    const hasItems = sec.items.length > 0;
    const proseIsPlaceholder = /^\(none\)\s*$/.test(prose);
    if (prose && !(hasItems && proseIsPlaceholder)) {
      out += '\n' + prose + '\n';
    }
    if (hasItems) {
      out += '\n';
      for (const it of sec.items) out += '- ' + it.text + '\n';
    }
  }
  return out.replace(/\n+$/, '\n');
}

// ---------- render ----------
function flatItems() {
  const flat = [];
  S.doc.sections.forEach((sec, si) => {
    sec.items.forEach((it, ii) => flat.push({ sectionIdx: si, itemIdx: ii, text: it.text, sectionName: sec.name }));
  });
  return flat;
}

function render() {
  const list = document.getElementById('list');
  list.innerHTML = '';
  if (!S.doc) return;
  const flat = flatItems();
  document.getElementById('count').textContent = flat.length + ' items';

  let lastSection = null;
  let n = 0;
  flat.forEach(entry => {
    if (entry.sectionName !== lastSection) {
      const sep = document.createElement('div');
      sep.className = 'section-sep';
      sep.textContent = entry.sectionName;
      list.appendChild(sep);
      lastSection = entry.sectionName;
    }
    n += 1;
    const div = document.createElement('div');
    div.className = 'item';
    if (S.selected && S.selected.sectionIdx === entry.sectionIdx && S.selected.itemIdx === entry.itemIdx) {
      div.classList.add('sel');
    }
    const num = document.createElement('span'); num.className = 'num'; num.textContent = n;
    const txt = document.createElement('span'); txt.className = 'txt'; txt.textContent = entry.text;
    div.appendChild(num); div.appendChild(txt);
    div.addEventListener('click', () => {
      S.selected = { sectionIdx: entry.sectionIdx, itemIdx: entry.itemIdx };
      render();
    });
    list.appendChild(div);
  });
}

// ---------- mutations ----------
function snapshot() {
  S.undo.push(S.raw);
  if (S.undo.length > 20) S.undo.shift();
}
function commitLocal() {
  S.raw = serializeMd(S.doc);
  schedulePush();
}
function schedulePush() {
  clearTimeout(S.pushTimer);
  setStatus('dirty — pushing in 1.5s…');
  S.pushTimer = setTimeout(async () => {
    try {
      setStatus('pushing…');
      await ghWrite(S.raw);
      setStatus('saved to GitHub.');
    } catch (e) {
      setStatus('push failed: ' + e.message);
    }
  }, 1500);
}

function selectedItem() {
  if (!S.selected) return null;
  const sec = S.doc.sections[S.selected.sectionIdx];
  if (!sec) return null;
  return { sec, idx: S.selected.itemIdx };
}

function moveSelected(delta) {
  const sel = selectedItem(); if (!sel) return;
  const { sec, idx } = sel;
  const j = idx + delta;
  if (j < 0 || j >= sec.items.length) return;
  snapshot();
  const [it] = sec.items.splice(idx, 1);
  sec.items.splice(j, 0, it);
  S.selected.itemIdx = j;
  commitLocal(); render();
}
function moveTop() {
  const sel = selectedItem(); if (!sel) return;
  const { sec, idx } = sel;
  if (idx === 0) return;
  snapshot();
  const [it] = sec.items.splice(idx, 1);
  sec.items.unshift(it);
  S.selected.itemIdx = 0;
  commitLocal(); render();
}
function del() {
  const sel = selectedItem(); if (!sel) return;
  snapshot();
  sel.sec.items.splice(sel.idx, 1);
  S.selected = null;
  commitLocal(); render();
}
function arch() {
  // v1: same as delete. DONE.md append is a Phase 2 task.
  del();
}
function undo() {
  const prev = S.undo.pop(); if (!prev) return;
  S.raw = prev;
  S.doc = parseMd(S.raw);
  S.selected = null;
  schedulePush();
  render();
}
function add() {
  const modal = document.getElementById('add-modal');
  const input = document.getElementById('add-input');
  input.value = '';
  modal.classList.remove('hidden');
  setTimeout(() => input.focus(), 50);
}
function addCommit() {
  const input = document.getElementById('add-input');
  const text = input.value.trim();
  document.getElementById('add-modal').classList.add('hidden');
  if (!text) return;
  snapshot();
  const target = S.doc.sections.find(s => s.items.length > 0) || S.doc.sections[0];
  if (!target) { setStatus('No section in TODO.md to add to.'); return; }
  target.items.unshift({ text });
  const si = S.doc.sections.indexOf(target);
  S.selected = { sectionIdx: si, itemIdx: 0 };
  commitLocal(); render();
}
function addCancel() { document.getElementById('add-modal').classList.add('hidden'); }
function ask() {
  alert('ASK CLAUDE: not wired yet. v2.');
}

document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
  const act = b.dataset.act;
  ({ up:()=>moveSelected(-1), down:()=>moveSelected(1), top:moveTop,
     delete:del, arch, undo, add, ask })[act]();
}));

// ---------- settings ----------
const modal = document.getElementById('settings-modal');
document.getElementById('settings').addEventListener('click', () => {
  document.getElementById('pat').value    = S.cfg.pat;
  document.getElementById('owner').value  = S.cfg.owner;
  document.getElementById('repo').value   = S.cfg.repo;
  document.getElementById('branch').value = S.cfg.branch;
  document.getElementById('path').value   = S.cfg.path;
  modal.classList.remove('hidden');
});
document.getElementById('settings-cancel').addEventListener('click', () => modal.classList.add('hidden'));
document.getElementById('add-cancel').addEventListener('click', addCancel);
document.getElementById('add-save').addEventListener('click', addCommit);
document.getElementById('add-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addCommit();
  if (e.key === 'Escape') addCancel();
});

document.getElementById('settings-save').addEventListener('click', () => {
  saveCfg({
    pat:    document.getElementById('pat').value.trim(),
    owner:  document.getElementById('owner').value.trim(),
    repo:   document.getElementById('repo').value.trim(),
    branch: document.getElementById('branch').value.trim(),
    path:   document.getElementById('path').value.trim(),
  });
  modal.classList.add('hidden');
  loadTodo();
});

// ---------- init ----------
function setStatus(msg) { document.getElementById('status').textContent = msg; }

async function loadTodo() {
  if (!S.cfg.pat) {
    setStatus('No PAT. Opening settings…');
    document.getElementById('settings').click();
    return;
  }
  try {
    setStatus('loading…');
    S.raw = await ghRead();
    S.doc = parseMd(S.raw);
    S.selected = null;
    S.undo = [];
    setStatus('loaded.');
    render();
  } catch (e) {
    setStatus('load failed: ' + e.message);
  }
}

// ---------- claude tile ----------
const BRIDGE = 'http://127.0.0.1:8787';
let transcriptTimer = null;

// Voice-chat mode: when on, SPEAK auto-adds "≤50 words" to the prompt, and we
// watch for the turn to settle, then call /speak to TTS the answer.
// Done-detection = 3 consecutive identical hardcopy polls (~4.5s stable) and
// no "esc to interrupt" status banner. Stability-only works because the TUI
// spinner always redraws the status line every ~500ms while busy.
let voiceMode = localStorage.getItem('voiceMode') === '1';
let waitingForReply = false;
let replyLastText = '';
let replyStableCount = 0;
let replyStartedAt = 0;

function updateVoiceToggle() {
  const b = document.getElementById('claude-voice-toggle');
  if (!b) return;
  b.classList.toggle('on', voiceMode);
  b.innerHTML = voiceMode ? '&#128266;' : '&#128263;'; // 🔊 vs 🔇
  b.title = voiceMode ? 'Voice replies ON' : 'Voice replies OFF';
}

const VOICE_KICKOFF =
  "Voice chat is now active. For the rest of this session, " +
  "answer every reply in 50 spoken words or fewer. " +
  "Plain prose only, no markdown, no bullets, no code blocks. " +
  "Reply with 'ok' to confirm.";

async function sendKickoff(sid, tab) {
  try {
    await fetch(BRIDGE + '/stuff?sid=' + encodeURIComponent(sid) +
                '&tab=' + encodeURIComponent(tab), {
      method: 'POST', body: VOICE_KICKOFF,
    });
  } catch {}
}

function looksBusy(text) {
  // Spinner line: "✻ Schlepping… (5m · esc to interrupt)" etc.
  // "esc to interrupt" is a reliable busy marker when tool exec is running.
  // The ellipsis-with-timer is also a strong signal.
  if (text.includes('esc to interrupt')) return true;
  if (/…\s*\(\d+[smh]/.test(text)) return true;
  return false;
}

async function speakLastTurn(sid, tab) {
  try {
    const r = await fetch(BRIDGE + '/speak?sid=' + encodeURIComponent(sid) +
                          '&tab=' + encodeURIComponent(tab), { method: 'POST' });
    return await r.json();
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function stopTts() {
  try { await fetch(BRIDGE + '/speak/stop', { method: 'POST' }); } catch {}
}

async function loadClaudeSessions() {
  const list = document.getElementById('claude-list');
  const status = document.getElementById('claude-status');
  const count = document.getElementById('claude-count');
  list.innerHTML = '';
  status.textContent = 'scanning…';
  try {
    const r = await fetch(BRIDGE + '/sessions', { cache: 'no-store' });
    const rows = await r.json();
    count.textContent = rows.length + (rows.length === 1 ? ' tab' : ' tabs');
    status.textContent = rows.length ? '' : 'no claude sessions.';
    for (const row of rows) {
      const card = document.createElement('div');
      card.className = 'session-card';
      const main = document.createElement('button');
      main.className = 'session-main';
      main.innerHTML =
        '<div class="session-title">' + row.label + '</div>' +
        '<div class="session-sub">' + row.cwd + '  ·  pid ' + row.pid + '  ·  ' + row.age + '</div>';
      main.addEventListener('click', () => openClaudeSession(row));
      const addTab = document.createElement('button');
      addTab.className = 'session-addtab';
      addTab.textContent = '+ TAB';
      addTab.addEventListener('click', (e) => { e.stopPropagation(); newClaudeTab(row); });
      const kill = document.createElement('button');
      kill.className = 'session-kill';
      kill.textContent = '×';
      kill.addEventListener('click', (e) => { e.stopPropagation(); killClaudeSession(row); });
      card.appendChild(main);
      card.appendChild(addTab);
      card.appendChild(kill);
      list.appendChild(card);
    }
    const addBtn = document.createElement('button');
    addBtn.className = 'session-card new';
    addBtn.innerHTML = '<div class="session-title">+ NEW SESSION</div>' +
      '<div class="session-sub">new screen + claude in Tab1</div>';
    addBtn.addEventListener('click', newClaudeSession);
    list.appendChild(addBtn);
  } catch (e) {
    status.textContent = 'bridge offline (' + e.message + '). start with: python3 ~/Seantinel/android-todo/bridge.py';
  }
}

async function newClaudeTab(row) {
  const status = document.getElementById('claude-status');
  // Disable every +TAB button for this sid to block double-fires during the
  // 2.5 s boot window — list refresh will re-enable them on next render.
  document.querySelectorAll('.session-addtab').forEach(b => b.disabled = true);
  status.textContent = 'adding tab to ' + row.sid + '…';
  try {
    const r = await fetch(BRIDGE + '/session/addtab?sid=' + encodeURIComponent(row.sid), { method: 'POST' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    setTimeout(loadClaudeSessions, 2500);
  } catch (e) {
    status.textContent = 'add tab failed: ' + e.message;
    document.querySelectorAll('.session-addtab').forEach(b => b.disabled = false);
  }
}

async function killClaudeSession(row) {
  if (!confirm('Kill ' + row.label + '?')) return;
  const status = document.getElementById('claude-status');
  status.textContent = 'killing ' + row.label + '…';
  try {
    const url = BRIDGE + '/session/delete?sid=' + encodeURIComponent(row.sid) +
                '&tab=' + encodeURIComponent(row.tab);
    const r = await fetch(url, { method: 'POST' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    await loadClaudeSessions();
  } catch (e) {
    status.textContent = 'kill failed: ' + e.message;
  }
}

async function newClaudeSession() {
  const status = document.getElementById('claude-status');
  status.textContent = 'spawning…';
  try {
    const r = await fetch(BRIDGE + '/session/new', { method: 'POST' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const row = await r.json();
    status.textContent = 'spawned ' + row.sid + ', booting claude…';
    await loadClaudeSessions();
    status.textContent = 'opening ' + row.sid + '…';
    // Give claude a couple of seconds to boot before we attach — otherwise
    // the transcript polls land on an empty screen and look dead.
    setTimeout(() => openClaudeSession(row), 2000);
  } catch (e) {
    status.textContent = 'spawn failed: ' + e.message;
  }
}

function openClaudeSession(row) {
  document.getElementById('claude-session-label').textContent = row.label;
  document.getElementById('claude-transcript').textContent = 'loading…';
  show('claude-session');
  // Narrow the TTY to match the WebView — handles sessions started outside
  // the APK (default 80 cols), so the TUI redraws without horizontal scroll.
  fetch(BRIDGE + '/resize?sid=' + encodeURIComponent(row.sid) +
        '&tab=' + encodeURIComponent(row.tab) +
        '&cols=' + TTY_COLS + '&rows=30',
        { method: 'POST' }).catch(() => {});
  pollTranscript(row.sid, row.tab);
}

function pollTranscript(sid, tab) {
  stopTranscriptPoll();
  const tick = async () => {
    try {
      const r = await fetch(BRIDGE + '/hardcopy?sid=' + encodeURIComponent(sid) + '&tab=' + encodeURIComponent(tab), { cache: 'no-store' });
      const j = await r.json();
      const el = document.getElementById('claude-transcript');
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
      const txt = j.text || '';
      if (txt.trim()) {
        el.textContent = txt;
        if (atBottom) el.scrollTop = el.scrollHeight;
      }
      // Voice-chat: once we've transcribed, watch for Claude's turn to finish,
      // then TTS. Need (a) >=3s since transcribe (claude boot lag), (b) not
      // busy, (c) 3 identical polls in a row (~4.5s steady).
      if (waitingForReply && txt && (Date.now() - replyStartedAt > 3000)) {
        if (looksBusy(txt)) {
          replyStableCount = 0;
          replyLastText = txt;
        } else if (txt === replyLastText) {
          replyStableCount += 1;
          if (replyStableCount >= 3) {
            waitingForReply = false;
            const st = document.getElementById('speak-status');
            st.textContent = 'speaking…';
            const res = await speakLastTurn(sid, tab);
            st.textContent = res.ok ? '' : 'speak: ' + (res.error || 'failed');
          }
        } else {
          replyStableCount = 0;
          replyLastText = txt;
        }
      }
    } catch (e) {
      document.getElementById('claude-transcript').textContent = 'bridge offline: ' + e.message;
    }
  };
  tick();
  transcriptTimer = setInterval(tick, 1500);
}
function stopTranscriptPoll() {
  if (transcriptTimer) { clearInterval(transcriptTimer); transcriptTimer = null; }
}

document.getElementById('pause-btn').addEventListener('click', async () => {
  const label = document.getElementById('claude-session-label').textContent;
  const [sid, tab] = label.split(' / ');
  if (!sid || !tab) return;
  const st = document.getElementById('speak-status');
  try {
    await fetch(BRIDGE + '/escape?sid=' + encodeURIComponent(sid) + '&tab=' + encodeURIComponent(tab),
                { method: 'POST' });
    st.textContent = 'ESC sent';
    setTimeout(() => { if (st.textContent === 'ESC sent') st.textContent = 'idle'; }, 1200);
  } catch (e) {
    st.textContent = 'pause failed: ' + e.message;
  }
});

document.getElementById('claude-refresh').addEventListener('click', loadClaudeSessions);
document.getElementById('claude-session-refresh').addEventListener('click', () => {
  const label = document.getElementById('claude-session-label').textContent;
  const [sid, tab] = label.split(' / ');
  if (sid && tab) pollTranscript(sid, tab);
});
document.getElementById('claude-voice-toggle').addEventListener('click', async () => {
  voiceMode = !voiceMode;
  localStorage.setItem('voiceMode', voiceMode ? '1' : '0');
  updateVoiceToggle();
  if (voiceMode) {
    const label = document.getElementById('claude-session-label').textContent;
    const [sid, tab] = label.split(' / ');
    if (sid && tab) {
      document.getElementById('speak-status').textContent = 'priming voice mode…';
      await sendKickoff(sid, tab);
    }
  } else {
    waitingForReply = false;
    await stopTts();
    document.getElementById('speak-status').textContent = 'voice off';
  }
});
updateVoiceToggle();

let speakRecording = false;
let speakStart = 0;
let speakTimer = null;

const NATIVE_REC = (typeof AndroidRecorder !== 'undefined' && AndroidRecorder !== null);

function b64ToBytes(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

document.getElementById('speak-btn').addEventListener('click', async () => {
  const label = document.getElementById('claude-session-label').textContent;
  const [sid, tab] = label.split(' / ');
  if (!sid || !tab) return;
  const btn = document.getElementById('speak-btn');
  const st = document.getElementById('speak-status');

  if (!speakRecording) {
    btn.disabled = true;
    st.textContent = 'opening mic…';
    // Interrupt any speech in progress and reset reply-watch state.
    waitingForReply = false;
    await stopTts();
    try {
      if (NATIVE_REC) {
        const r = JSON.parse(AndroidRecorder.start());
        if (!r.ok) throw new Error(r.error || 'start failed');
      } else {
        await fetch(BRIDGE + '/record/start', { method: 'POST' });
      }
      speakRecording = true;
      speakStart = Date.now();
      btn.classList.add('listening');
      btn.innerHTML = '&#9632; STOP';
      speakTimer = setInterval(() => {
        const s = Math.floor((Date.now() - speakStart) / 1000);
        st.textContent = 'listening… ' + s + 's';
      }, 500);
      st.textContent = 'listening… 0s';
    } catch (e) {
      st.textContent = 'mic error: ' + e.message;
    } finally {
      btn.disabled = false;
    }
    return;
  }

  // stop + transcribe
  btn.disabled = true;
  btn.classList.remove('listening');
  btn.classList.add('transcribing');
  btn.innerHTML = '&#9203; TRANSCRIBING…';
  clearInterval(speakTimer); speakTimer = null;
  st.textContent = 'transcribing…';
  try {
    let j;
    if (NATIVE_REC) {
      const s = JSON.parse(AndroidRecorder.stop());
      if (!s.ok) throw new Error(s.error || 'stop failed');
      const bytes = b64ToBytes(s.b64);
      const r = await fetch(BRIDGE + '/transcribe?sid=' + encodeURIComponent(sid) + '&tab=' + encodeURIComponent(tab),
                            { method: 'POST', body: bytes });
      j = await r.json();
    } else {
      const r = await fetch(BRIDGE + '/record/stop?sid=' + encodeURIComponent(sid) + '&tab=' + encodeURIComponent(tab), { method: 'POST' });
      j = await r.json();
    }
    const db = (j.max_db === null || j.max_db === undefined) ? '?' : (j.max_db.toFixed(1) + ' dB');
    const kb = j.bytes ? (j.bytes / 1024).toFixed(1) + ' KB' : '0';
    const tag = ' [' + db + ', ' + kb + ']';
    if (j.text && j.stuffed) {
      if (voiceMode) {
        st.textContent = 'Claude is thinking…';
        waitingForReply = true;
        replyLastText = '';
        replyStableCount = 0;
        replyStartedAt = Date.now();
      } else {
        st.textContent = '';
      }
    } else if (j.text) {
      st.textContent = 'heard (not sent): "' + j.text + '"' + tag;
    } else if (j.max_db !== null && j.max_db < -30) {
      st.textContent = 'SILENT MIC — audio routing failed' + tag;
    } else {
      st.textContent = 'empty transcript' + tag;
    }
  } catch (e) {
    st.textContent = 'error: ' + e.message;
  } finally {
    speakRecording = false;
    btn.disabled = false;
    btn.classList.remove('listening');
    btn.classList.remove('transcribing');
    btn.innerHTML = '&#127908; SPEAK';
  }
});

})();
