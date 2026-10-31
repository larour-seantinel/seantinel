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
const show = id => {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
};
document.querySelectorAll('[data-tile]').forEach(b => b.addEventListener('click', () => {
  const t = b.dataset.tile;
  if (t === 'todo') { show('todo'); loadTodo(); }
  else setStatus(t.toUpperCase() + ': not wired yet.');
}));
document.getElementById('back').addEventListener('click', () => show('home'));

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

})();
