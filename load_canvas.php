<?php

declare(strict_types=1);

require_once __DIR__ . '/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    $canvasId = sanitize_canvas_id((string) ($_GET['toile'] ?? ''));
    echo json_encode(fetch_canvas($canvasId), JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log($error->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Impossible de charger la toile depuis MySQL.'], JSON_UNESCAPED_UNICODE);
}
