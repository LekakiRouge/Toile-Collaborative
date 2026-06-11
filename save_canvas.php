<?php

declare(strict_types=1);

require_once __DIR__ . '/database.php';

const MAX_BODY_SIZE = 8388608;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Méthode non autorisée.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $body = (string) ($_POST['payload'] ?? '');
    if ($body === '') {
        $body = file_get_contents('php://input', false, null, 0, MAX_BODY_SIZE + 1);
    }

    if ($body === false || strlen($body) > MAX_BODY_SIZE) {
        http_response_code(413);
        echo json_encode(['error' => 'Payload trop volumineux.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $payload = json_decode($body === '' ? '{}' : $body, true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['error' => 'JSON invalide.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $canvasId = sanitize_canvas_id((string) ($payload['id'] ?? ''));
    $drawings = is_array($payload['drawings'] ?? null) ? $payload['drawings'] : [];

    echo json_encode(save_canvas($canvasId, $drawings), JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log($error->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Impossible de sauvegarder la toile dans MySQL.'], JSON_UNESCAPED_UNICODE);
}
