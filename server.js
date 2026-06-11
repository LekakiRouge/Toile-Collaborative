const http = require('node:http');
const { readFile, mkdir, rename, writeFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data', 'canvases');
const MAX_BODY_SIZE = 8 * 1024 * 1024;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);

    if (requestUrl.pathname.startsWith('/api/canvases/')) {
      await handleCanvasApi(request, response, requestUrl);
      return;
    }

    await serveStaticFile(response, requestUrl.pathname);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'Erreur interne du serveur.' });
  }
});

server.listen(PORT, () => {
  console.log(`Toile collaborative disponible sur http://localhost:${PORT}`);
});

async function handleCanvasApi(request, response, requestUrl) {
  const canvasId = sanitizeCanvasId(decodeURIComponent(requestUrl.pathname.replace('/api/canvases/', '')));

  if (!canvasId) {
    sendJson(response, 400, { error: 'Identifiant de toile invalide.' });
    return;
  }

  if (request.method === 'GET') {
    sendJson(response, 200, await readCanvas(canvasId));
    return;
  }

  if (request.method === 'PUT') {
    const body = await readJsonBody(request);
    const canvas = normalizeCanvasPayload(body);
    const savedCanvas = await writeCanvas(canvasId, canvas);
    sendJson(response, 200, savedCanvas);
    return;
  }

  response.setHeader('Allow', 'GET, PUT');
  sendJson(response, 405, { error: 'Méthode non autorisée.' });
}

async function serveStaticFile(response, pathname) {
  const safePathname = pathname === '/' ? '/index.html' : pathname;
  const requestedPath = path.normalize(decodeURIComponent(safePathname)).replace(/^\.\.(\/|\\|$)/, '');
  const filePath = path.join(PUBLIC_DIR, requestedPath);
  const relativePath = path.relative(PUBLIC_DIR, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath) || relativePath.startsWith('data')) {
    sendJson(response, 404, { error: 'Fichier introuvable.' });
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(file);
  } catch {
    const fallback = await readFile(path.join(PUBLIC_DIR, 'index.html'));
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(fallback);
  }
}

async function readCanvas(canvasId) {
  const filePath = getCanvasFilePath(canvasId);

  if (!existsSync(filePath)) {
    return { id: canvasId, drawings: [], updatedAt: null };
  }

  const rawCanvas = await readFile(filePath, 'utf8');
  return normalizeCanvasPayload(JSON.parse(rawCanvas), canvasId);
}

async function writeCanvas(canvasId, canvas) {
  await mkdir(DATA_DIR, { recursive: true });
  const payload = {
    id: canvasId,
    drawings: canvas.drawings,
    updatedAt: new Date().toISOString(),
  };
  const filePath = getCanvasFilePath(canvasId);
  const temporaryPath = `${filePath}.${process.pid}.tmp`;

  await writeFile(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);
  return payload;
}

function getCanvasFilePath(canvasId) {
  return path.join(DATA_DIR, `${canvasId}.json`);
}

function sanitizeCanvasId(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
}

function normalizeCanvasPayload(payload, fallbackId = null) {
  const drawings = Array.isArray(payload?.drawings) ? payload.drawings : [];

  return {
    id: sanitizeCanvasId(String(payload?.id || fallbackId || 'toile')) || 'toile',
    drawings: drawings
      .filter((drawing) => drawing && typeof drawing === 'object')
      .map((drawing) => ({
        id: String(drawing.id || randomUUID()),
        type: String(drawing.type || 'pen'),
        points: Array.isArray(drawing.points)
          ? drawing.points.map((point) => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 }))
          : [],
        color: String(drawing.color || '#111827'),
        size: Number(drawing.size) || 8,
        createdAt: String(drawing.createdAt || new Date().toISOString()),
        author: {
          firstName: String(drawing.author?.firstName || 'Anonyme').slice(0, 40),
          nickname: String(drawing.author?.nickname || 'passager').slice(0, 40),
        },
      })),
    updatedAt: payload?.updatedAt || null,
  };
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        request.destroy();
        reject(new Error('Payload trop volumineux.'));
      }
    });

    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}
