'use strict';

/* ============================================================
   Toile collaborative — logique du dessin et synchronisation.
   Modèle "vectoriel" : chaque élément dessiné est stocké en base
   et la scène est re-rendue à partir de la liste d'éléments.
   ============================================================ */

const CANVAS = window.CANVAS;
let identity = window.IDENTITY; // {prenom, pseudo, is_admin} ou null

const $ = (id) => document.getElementById(id);

// ---------- API ----------
async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({ ok: false, error: 'Réponse invalide' }));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}
const postJSON = (url, body) =>
  api(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// ---------- État ----------
const board = $('board');
board.width = CANVAS.width;
board.height = CANVAS.height;
const ctx = board.getContext('2d');

const scene = document.createElement('canvas');
scene.width = CANVAS.width;
scene.height = CANVAS.height;
const sctx = scene.getContext('2d', { willReadFrequently: true });

let elements = [];           // [{id, tool, data, mine, prenom?, created_at?}]
const byId = new Map();
let lastId = 0;

let tool = 'pen';
let color = '#222222';
let size = 4;
let shapeFill = false;

// ---------- Rendu ----------
function drawShape(c, tool, d) {
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = d.color;
  c.fillStyle = d.color;
  c.lineWidth = d.size || 1;

  if (tool === 'pen' || tool === 'pencil') {
    const pts = d.points || [];
    if (pts.length === 0) return;
    c.globalAlpha = tool === 'pencil' ? 0.55 : 1;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 1) {
      // un simple point
      c.lineTo(pts[0][0] + 0.01, pts[0][1]);
    } else {
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    }
    c.stroke();
    c.globalAlpha = 1;
    return;
  }

  const x1 = d.x1, y1 = d.y1, x2 = d.x2, y2 = d.y2;
  if (tool === 'line') {
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    return;
  }

  const left = Math.min(x1, x2), top = Math.min(y1, y2);
  const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);

  c.beginPath();
  if (tool === 'rect') {
    c.rect(left, top, w, h);
  } else if (tool === 'circle') {
    c.ellipse(left + w / 2, top + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (tool === 'triangle') {
    c.moveTo(left + w / 2, top);
    c.lineTo(left, top + h);
    c.lineTo(left + w, top + h);
    c.closePath();
  }
  if (d.fill) c.fill();
  else c.stroke();
}

function floodFill(c, x, y, hex) {
  x = Math.round(x); y = Math.round(y);
  const W = c.canvas.width, H = c.canvas.height;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const img = c.getImageData(0, 0, W, H);
  const data = img.data;
  const target = (x + y * W) * 4;
  const sr = data[target], sg = data[target + 1], sb = data[target + 2], sa = data[target + 3];

  const fr = parseInt(hex.slice(1, 3), 16);
  const fg = parseInt(hex.slice(3, 5), 16);
  const fb = parseInt(hex.slice(5, 7), 16);
  if (sr === fr && sg === fg && sb === fb && sa === 255) return;

  const tol = 40;
  const match = (i) =>
    Math.abs(data[i] - sr) <= tol &&
    Math.abs(data[i + 1] - sg) <= tol &&
    Math.abs(data[i + 2] - sb) <= tol &&
    Math.abs(data[i + 3] - sa) <= tol;

  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    let nx = cx;
    while (nx >= 0 && match((nx + cy * W) * 4)) nx--;
    nx++;
    let up = false, down = false;
    while (nx < W && match((nx + cy * W) * 4)) {
      const i = (nx + cy * W) * 4;
      data[i] = fr; data[i + 1] = fg; data[i + 2] = fb; data[i + 3] = 255;
      if (cy > 0 && match((nx + (cy - 1) * W) * 4)) {
        if (!up) { stack.push([nx, cy - 1]); up = true; }
      } else up = false;
      if (cy < H - 1 && match((nx + (cy + 1) * W) * 4)) {
        if (!down) { stack.push([nx, cy + 1]); down = true; }
      } else down = false;
      nx++;
    }
  }
  c.putImageData(img, 0, 0);
}

function renderScene() {
  elements.sort((a, b) => a.id - b.id);
  sctx.clearRect(0, 0, scene.width, scene.height);
  sctx.fillStyle = CANVAS.bg;
  sctx.fillRect(0, 0, scene.width, scene.height);
  for (const el of elements) {
    if (el.tool === 'fill') floodFill(sctx, el.data.x, el.data.y, el.data.color);
    else drawShape(sctx, el.tool, el.data);
  }
}

let preview = null; // {tool, data}
function paint() {
  ctx.clearRect(0, 0, board.width, board.height);
  ctx.drawImage(scene, 0, 0);
  if (preview) drawShape(ctx, preview.tool, preview.data);
}

// ---------- Interaction ----------
function canvasPoint(ev) {
  const rect = board.getBoundingClientRect();
  const src = ev.touches ? ev.touches[0] : ev;
  return [
    Math.round((src.clientX - rect.left) * (board.width / rect.width)),
    Math.round((src.clientY - rect.top) * (board.height / rect.height)),
  ];
}

let drawing = false;
let startPt = null;
let freehand = null;

function requireIdentity() {
  if (!identity) { openIdentityModal(); return false; }
  return true;
}

function onDown(ev) {
  ev.preventDefault();
  const [x, y] = canvasPoint(ev);

  if (tool === 'eraser') {
    if (!requireIdentity()) return;
    eraseAt(x, y);
    return;
  }
  if (!requireIdentity()) return;

  if (tool === 'fill') {
    addFill(x, y);
    return;
  }

  drawing = true;
  startPt = [x, y];
  if (tool === 'pen' || tool === 'pencil') {
    freehand = [[x, y]];
    preview = { tool, data: { points: freehand, color, size } };
  } else {
    preview = { tool, data: { x1: x, y1: y, x2: x, y2: y, color, size, fill: shapeFill } };
  }
  paint();
}

function onMove(ev) {
  if (!drawing) return;
  const [x, y] = canvasPoint(ev);
  if (tool === 'pen' || tool === 'pencil') {
    freehand.push([x, y]);
  } else {
    preview.data.x2 = x;
    preview.data.y2 = y;
  }
  paint();
}

async function onUp(ev) {
  if (!drawing) return;
  drawing = false;
  const committed = preview;
  preview = null;
  if (!committed) return;

  // ignore les formes nulles
  const d = committed.data;
  if ((committed.tool === 'pen' || committed.tool === 'pencil')) {
    // ok même un point
  } else if (d.x1 === d.x2 && d.y1 === d.y2) {
    paint();
    return;
  }
  await addElement(committed.tool, committed.data);
}

// ---------- Mutations ----------
function addLocal(el) {
  if (byId.has(el.id)) return;
  byId.set(el.id, el);
  elements.push(el);
  if (el.id > lastId) lastId = el.id;
}

async function addElement(tool, data) {
  try {
    const res = await postJSON('api/strokes.php', { canvas: CANVAS.slug, tool, data });
    addLocal(res.element);
    renderScene();
    paint();
    if (identity && identity.is_admin) loadAdmin();
  } catch (e) {
    showStatus(e.message);
    paint();
  }
}

function addFill(x, y) {
  addElement('fill', { x, y, color });
}

function pointNearSegment(px, py, x1, y1, x2, y2, tol) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy) <= tol;
}

function hitTest(el, x, y) {
  const d = el.data;
  const tol = Math.max(8, (d.size || 6) / 2 + 4);
  if (el.tool === 'fill') return true; // un fill couvre une grande zone
  if (el.tool === 'pen' || el.tool === 'pencil') {
    const p = d.points || [];
    for (let i = 1; i < p.length; i++) {
      if (pointNearSegment(x, y, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], tol)) return true;
    }
    if (p.length === 1) return Math.hypot(x - p[0][0], y - p[0][1]) <= tol;
    return false;
  }
  if (el.tool === 'line') return pointNearSegment(x, y, d.x1, d.y1, d.x2, d.y2, tol);

  const left = Math.min(d.x1, d.x2), top = Math.min(d.y1, d.y2);
  const w = Math.abs(d.x2 - d.x1), h = Math.abs(d.y2 - d.y1);
  if (d.fill) return x >= left && x <= left + w && y >= top && y <= top + h;
  // sinon : près du contour de la boîte englobante
  const near =
    pointNearSegment(x, y, left, top, left + w, top, tol) ||
    pointNearSegment(x, y, left + w, top, left + w, top + h, tol) ||
    pointNearSegment(x, y, left + w, top + h, left, top + h, tol) ||
    pointNearSegment(x, y, left, top + h, left, top, tol);
  return near;
}

async function eraseAt(x, y) {
  // du plus récent (au-dessus) au plus ancien
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    const deletable = identity && (identity.is_admin || el.mine);
    if (deletable && hitTest(el, x, y)) {
      await removeElement(el.id);
      return;
    }
  }
  showStatus('Aucun élément à effacer ici (ou non autorisé).');
}

async function removeElement(id) {
  try {
    await postJSON('api/delete.php', { canvas: CANVAS.slug, id });
    if (byId.has(id)) {
      byId.delete(id);
      elements = elements.filter((e) => e.id !== id);
    }
    renderScene();
    paint();
    if (identity && identity.is_admin) loadAdmin();
  } catch (e) {
    showStatus(e.message);
  }
}

// ---------- Synchronisation (polling) ----------
async function sync() {
  try {
    const res = await api(
      'api/strokes.php?canvas=' + encodeURIComponent(CANVAS.slug) + '&since=' + lastId
    );
    let changed = false;
    for (const el of res.new) { addLocal(el); changed = true; }
    const live = new Set(res.ids);
    const before = elements.length;
    elements = elements.filter((e) => {
      if (live.has(e.id)) return true;
      byId.delete(e.id);
      return false;
    });
    if (elements.length !== before) changed = true;
    if (changed) { renderScene(); paint(); }
  } catch (e) {
    /* silencieux : on réessaiera */
  }
}

// ---------- UI : outils ----------
function setActiveTool(name) {
  tool = name;
  document.querySelectorAll('.tool').forEach((b) =>
    b.classList.toggle('active', b.dataset.tool === name)
  );
  board.style.cursor = name === 'fill' ? 'cell' : name === 'eraser' ? 'not-allowed' : 'crosshair';
}

document.querySelectorAll('.tool').forEach((b) => {
  b.addEventListener('click', () => setActiveTool(b.dataset.tool));
});

const colorInput = $('color');
colorInput.addEventListener('input', () => { color = colorInput.value; });

const SWATCHES = ['#222222', '#ffffff', '#e74c3c', '#e67e22', '#f1c40f',
  '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e84393', '#7f8c8d', '#000000'];
const swatchBox = $('swatches');
SWATCHES.forEach((c) => {
  const s = document.createElement('div');
  s.className = 'swatch';
  s.style.background = c;
  s.title = c;
  s.addEventListener('click', () => { color = c; colorInput.value = c; });
  swatchBox.appendChild(s);
});

const sizeInput = $('size');
sizeInput.addEventListener('input', () => {
  size = parseInt(sizeInput.value, 10);
  $('sizeVal').textContent = size;
});
$('shapeFill').addEventListener('change', (e) => { shapeFill = e.target.checked; });

// ---------- UI : statut ----------
let statusTimer = null;
function showStatus(msg) {
  const el = $('status');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ---------- Identité ----------
function openIdentityModal() {
  $('identityModal').hidden = false;
  $('idPrenom').focus();
}
function closeIdentityModal() { $('identityModal').hidden = true; }

$('idSubmit').addEventListener('click', async () => {
  const prenom = $('idPrenom').value.trim();
  const pseudo = $('idPseudo').value.trim();
  const msg = $('idMsg');
  if (!prenom || !pseudo) { msg.textContent = 'Prénom et pseudo obligatoires.'; msg.className = 'msg error'; return; }
  try {
    const res = await postJSON('api/identify.php', { prenom, pseudo });
    identity = res.identity;
    closeIdentityModal();
    applyIdentity();
    // recharge pour récupérer les métadonnées admin sur les éléments existants
    lastId = 0; elements = []; byId.clear();
    await sync();
  } catch (e) { msg.textContent = e.message; msg.className = 'msg error'; }
});

function applyIdentity() {
  const who = $('whoami');
  if (identity) {
    who.innerHTML = 'Connecté : <strong>' + escapeHtml(identity.prenom) + '</strong> (' +
      escapeHtml(identity.pseudo) + ')' +
      (identity.is_admin ? ' <span class="badge-admin">ADMIN</span>' : '');
    $('exportBtn').hidden = !identity.is_admin;
    $('adminBtn').hidden = !identity.is_admin;
    if (identity.is_admin) loadAdmin();
  } else {
    who.textContent = 'Non identifié';
    $('exportBtn').hidden = true;
    $('adminBtn').hidden = true;
  }
}

$('changeBtn').addEventListener('click', async () => {
  try { await postJSON('api/logout.php', {}); } catch (e) {}
  identity = null;
  applyIdentity();
  $('adminPanel').hidden = true;
  $('idPrenom').value = ''; $('idPseudo').value = '';
  openIdentityModal();
  lastId = 0; elements = []; byId.clear();
  await sync();
});

// ---------- Partage ----------
$('shareBtn').addEventListener('click', async () => {
  const url = window.location.href;
  try { await navigator.clipboard.writeText(url); showStatus('Lien copié !'); }
  catch (e) { showStatus(url); }
});

// ---------- Export PNG (admin) ----------
$('exportBtn').addEventListener('click', () => {
  renderScene();
  const link = document.createElement('a');
  link.download = (CANVAS.name || 'toile').replace(/[^a-z0-9]+/gi, '_') + '.png';
  link.href = scene.toDataURL('image/png');
  link.click();
});

// ---------- Panneau admin ----------
let adminOpen = false;
$('adminBtn').addEventListener('click', () => {
  adminOpen = !adminOpen;
  $('adminPanel').hidden = !adminOpen;
  if (adminOpen) loadAdmin();
});

const TOOL_LABELS = {
  pen: 'Stylo', pencil: 'Crayon', line: 'Ligne', rect: 'Rectangle',
  circle: 'Cercle', triangle: 'Triangle', fill: 'Remplissage',
};

async function loadAdmin() {
  if (!identity || !identity.is_admin) return;
  try {
    const res = await api('api/admin.php?canvas=' + encodeURIComponent(CANVAS.slug));
    const cl = $('contribList');
    cl.innerHTML = '';
    res.contributors.forEach((c) => {
      const li = document.createElement('li');
      li.innerHTML = '<strong>' + escapeHtml(c.prenom) + '</strong> (' + escapeHtml(c.pseudo) +
        ')<div class="meta">' + c.count + ' élément(s) · dernier : ' + escapeHtml(c.last || '—') + '</div>';
      cl.appendChild(li);
    });
    const ev = $('eventList');
    ev.innerHTML = '';
    res.events.forEach((e) => {
      const li = document.createElement('li');
      if (e.deleted) li.className = 'deleted';
      li.innerHTML = '<strong>' + escapeHtml(e.prenom) + '</strong> — ' +
        (TOOL_LABELS[e.tool] || e.tool) +
        '<div class="meta">' + escapeHtml(e.created_at) + (e.deleted ? ' · supprimé' : '') + '</div>';
      ev.appendChild(li);
    });
  } catch (e) { /* ignore */ }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ---------- Init ----------
$('canvasName').textContent = CANVAS.name;
setActiveTool('pen');
$('sizeVal').textContent = size;
colorInput.value = color;

board.addEventListener('mousedown', onDown);
window.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
board.addEventListener('touchstart', onDown, { passive: false });
board.addEventListener('touchmove', onMove, { passive: false });
window.addEventListener('touchend', onUp);

applyIdentity();
renderScene();
paint();
sync().then(() => { if (!identity) openIdentityModal(); });
setInterval(sync, 1800);
