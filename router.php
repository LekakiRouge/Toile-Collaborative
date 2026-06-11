<?php

declare(strict_types=1);

const DATA_DIR = __DIR__ . '/data/canvases';
const MAX_BODY_SIZE = 8388608;

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

try {
    if (str_starts_with($path, '/api/canvases/')) {
        handle_canvas_api($path);
        return;
    }

    serve_static_file($path);
} catch (Throwable $error) {
    error_log($error->getMessage());
    send_json(500, ['error' => 'Erreur interne du serveur.']);
}

function handle_canvas_api(string $path): void
{
    $canvasId = sanitize_canvas_id(rawurldecode(substr($path, strlen('/api/canvases/'))));

    if ($canvasId === '') {
        send_json(400, ['error' => 'Identifiant de toile invalide.']);
        return;
    }

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        send_json(200, read_canvas($canvasId));
        return;
    }

    if ($method === 'PUT') {
        $payload = read_json_body();
        $canvas = normalize_canvas_payload($payload, $canvasId);
        send_json(200, write_canvas($canvasId, $canvas));
        return;
    }

    header('Allow: GET, PUT');
    send_json(405, ['error' => 'Méthode non autorisée.']);
}

function serve_static_file(string $path): void
{
    $safePath = $path === '/' ? '/index.html' : $path;
    $decodedPath = rawurldecode($safePath);
    $normalizedPath = preg_replace('#/+#', '/', $decodedPath) ?: '/index.html';
    $filePath = realpath(__DIR__ . $normalizedPath);
    $publicRoot = realpath(__DIR__);
    $dataRoot = realpath(__DIR__ . '/data');

    if (
        $filePath === false
        || $publicRoot === false
        || !str_starts_with($filePath, $publicRoot)
        || ($dataRoot !== false && str_starts_with($filePath, $dataRoot))
        || is_dir($filePath)
    ) {
        $filePath = __DIR__ . '/index.html';
    }

    $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $mimeTypes = [
        'html' => 'text/html; charset=utf-8',
        'js' => 'text/javascript; charset=utf-8',
        'css' => 'text/css; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'ico' => 'image/x-icon',
    ];

    if (!isset($mimeTypes[$extension])) {
        send_json(404, ['error' => 'Fichier introuvable.']);
        return;
    }

    header('Content-Type: ' . $mimeTypes[$extension]);
    header('Cache-Control: no-store');
    readfile($filePath);
}

function read_canvas(string $canvasId): array
{
    $filePath = canvas_file_path($canvasId);

    if (!is_file($filePath)) {
        return ['id' => $canvasId, 'drawings' => [], 'updatedAt' => null];
    }

    $rawCanvas = file_get_contents($filePath);
    $payload = json_decode($rawCanvas === false ? '{}' : $rawCanvas, true);

    return normalize_canvas_payload(is_array($payload) ? $payload : [], $canvasId);
}

function write_canvas(string $canvasId, array $canvas): array
{
    if (!is_dir(DATA_DIR) && !mkdir(DATA_DIR, 0775, true) && !is_dir(DATA_DIR)) {
        throw new RuntimeException('Impossible de créer le dossier de stockage.');
    }

    $payload = [
        'id' => $canvasId,
        'drawings' => $canvas['drawings'],
        'updatedAt' => gmdate('c'),
    ];

    $filePath = canvas_file_path($canvasId);
    $temporaryPath = $filePath . '.' . getmypid() . '.tmp';
    $encodedPayload = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    if ($encodedPayload === false || file_put_contents($temporaryPath, $encodedPayload . PHP_EOL, LOCK_EX) === false) {
        throw new RuntimeException('Impossible d’écrire la toile temporaire.');
    }

    if (!rename($temporaryPath, $filePath)) {
        @unlink($temporaryPath);
        throw new RuntimeException('Impossible d’enregistrer la toile.');
    }

    return $payload;
}

function canvas_file_path(string $canvasId): string
{
    return DATA_DIR . '/' . $canvasId . '.json';
}

function sanitize_canvas_id(string $value): string
{
    return substr(preg_replace('/[^a-zA-Z0-9_-]/', '', $value) ?? '', 0, 40);
}

function normalize_canvas_payload(array $payload, ?string $fallbackId = null): array
{
    $drawings = is_array($payload['drawings'] ?? null) ? $payload['drawings'] : [];

    return [
        'id' => sanitize_canvas_id((string) ($payload['id'] ?? $fallbackId ?? 'toile')) ?: 'toile',
        'drawings' => array_values(array_map(
            static fn (array $drawing): array => normalize_drawing($drawing),
            array_filter($drawings, static fn ($drawing): bool => is_array($drawing))
        )),
        'updatedAt' => $payload['updatedAt'] ?? null,
    ];
}

function normalize_drawing(array $drawing): array
{
    $points = is_array($drawing['points'] ?? null) ? $drawing['points'] : [];
    $author = is_array($drawing['author'] ?? null) ? $drawing['author'] : [];

    return [
        'id' => (string) ($drawing['id'] ?? bin2hex(random_bytes(16))),
        'type' => (string) ($drawing['type'] ?? 'pen'),
        'points' => array_values(array_map(
            static fn (array $point): array => [
                'x' => (float) ($point['x'] ?? 0),
                'y' => (float) ($point['y'] ?? 0),
            ],
            array_filter($points, static fn ($point): bool => is_array($point))
        )),
        'color' => (string) ($drawing['color'] ?? '#111827'),
        'size' => (float) ($drawing['size'] ?? 8),
        'createdAt' => (string) ($drawing['createdAt'] ?? gmdate('c')),
        'author' => [
            'firstName' => substr((string) ($author['firstName'] ?? 'Anonyme'), 0, 40),
            'nickname' => substr((string) ($author['nickname'] ?? 'passager'), 0, 40),
        ],
    ];
}

function read_json_body(): array
{
    $body = file_get_contents('php://input', false, null, 0, MAX_BODY_SIZE + 1);

    if ($body === false) {
        throw new RuntimeException('Corps de requête illisible.');
    }

    if (strlen($body) > MAX_BODY_SIZE) {
        send_json(413, ['error' => 'Payload trop volumineux.']);
        exit;
    }

    $payload = json_decode($body === '' ? '{}' : $body, true);

    if (!is_array($payload)) {
        send_json(400, ['error' => 'JSON invalide.']);
        exit;
    }

    return $payload;
}

function send_json(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
}
