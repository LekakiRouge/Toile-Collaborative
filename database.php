<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, DB_NAME, DB_CHARSET);
    $pdo = new PDO($dsn, DB_USER, DB_PASSWORD, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    ensure_canvas_table($pdo);

    return $pdo;
}

function ensure_canvas_table(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS canvases (
            id VARCHAR(40) NOT NULL PRIMARY KEY,
            drawings_json LONGTEXT NOT NULL,
            updated_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

function sanitize_canvas_id(string $value): string
{
    return substr(preg_replace('/[^a-zA-Z0-9_-]/', '', $value) ?? '', 0, 40) ?: 'toile';
}

function fetch_canvas(string $canvasId): array
{
    $statement = db()->prepare('SELECT drawings_json, updated_at FROM canvases WHERE id = :id');
    $statement->execute(['id' => $canvasId]);
    $row = $statement->fetch();

    if (!$row) {
        return ['id' => $canvasId, 'drawings' => [], 'updatedAt' => null];
    }

    $drawings = json_decode((string) $row['drawings_json'], true);

    return [
        'id' => $canvasId,
        'drawings' => normalize_drawings(is_array($drawings) ? $drawings : []),
        'updatedAt' => mysql_datetime_to_iso((string) $row['updated_at']),
    ];
}

function save_canvas(string $canvasId, array $drawings): array
{
    $normalizedDrawings = normalize_drawings($drawings);
    $drawingsJson = json_encode($normalizedDrawings, JSON_UNESCAPED_UNICODE);

    if ($drawingsJson === false) {
        throw new RuntimeException('Impossible d’encoder les dessins.');
    }

    $updatedAt = gmdate('Y-m-d H:i:s');
    $statement = db()->prepare(
        'INSERT INTO canvases (id, drawings_json, updated_at)
         VALUES (:id, :drawings_json, :updated_at)
         ON DUPLICATE KEY UPDATE drawings_json = VALUES(drawings_json), updated_at = VALUES(updated_at)'
    );
    $statement->execute([
        'id' => $canvasId,
        'drawings_json' => $drawingsJson,
        'updated_at' => $updatedAt,
    ]);

    return [
        'id' => $canvasId,
        'drawings' => $normalizedDrawings,
        'updatedAt' => mysql_datetime_to_iso($updatedAt),
    ];
}

function normalize_drawings(array $drawings): array
{
    return array_values(array_map(
        static fn (array $drawing): array => normalize_drawing($drawing),
        array_filter($drawings, static fn ($drawing): bool => is_array($drawing))
    ));
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
            'firstName' => mb_substr((string) ($author['firstName'] ?? 'Anonyme'), 0, 40),
            'nickname' => mb_substr((string) ($author['nickname'] ?? 'passager'), 0, 40),
        ],
    ];
}

function mysql_datetime_to_iso(string $datetime): string
{
    $date = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $datetime, new DateTimeZone('UTC'));

    return $date ? $date->format(DateTimeInterface::ATOM) : $datetime;
}
