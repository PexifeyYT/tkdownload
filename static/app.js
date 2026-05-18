'use strict';

// ── Elements ──────────────────────────────────────────────────────────────────
const urlInput    = document.getElementById('urlInput');
const downloadBtn = document.getElementById('downloadBtn');
const logArea     = document.getElementById('logArea');
const platBadge   = document.getElementById('platBadge');
const elapsed     = document.getElementById('elapsed');
const themeToggle = document.getElementById('themeToggle');
const toggleThumb = document.getElementById('toggleThumb');
const themeLabel  = document.getElementById('themeLabel');

// ── State ─────────────────────────────────────────────────────────────────────
let isLoading = false;
let timerInterval = null;

// ── Theme ─────────────────────────────────────────────────────────────────────
const STORED_THEME = localStorage.getItem('vdl-theme') || 'dark';
applyTheme(STORED_THEME);

function applyTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('vdl-theme', name);
  if (name === 'dark') {
    toggleThumb.classList.add('right');
    themeToggle.classList.remove('off');
    themeLabel.textContent = 'Dark';
  } else {
    toggleThumb.classList.remove('right');
    themeToggle.classList.add('off');
    themeLabel.textContent = 'Light';
  }
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

themeToggle.addEventListener('keydown', e => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    themeToggle.click();
  }
});

// ── Platform detection ────────────────────────────────────────────────────────
const PLAT_CFG = {
  tiktok:    { sym: '♫', label: 'TikTok',    regex: /tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/i },
  youtube:   { sym: '▶', label: 'YouTube',   regex: /youtube\.com|youtu\.be/i },
  instagram: { sym: '◉', label: 'Instagram', regex: /instagram\.com/i },
};

const PLAT_LOG = {
  tiktok:    { sym: '♫', color: '#ff375f' },
  youtube:   { sym: '▶', color: '#ff6b6b' },
  instagram: { sym: '◉', color: '#bf5af2' },
  unknown:   { sym: '◦', color: '#8e8e93' },
};

function detectPlatform(url) {
  for (const [key, cfg] of Object.entries(PLAT_CFG)) {
    if (cfg.regex.test(url)) return key;
  }
  return url.trim() ? 'unknown' : '';
}

function updateBadge() {
  const plat = detectPlatform(urlInput.value);
  if (plat && PLAT_CFG[plat]) {
    const c = PLAT_CFG[plat];
    platBadge.className = `plat-badge ${plat} show`;
    platBadge.textContent = `${c.sym}  ${c.label}`;
  } else {
    platBadge.className = 'plat-badge';
    platBadge.textContent = '';
  }
}

urlInput.addEventListener('input', updateBadge);

// ── Download ──────────────────────────────────────────────────────────────────
urlInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleDownload();
});

downloadBtn.addEventListener('click', handleDownload);

async function handleDownload() {
  if (isLoading) return;

  const url = urlInput.value.trim();
  if (!url) {
    addLog('Paste a URL first', 'error');
    shakeBadge();
    return;
  }

  const platform = detectPlatform(url);
  setLoading(true);
  startTimer();
  addLog('Fetching…', 'info');

  try {
    const res = await fetch('/api/download', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url }),
    });

    stopTimer();

    let data;
    try { data = await res.json(); } catch { data = {}; }

    if (!res.ok) {
      const msg  = data.detail?.message || data.detail || 'Download failed';
      const plat = data.detail?.platform || platform;
      addLog(msg, 'error', plat);
      flashBtn('err');
      return;
    }

    addLog(data.filename, 'ok', data.platform);

    // Trigger browser file download via hidden anchor
    const a = document.createElement('a');
    a.href = `/api/file/${data.token}`;
    a.download = data.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    urlInput.value = '';
    updateBadge();
    flashBtn('ok');

  } catch (err) {
    stopTimer();
    addLog(`Network error: ${err.message}`, 'error');
    flashBtn('err');
  } finally {
    setTimeout(() => setLoading(false), 750);
  }
}

// ── Button state ──────────────────────────────────────────────────────────────
function setLoading(on) {
  isLoading = on;
  downloadBtn.disabled = on;
  downloadBtn.innerHTML = on
    ? '<span class="spinner"></span><span class="btn-text">Downloading</span>'
    : '<span class="btn-text">Download</span>';
}

function flashBtn(kind) {
  const cls = kind === 'ok' ? 'flash-ok' : 'flash-err';
  downloadBtn.classList.add(cls);
  setTimeout(() => {
    downloadBtn.style.transition = 'background 0.5s ease, box-shadow 0.5s ease';
    downloadBtn.classList.remove(cls);
    setTimeout(() => { downloadBtn.style.transition = ''; }, 500);
  }, 700);
}

function shakeBadge() {
  const ig = document.getElementById('inputGroup');
  ig.style.animation = 'none';
  ig.offsetHeight; // reflow
  ig.style.animation = 'shake 0.35s ease';
  setTimeout(() => { ig.style.animation = ''; }, 350);
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function startTimer() {
  let start = Date.now();
  elapsed.textContent = '';
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000);
    elapsed.textContent = s > 0 ? `${s}s` : '';
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  elapsed.textContent = '';
}

// ── Log ───────────────────────────────────────────────────────────────────────
const LOG_COLORS = {
  ok:    'var(--success)',
  error: 'var(--error)',
  info:  'var(--text2)',
};
const LOG_SYMS = { ok: '  ✓ ', error: '  ✗ ', info: '    ' };

function addLog(msg, kind = 'info', platform = '') {
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  let html = '';
  if (platform && PLAT_LOG[platform]) {
    const p = PLAT_LOG[platform];
    html += `<span class="log-plat" style="color:${p.color}">${p.sym}  ${platform.toUpperCase()}</span>`;
  }

  const color = LOG_COLORS[kind] || LOG_COLORS.info;
  const sym   = LOG_SYMS[kind]   || LOG_SYMS.info;
  html += `<span style="color:${color}">${sym}${esc(msg)}</span>`;
  entry.innerHTML = html;

  // Slide-in
  entry.style.cssText = 'opacity:0;transform:translateY(5px)';
  logArea.appendChild(entry);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    entry.style.cssText = 'transition:opacity .2s ease,transform .2s ease;opacity:1;transform:none';
  }));
  logArea.scrollTop = logArea.scrollHeight;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Shake keyframe (injected) ─────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-6px); }
    40%      { transform: translateX(6px); }
    60%      { transform: translateX(-4px); }
    80%      { transform: translateX(4px); }
  }
`;
document.head.appendChild(style);

// ── Init ──────────────────────────────────────────────────────────────────────
addLog('Ready — paste a URL and click Download', 'info');
urlInput.focus();
