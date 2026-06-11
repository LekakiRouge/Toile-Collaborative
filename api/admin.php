<?php
/**
 * GET ?canvas=slug : données réservées à l'admin.
 * Renvoie la liste des contributions (prénom, pseudo, outil, horodatage)
 * et un résumé par contributeur.
 */
declare(strict_types=1);
require __DIR__ . '/config.php';

$identity = current_identity();
if ($identity === null || !$identity['is_admin']) {
    json_error('Accès réservé à l\'administrateur.', 403);
}

$slug = trim((string)($_GET['canvas'] ?? ''));
$canvas = $slug !== '' ? find_canvas($slug) : null;
if (!$canvas) {
    json_error('Toile introuvable.', 404);
}

$stmt = db()->prepare(
    'SELECT id, prenom, pseudo, tool, created_at, deleted
     FROM strokes WHERE canvas_id = ? ORDER BY id DESC'
);
$stmt->execute([$canvas['id']]);
$rows = $stmt->fetchAll();

$contribs = [];
foreach ($rows as $r) {
    $key = $r['prenom'] . '|' . $r['pseudo'];
    if (!isset($contribs[$key])) {
        $contribs[$key] = [
            'prenom' => $r['prenom'],
            'pseudo' => $r['pseudo'],
            'count'  => 0,
            'last'   => $r['created_at'],
        ];
    }
    if (!$r['deleted']) {
        $contribs[$key]['count']++;
    }
}

json_out([
    'ok'           => true,
    'canvas'       => ['name' => $canvas['name'], 'slug' => $canvas['slug']],
    'events'       => array_map(static function ($r) {
        return [
            'id'         => (int)$r['id'],
            'prenom'     => $r['prenom'],
            'pseudo'     => $r['pseudo'],
            'tool'       => $r['tool'],
            'created_at' => $r['created_at'],
            'deleted'    => (bool)$r['deleted'],
        ];
    }, $rows),
    'contributors' => array_values($contribs),
]);
