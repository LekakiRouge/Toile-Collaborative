const ADMIN_FIRST_NAME = 'Khalil';
const ADMIN_NICKNAME = 'kaki1403';
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1000;

const state = {
  canvasId: getCanvasId(),
  identity: null,
  role: 'passenger',
  tool: 'pen',
  color: '#5b5cf6',
  size: 8,
  drawings: [],
  draft: null,
  selectedDrawingId: null,
  dragOffset: { x: 0, y: 0 },
};

const elements = {
  loginPanel: document.querySelector('#loginPanel'),
  canvasPanel: document.querySelector('#canvasPanel'),
  identityForm: document.querySelector('#identityForm'),
  firstNameInput: document.querySelector('#firstNameInput'),
  nicknameInput: document.querySelector('#nicknameInput'),
  canvasIdLabel: document.querySelector('#canvasIdLabel'),
  userLabel: document.querySelector('#userLabel'),
  roleBadge: document.querySelector('#roleBadge'),
  copyLinkButton: document.querySelector('#copyLinkButton'),
  logoutButton: document.querySelector('#logoutButton'),
  colorInput: document.querySelector('#colorInput'),
  sizeInput: document.querySelector('#sizeInput'),
  sizeLabel: document.querySelector('#sizeLabel'),
  undoMineButton: document.querySelector('#undoMineButton'),
  clearMineButton: document.querySelector('#clearMineButton'),
  exportButton: document.querySelector('#exportButton'),
  clearAllButton: document.querySelector('#clearAllButton'),
  adminPanel: document.querySelector('#adminPanel'),
  historyList: document.querySelector('#historyList'),
  strokeCount: document.querySelector('#strokeCount'),
  artistCount: document.querySelector('#artistCount'),
  canvasNotice: document.querySelector('#canvasNotice'),
  drawingCanvas: document.querySelector('#drawingCanvas'),
};

const context = elements.drawingCanvas.getContext('2d');

init();

function init() {
  elements.canvasIdLabel.textContent = state.canvasId;
  state.drawings = loadDrawings();

  const savedIdentity = loadIdentity();
  if (savedIdentity) {
    startSession(savedIdentity);
  }

  elements.identityForm.addEventListener('submit', handleIdentitySubmit);
  elements.copyLinkButton.addEventListener('click', copyCanvasLink);
  elements.logoutButton.addEventListener('click', logout);
  elements.colorInput.addEventListener('input', (event) => {
    state.color = event.target.value;
  });
  elements.sizeInput.addEventListener('input', (event) => {
    state.size = Number(event.target.value);
    elements.sizeLabel.textContent = `${state.size} px`;
  });
  elements.undoMineButton.addEventListener('click', undoMine);
  elements.clearMineButton.addEventListener('click', clearMine);
  elements.exportButton.addEventListener('click', exportCanvas);
  elements.clearAllButton.addEventListener('click', clearAll);

  document.querySelectorAll('.tool-button').forEach((button) => {
    button.addEventListener('click', () => selectTool(button.dataset.tool));
  });

  elements.drawingCanvas.addEventListener('pointerdown', handlePointerDown);
  elements.drawingCanvas.addEventListener('pointermove', handlePointerMove);
  elements.drawingCanvas.addEventListener('pointerup', handlePointerUp);
  elements.drawingCanvas.addEventListener('pointerleave', handlePointerUp);

  window.addEventListener('storage', (event) => {
    if (event.key === storageKey('drawings')) {
      state.drawings = loadDrawings();
      render();
    }
  });

  render();
}

function getCanvasId() {
  const params = new URLSearchParams(window.location.search);
  const existingId = params.get('toile');
  if (existingId) {
    return sanitizeCanvasId(existingId);
  }

  const generatedId = crypto.randomUUID().slice(0, 8);
  params.set('toile', generatedId);
  const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState({}, '', nextUrl);
  return generatedId;
}

function sanitizeCanvasId(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'toile';
}

function storageKey(kind) {
  return `toile-collaborative:${state.canvasId}:${kind}`;
}

function loadIdentity() {
  const rawIdentity = localStorage.getItem(storageKey('identity'));
  return rawIdentity ? JSON.parse(rawIdentity) : null;
}

function saveIdentity(identity) {
  localStorage.setItem(storageKey('identity'), JSON.stringify(identity));
}

function loadDrawings() {
  const rawDrawings = localStorage.getItem(storageKey('drawings'));
  return rawDrawings ? JSON.parse(rawDrawings) : [];
}

function saveDrawings() {
  localStorage.setItem(storageKey('drawings'), JSON.stringify(state.drawings));
}

function handleIdentitySubmit(event) {
  event.preventDefault();
  const identity = {
    firstName: elements.firstNameInput.value.trim(),
    nickname: elements.nicknameInput.value.trim(),
  };

  if (!identity.firstName || !identity.nickname) {
    showNotice('Merci de renseigner ton prénom et ton pseudo.');
    return;
  }

  saveIdentity(identity);
  startSession(identity);
}

function startSession(identity) {
  state.identity = identity;
  state.role = identity.firstName === ADMIN_FIRST_NAME && identity.nickname === ADMIN_NICKNAME ? 'admin' : 'passenger';
  elements.loginPanel.classList.add('is-hidden');
  elements.canvasPanel.classList.remove('is-hidden');
  elements.userLabel.textContent = `${identity.firstName} · ${identity.nickname}`;
  elements.roleBadge.textContent = state.role === 'admin' ? 'Admin' : 'Passager';
  elements.roleBadge.classList.toggle('is-admin', state.role === 'admin');
  document.body.classList.toggle('is-admin', state.role === 'admin');
  render();
}

function logout() {
  localStorage.removeItem(storageKey('identity'));
  state.identity = null;
  state.role = 'passenger';
  state.selectedDrawingId = null;
  elements.canvasPanel.classList.add('is-hidden');
  elements.loginPanel.classList.remove('is-hidden');
  document.body.classList.remove('is-admin');
}

async function copyCanvasLink() {
  await navigator.clipboard.writeText(window.location.href);
  showNotice('Lien de la toile copié.');
}

function selectTool(tool) {
  state.tool = tool;
  state.selectedDrawingId = null;
  document.querySelectorAll('.tool-button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tool === tool);
  });
  render();
}

function handlePointerDown(event) {
  if (!state.identity) return;
  elements.drawingCanvas.setPointerCapture(event.pointerId);
  const point = getCanvasPoint(event);

  if (state.tool === 'bucket') {
    addDrawing({ type: 'bucket', points: [point], color: state.color, size: state.size });
    return;
  }

  if (state.tool === 'eraser') {
    eraseAt(point);
    return;
  }

  const editableDrawing = findEditableDrawingAt(point);
  if (editableDrawing) {
    state.selectedDrawingId = editableDrawing.id;
    state.dragOffset = point;
    state.draft = { mode: 'move', drawing: structuredClone(editableDrawing), lastPoint: point };
    return;
  }

  const drawing = createBaseDrawing(point);
  state.draft = { mode: 'draw', drawing };
}

function handlePointerMove(event) {
  if (!state.draft) return;
  const point = getCanvasPoint(event);

  if (state.draft.mode === 'move') {
    const dx = point.x - state.draft.lastPoint.x;
    const dy = point.y - state.draft.lastPoint.y;
    state.draft.drawing = translateDrawing(state.draft.drawing, dx, dy);
    state.draft.lastPoint = point;
    const index = state.drawings.findIndex((drawing) => drawing.id === state.selectedDrawingId);
    if (index >= 0) {
      state.drawings[index] = state.draft.drawing;
      render();
    }
    return;
  }

  if (['pen', 'pencil'].includes(state.draft.drawing.type)) {
    state.draft.drawing.points.push(point);
  } else {
    state.draft.drawing.points[1] = point;
  }
  render();
}

function handlePointerUp() {
  if (!state.draft) return;

  if (state.draft.mode === 'move') {
    saveDrawings();
    showNotice('Dessin déplacé.');
  } else if (state.draft.drawing.points.length > 1 || ['rectangle', 'circle', 'line'].includes(state.draft.drawing.type)) {
    state.drawings.push(state.draft.drawing);
    saveDrawings();
  }

  state.draft = null;
  render();
}

function createBaseDrawing(point) {
  const type = state.tool;
  return {
    id: crypto.randomUUID(),
    type,
    points: [point, point],
    color: state.color,
    size: type === 'pencil' ? Math.max(2, Math.round(state.size * 0.45)) : state.size,
    createdAt: new Date().toISOString(),
    author: {
      firstName: state.identity.firstName,
      nickname: state.identity.nickname,
    },
  };
}

function addDrawing(partialDrawing) {
  state.drawings.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    author: {
      firstName: state.identity.firstName,
      nickname: state.identity.nickname,
    },
    ...partialDrawing,
  });
  saveDrawings();
  render();
}

function eraseAt(point) {
  const index = [...state.drawings]
    .reverse()
    .findIndex((drawing) => canEdit(drawing) && isPointInDrawing(point, drawing));
  if (index === -1) return;

  const realIndex = state.drawings.length - 1 - index;
  state.drawings.splice(realIndex, 1);
  saveDrawings();
  render();
}

function canEdit(drawing) {
  return state.role === 'admin' || drawing.author.firstName === state.identity?.firstName;
}

function findEditableDrawingAt(point) {
  return [...state.drawings].reverse().find((drawing) => canEdit(drawing) && isPointInDrawing(point, drawing));
}

function getCanvasPoint(event) {
  const rect = elements.drawingCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
  };
}

function translateDrawing(drawing, dx, dy) {
  return {
    ...drawing,
    points: drawing.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
  };
}

function isPointInDrawing(point, drawing) {
  const tolerance = Math.max(12, drawing.size + 8);

  if (drawing.type === 'bucket') return true;
  if (['pen', 'pencil', 'line'].includes(drawing.type)) {
    return drawing.points.some((drawPoint) => distance(point, drawPoint) <= tolerance);
  }

  const [start, end] = drawing.points;
  const left = Math.min(start.x, end.x) - tolerance;
  const right = Math.max(start.x, end.x) + tolerance;
  const top = Math.min(start.y, end.y) - tolerance;
  const bottom = Math.max(start.y, end.y) + tolerance;
  return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function undoMine() {
  const index = [...state.drawings]
    .reverse()
    .findIndex((drawing) => canEdit(drawing));
  if (index === -1) return;

  state.drawings.splice(state.drawings.length - 1 - index, 1);
  saveDrawings();
  render();
}

function clearMine() {
  state.drawings = state.drawings.filter((drawing) => !canEdit(drawing));
  saveDrawings();
  render();
}

function clearAll() {
  if (state.role !== 'admin') return;
  state.drawings = [];
  saveDrawings();
  render();
}

function exportCanvas() {
  if (state.role !== 'admin') return;
  render(false);
  const link = document.createElement('a');
  link.download = `toile-${state.canvasId}.png`;
  link.href = elements.drawingCanvas.toDataURL('image/png');
  link.click();
  render();
}

function render(showSelection = true) {
  drawCanvas(showSelection);
  updateAdminPanel();
}

function drawCanvas(showSelection) {
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  state.drawings.forEach((drawing) => drawDrawing(drawing));
  if (state.draft?.mode === 'draw') {
    drawDrawing(state.draft.drawing);
  }

  if (showSelection && state.selectedDrawingId) {
    const drawing = state.drawings.find((item) => item.id === state.selectedDrawingId);
    if (drawing) drawSelection(drawing);
  }
}

function drawDrawing(drawing) {
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = drawing.color;
  context.fillStyle = drawing.color;
  context.lineWidth = drawing.size;

  if (drawing.type === 'bucket') {
    context.globalAlpha = 0.2;
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else if (['pen', 'pencil'].includes(drawing.type)) {
    context.globalAlpha = drawing.type === 'pencil' ? 0.65 : 1;
    context.beginPath();
    drawing.points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.stroke();
  } else if (drawing.type === 'line') {
    const [start, end] = drawing.points;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  } else if (drawing.type === 'rectangle') {
    const [start, end] = drawing.points;
    context.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else if (drawing.type === 'circle') {
    const [start, end] = drawing.points;
    const radius = distance(start, end);
    context.beginPath();
    context.arc(start.x, start.y, radius, 0, Math.PI * 2);
    context.stroke();
  }

  context.restore();
}

function drawSelection(drawing) {
  const bounds = getDrawingBounds(drawing);
  context.save();
  context.strokeStyle = '#111827';
  context.lineWidth = 3;
  context.setLineDash([10, 8]);
  context.strokeRect(bounds.x - 10, bounds.y - 10, bounds.width + 20, bounds.height + 20);
  context.restore();
}

function getDrawingBounds(drawing) {
  const xs = drawing.points.map((point) => point.x);
  const ys = drawing.points.map((point) => point.y);
  if (drawing.type === 'circle') {
    const [start, end] = drawing.points;
    const radius = distance(start, end);
    return { x: start.x - radius, y: start.y - radius, width: radius * 2, height: radius * 2 };
  }
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
    height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
  };
}

function updateAdminPanel() {
  const artists = new Set(state.drawings.map((drawing) => drawing.author.firstName));
  elements.strokeCount.textContent = state.drawings.length;
  elements.artistCount.textContent = artists.size;
  elements.historyList.innerHTML = '';

  [...state.drawings]
    .reverse()
    .slice(0, 60)
    .forEach((drawing) => {
      const item = document.createElement('li');
      const date = new Date(drawing.createdAt);
      item.innerHTML = `
        <button type="button" data-id="${drawing.id}">
          <strong>${escapeHtml(drawing.author.firstName)}</strong>
          <span>${escapeHtml(drawing.author.nickname)} · ${toolLabel(drawing.type)}</span>
          <time>${date.toLocaleString('fr-FR')}</time>
        </button>
      `;
      item.querySelector('button').addEventListener('click', () => {
        state.selectedDrawingId = drawing.id;
        render();
      });
      elements.historyList.appendChild(item);
    });
}

function toolLabel(type) {
  return {
    pen: 'stylo',
    pencil: 'crayon',
    bucket: 'pot de peinture',
    rectangle: 'rectangle',
    circle: 'cercle',
    line: 'ligne',
  }[type] || type;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));
}

function showNotice(message) {
  elements.canvasNotice.textContent = message;
  window.clearTimeout(showNotice.timeout);
  showNotice.timeout = window.setTimeout(() => {
    elements.canvasNotice.textContent = '';
  }, 2500);
}
