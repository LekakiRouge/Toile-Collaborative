const ADMIN_FIRST_NAME = 'Khalil';
const ADMIN_NICKNAME = 'kaki1403';
const MIN_ZOOM = 0.18;
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.2;
const EXPORT_MAX_SIZE = 4096;

const state = {
  canvasId: window.TOILE_BOOTSTRAP?.canvas?.id || getCanvasId(),
  identity: null,
  role: 'passenger',
  tool: 'pen',
  color: '#5b5cf6',
  size: 8,
  drawings: [],
  lastUpdatedAt: null,
  draft: null,
  selectedDrawingId: null,
  isSpacePressed: false,
  viewport: {
    x: -200,
    y: -120,
    zoom: 1,
  },
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
  zoomOutButton: document.querySelector('#zoomOutButton'),
  zoomInButton: document.querySelector('#zoomInButton'),
  zoomResetButton: document.querySelector('#zoomResetButton'),
  zoomLabel: document.querySelector('#zoomLabel'),
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
const syncUrls = window.TOILE_BOOTSTRAP?.syncUrls || {};

init();

async function init() {
  hydrateFromBootstrap();
  resizeCanvas();
  elements.canvasIdLabel.textContent = state.canvasId;

  if (window.TOILE_BOOTSTRAP?.error) {
    showNotice(window.TOILE_BOOTSTRAP.error, 6000);
  } else {
    await refreshDrawingsFromServer();
  }

  const savedIdentity = loadIdentity();
  if (savedIdentity) startSession(savedIdentity);

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
  elements.zoomOutButton.addEventListener('click', () => zoomAtCenter(1 / ZOOM_STEP));
  elements.zoomInButton.addEventListener('click', () => zoomAtCenter(ZOOM_STEP));
  elements.zoomResetButton.addEventListener('click', resetZoom);
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
  elements.drawingCanvas.addEventListener('pointercancel', handlePointerUp);
  elements.drawingCanvas.addEventListener('pointerleave', handlePointerUp);
  elements.drawingCanvas.addEventListener('wheel', handleWheel, { passive: false });
  elements.drawingCanvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('resize', () => {
    resizeCanvas();
    render();
  });

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      resizeCanvas();
      render();
    }).observe(elements.drawingCanvas.parentElement);
  }

  window.setInterval(refreshDrawingsFromServer, 2500);
  render();
}

function getCanvasId() {
  const params = new URLSearchParams(window.location.search);
  const existingId = params.get('toile');
  if (existingId) return sanitizeCanvasId(existingId);

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

function hydrateFromBootstrap() {
  const canvas = window.TOILE_BOOTSTRAP?.canvas;
  if (!canvas) return;

  state.drawings = Array.isArray(canvas.drawings) ? canvas.drawings : [];
  state.lastUpdatedAt = canvas.updatedAt || null;
}

function buildScriptUrl(scriptName, params = {}) {
  const configuredUrl = syncUrls[scriptName.replace('_canvas.php', '')] || scriptName;
  const url = new URL(configuredUrl, window.location.href);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

async function refreshDrawingsFromServer() {
  if (state.draft) return;

  try {
    const canvas = await requestCanvas();
    if (canvas.error) throw new Error(canvas.error);
    if (canvas.updatedAt !== state.lastUpdatedAt || state.drawings.length !== canvas.drawings.length) {
      state.drawings = Array.isArray(canvas.drawings) ? canvas.drawings : [];
      state.lastUpdatedAt = canvas.updatedAt || null;
      render();
    }
  } catch (error) {
    showNotice(`Synchronisation impossible : ${error.message}`);
  }
}

async function requestCanvas() {
  const response = await fetch(buildScriptUrl('load_canvas.php', { toile: state.canvasId }), {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

async function saveDrawings() {
  try {
    const formData = new FormData();
    formData.append('payload', JSON.stringify({ id: state.canvasId, drawings: state.drawings }));

    const response = await fetch(buildScriptUrl('save_canvas.php'), {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      body: formData,
    });
    const canvas = await readJsonResponse(response);

    if (!response.ok) throw new Error(canvas.error || `HTTP ${response.status}`);
    state.lastUpdatedAt = canvas.updatedAt || null;
    state.drawings = Array.isArray(canvas.drawings) ? canvas.drawings : state.drawings;
  } catch (error) {
    showNotice(`Sauvegarde impossible : ${error.message}`, 4500);
  } finally {
    render();
  }
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: `Réponse PHP invalide (${response.status})` };
  }
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
  resizeCanvas();
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

  if (shouldPan(event)) {
    state.draft = { mode: 'pan', lastScreen: getScreenPoint(event) };
    elements.drawingCanvas.classList.add('is-panning');
    return;
  }

  const point = getCanvasPoint(event);

  if (state.tool === 'bucket') {
    addDrawing({ type: 'bucket', points: [], color: state.color, size: 0 });
    showNotice('Couleur de fond appliquée à la toile infinie.');
    return;
  }

  if (state.tool === 'eraser') {
    eraseAt(point);
    return;
  }

  const editableDrawing = findEditableDrawingAt(point);
  if (editableDrawing) {
    state.selectedDrawingId = editableDrawing.id;
    state.draft = { mode: 'move', drawing: structuredClone(editableDrawing), lastPoint: point };
    return;
  }

  const drawing = createBaseDrawing(point);
  state.draft = { mode: 'draw', drawing };
}

function handlePointerMove(event) {
  if (!state.draft) return;

  if (state.draft.mode === 'pan') {
    const screen = getScreenPoint(event);
    const dx = screen.x - state.draft.lastScreen.x;
    const dy = screen.y - state.draft.lastScreen.y;
    state.viewport.x -= dx / state.viewport.zoom;
    state.viewport.y -= dy / state.viewport.zoom;
    state.draft.lastScreen = screen;
    render();
    return;
  }

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

  if (state.draft.mode === 'pan') {
    elements.drawingCanvas.classList.remove('is-panning');
  } else if (state.draft.mode === 'move') {
    saveDrawings();
    showNotice('Dessin déplacé.');
  } else if (state.draft.drawing.points.length > 1 || ['rectangle', 'circle', 'line'].includes(state.draft.drawing.type)) {
    state.drawings.push(state.draft.drawing);
    saveDrawings();
  }

  state.draft = null;
  render();
}

function shouldPan(event) {
  return state.tool === 'pan' || state.isSpacePressed || event.button === 1 || event.button === 2;
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
    .findIndex((drawing) => canEdit(drawing) && drawing.type !== 'bucket' && isPointInDrawing(point, drawing));
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
  return [...state.drawings]
    .reverse()
    .find((drawing) => canEdit(drawing) && drawing.type !== 'bucket' && isPointInDrawing(point, drawing));
}

function getScreenPoint(event) {
  const rect = elements.drawingCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function getCanvasPoint(event) {
  return screenToWorld(getScreenPoint(event));
}

function screenToWorld(point) {
  return {
    x: point.x / state.viewport.zoom + state.viewport.x,
    y: point.y / state.viewport.zoom + state.viewport.y,
  };
}

function worldToScreen(point) {
  return {
    x: (point.x - state.viewport.x) * state.viewport.zoom,
    y: (point.y - state.viewport.y) * state.viewport.zoom,
  };
}

function translateDrawing(drawing, dx, dy) {
  return {
    ...drawing,
    points: drawing.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
  };
}

function isPointInDrawing(point, drawing) {
  const tolerance = Math.max(12, drawing.size + 8) / state.viewport.zoom;
  if (['pen', 'pencil', 'line'].includes(drawing.type)) {
    return isPointNearPolyline(point, drawing.points, tolerance);
  }

  const bounds = getDrawingBounds(drawing);
  return (
    point.x >= bounds.x - tolerance
    && point.x <= bounds.x + bounds.width + tolerance
    && point.y >= bounds.y - tolerance
    && point.y <= bounds.y + bounds.height + tolerance
  );
}

function isPointNearPolyline(point, points, tolerance) {
  if (points.length === 1) return distance(point, points[0]) <= tolerance;

  return points.some((drawPoint, index) => {
    if (index === 0) return false;
    return distanceToSegment(point, points[index - 1], drawPoint) <= tolerance;
  });
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return distance(point, start);

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return distance(point, { x: start.x + t * dx, y: start.y + t * dy });
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

  const { bounds, scale } = getExportSettings();
  const exportCanvasElement = document.createElement('canvas');
  exportCanvasElement.width = Math.max(1, Math.round(bounds.width * scale));
  exportCanvasElement.height = Math.max(1, Math.round(bounds.height * scale));
  const exportContext = exportCanvasElement.getContext('2d');

  drawScene(exportContext, {
    x: bounds.x,
    y: bounds.y,
    zoom: scale,
    screenWidth: exportCanvasElement.width,
    screenHeight: exportCanvasElement.height,
    showGrid: false,
    showSelection: false,
  });

  const link = document.createElement('a');
  link.download = `toile-${state.canvasId}.png`;
  link.href = exportCanvasElement.toDataURL('image/png');
  link.click();
}

function getExportSettings() {
  const bounds = getContentBounds();
  const scale = Math.min(1, EXPORT_MAX_SIZE / Math.max(bounds.width, bounds.height));
  return { bounds, scale };
}

function getContentBounds() {
  const drawableBounds = state.drawings
    .filter((drawing) => drawing.type !== 'bucket' && drawing.points.length)
    .map((drawing) => getDrawingBounds(drawing));

  if (!drawableBounds.length) {
    return {
      x: state.viewport.x,
      y: state.viewport.y,
      width: elements.drawingCanvas.clientWidth / state.viewport.zoom,
      height: elements.drawingCanvas.clientHeight / state.viewport.zoom,
    };
  }

  const minX = Math.min(...drawableBounds.map((bounds) => bounds.x));
  const minY = Math.min(...drawableBounds.map((bounds) => bounds.y));
  const maxX = Math.max(...drawableBounds.map((bounds) => bounds.x + bounds.width));
  const maxY = Math.max(...drawableBounds.map((bounds) => bounds.y + bounds.height));
  const padding = 120;

  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(1, maxX - minX + padding * 2),
    height: Math.max(1, maxY - minY + padding * 2),
  };
}

function resizeCanvas() {
  const rect = elements.drawingCanvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width * pixelRatio));
  const height = Math.max(320, Math.floor(rect.height * pixelRatio));

  if (elements.drawingCanvas.width !== width || elements.drawingCanvas.height !== height) {
    elements.drawingCanvas.width = width;
    elements.drawingCanvas.height = height;
  }
}

function render(showSelection = true) {
  drawCanvas(showSelection);
  updateZoomLabel();
  updateAdminPanel();
}

function drawCanvas(showSelection) {
  const pixelRatio = window.devicePixelRatio || 1;
  const screenWidth = elements.drawingCanvas.width / pixelRatio;
  const screenHeight = elements.drawingCanvas.height / pixelRatio;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawScene(context, {
    ...state.viewport,
    screenWidth,
    screenHeight,
    showGrid: true,
    showSelection,
  });
}

function drawScene(ctx, viewport) {
  const backgroundColor = getCanvasBackgroundColor();
  ctx.clearRect(0, 0, viewport.screenWidth, viewport.screenHeight);
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, viewport.screenWidth, viewport.screenHeight);

  if (viewport.showGrid) drawGrid(ctx, viewport);

  ctx.save();
  ctx.translate(-viewport.x * viewport.zoom, -viewport.y * viewport.zoom);
  ctx.scale(viewport.zoom, viewport.zoom);

  state.drawings.forEach((drawing) => drawDrawing(ctx, drawing));
  if (state.draft?.mode === 'draw') drawDrawing(ctx, state.draft.drawing);

  if (viewport.showSelection && state.selectedDrawingId) {
    const drawing = state.drawings.find((item) => item.id === state.selectedDrawingId);
    if (drawing && drawing.type !== 'bucket') drawSelection(ctx, drawing, viewport.zoom);
  }

  ctx.restore();
}

function getCanvasBackgroundColor() {
  const bucket = [...state.drawings].reverse().find((drawing) => drawing.type === 'bucket');
  return bucket?.color || '#ffffff';
}

function drawGrid(ctx, viewport) {
  const gridSize = chooseGridSize(viewport.zoom);
  const startX = Math.floor(viewport.x / gridSize) * gridSize;
  const endX = viewport.x + viewport.screenWidth / viewport.zoom;
  const startY = Math.floor(viewport.y / gridSize) * gridSize;
  const endY = viewport.y + viewport.screenHeight / viewport.zoom;

  ctx.save();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = startX; x <= endX; x += gridSize) {
    const screen = worldToScreenWithViewport({ x, y: 0 }, viewport).x;
    ctx.moveTo(screen, 0);
    ctx.lineTo(screen, viewport.screenHeight);
  }

  for (let y = startY; y <= endY; y += gridSize) {
    const screen = worldToScreenWithViewport({ x: 0, y }, viewport).y;
    ctx.moveTo(0, screen);
    ctx.lineTo(viewport.screenWidth, screen);
  }

  ctx.stroke();
  ctx.restore();
}

function chooseGridSize(zoom) {
  if (zoom < 0.35) return 400;
  if (zoom < 0.7) return 200;
  if (zoom > 2.5) return 25;
  return 100;
}

function worldToScreenWithViewport(point, viewport) {
  return {
    x: (point.x - viewport.x) * viewport.zoom,
    y: (point.y - viewport.y) * viewport.zoom,
  };
}

function drawDrawing(ctx, drawing) {
  if (drawing.type === 'bucket') return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = drawing.color;
  ctx.fillStyle = drawing.color;
  ctx.lineWidth = drawing.size;

  if (['pen', 'pencil'].includes(drawing.type)) {
    ctx.globalAlpha = drawing.type === 'pencil' ? 0.65 : 1;
    ctx.beginPath();
    drawing.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  } else if (drawing.type === 'line') {
    const [start, end] = drawing.points;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  } else if (drawing.type === 'rectangle') {
    const [start, end] = drawing.points;
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else if (drawing.type === 'circle') {
    const [start, end] = drawing.points;
    const radius = distance(start, end);
    ctx.beginPath();
    ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSelection(ctx, drawing, zoom) {
  const bounds = getDrawingBounds(drawing);
  ctx.save();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3 / zoom;
  ctx.setLineDash([10 / zoom, 8 / zoom]);
  ctx.strokeRect(bounds.x - 10 / zoom, bounds.y - 10 / zoom, bounds.width + 20 / zoom, bounds.height + 20 / zoom);
  ctx.restore();
}

function getDrawingBounds(drawing) {
  if (!drawing.points.length) return { x: 0, y: 0, width: 1, height: 1 };

  if (drawing.type === 'circle') {
    const [start, end] = drawing.points;
    const radius = distance(start, end);
    return { x: start.x - radius, y: start.y - radius, width: radius * 2, height: radius * 2 };
  }

  const xs = drawing.points.map((point) => point.x);
  const ys = drawing.points.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
    height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
  };
}

function handleWheel(event) {
  event.preventDefault();
  const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
  zoomAtPoint(factor, getScreenPoint(event));
}

function zoomAtCenter(factor) {
  zoomAtPoint(factor, {
    x: elements.drawingCanvas.clientWidth / 2,
    y: elements.drawingCanvas.clientHeight / 2,
  });
}

function zoomAtPoint(factor, screenPoint) {
  const before = screenToWorld(screenPoint);
  state.viewport.zoom = clamp(state.viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  state.viewport.x = before.x - screenPoint.x / state.viewport.zoom;
  state.viewport.y = before.y - screenPoint.y / state.viewport.zoom;
  render();
}

function resetZoom() {
  state.viewport.zoom = 1;
  state.viewport.x = -200;
  state.viewport.y = -120;
  render();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function updateZoomLabel() {
  elements.zoomLabel.textContent = `${Math.round(state.viewport.zoom * 100)}%`;
}

function handleKeyDown(event) {
  if (event.code === 'Space' && !isTypingTarget(event.target)) {
    state.isSpacePressed = true;
    elements.drawingCanvas.classList.add('is-pan-ready');
    event.preventDefault();
  }
}

function handleKeyUp(event) {
  if (event.code === 'Space') {
    state.isSpacePressed = false;
    elements.drawingCanvas.classList.remove('is-pan-ready');
  }
}

function isTypingTarget(target) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
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
        if (drawing.type !== 'bucket') {
          centerOnDrawing(drawing);
          state.selectedDrawingId = drawing.id;
        }
        render();
      });
      elements.historyList.appendChild(item);
    });
}

function centerOnDrawing(drawing) {
  const bounds = getDrawingBounds(drawing);
  state.viewport.x = bounds.x + bounds.width / 2 - elements.drawingCanvas.clientWidth / state.viewport.zoom / 2;
  state.viewport.y = bounds.y + bounds.height / 2 - elements.drawingCanvas.clientHeight / state.viewport.zoom / 2;
}

function toolLabel(type) {
  return {
    pen: 'stylo',
    pencil: 'crayon',
    bucket: 'fond de toile',
    pan: 'déplacement',
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

function showNotice(message, duration = 2500) {
  elements.canvasNotice.textContent = message;
  window.clearTimeout(showNotice.timeout);
  showNotice.timeout = window.setTimeout(() => {
    elements.canvasNotice.textContent = '';
  }, duration);
}
