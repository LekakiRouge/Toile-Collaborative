<?php
/** Crée une nouvelle toile et renvoie son slug (lien de partage). */
declare(strict_types=1);
require __DIR__ . '/config.php';

$body = read_json_body();
$name = trim((string)($body['name'] ?? ''));
if ($name === '') {
    $name = 'Toile collaborative';
}
$name = mb_substr($name, 0, 255);

$width  = (int)($body['width'] ?? 1600);
$height = (int)($body['height'] ?? 900);
$width  = max(400, min(6000, $width));
$height = max(300, min(6000, $height));

$bg = (string)($body['bg_color'] ?? '#ffffff');
if (!preg_match('/^#[0-9a-fA-F]{6}$/', $bg)) {
    $bg = '#ffffff';
}

// slug aléatoire et unique
do {
    $slug = substr(bin2hex(random_bytes(8)), 0, 12);
    $exists = find_canvas($slug);
} while ($exists !== null);

$stmt = db()->prepare(
    'INSERT INTO canvases (slug, name, width, height, bg_color) VALUES (?, ?, ?, ?, ?)'
);
$stmt->execute([$slug, $name, $width, $height, $bg]);

json_out(['ok' => true, 'slug' => $slug, 'name' => $name]);
