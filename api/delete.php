<?php
/**
 * POST { canvas, id } : supprime un élément (soft delete).
 * - L'admin peut supprimer n'importe quel élément.
 * - Un passager ne peut supprimer que SES éléments (même prénom + pseudo).
 */
declare(strict_types=1);
require __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Méthode non supportée.', 405);
}

$identity = current_identity();
if ($identity === null) {
    json_error('Identité requise.', 401);
}

$body = read_json_body();
$slug = trim((string)($body['canvas'] ?? ''));
$id   = (int)($body['id'] ?? 0);
$canvas = $slug !== '' ? find_canvas($slug) : null;
if (!$canvas || $id <= 0) {
    json_error('Requête invalide.');
}

$stmt = db()->prepare('SELECT * FROM strokes WHERE id = ? AND canvas_id = ? AND deleted = 0');
$stmt->execute([$id, $canvas['id']]);
$row = $stmt->fetch();
if (!$row) {
    json_error('Élément introuvable.', 404);
}

$owns = $row['prenom'] === $identity['prenom'] && $row['pseudo'] === $identity['pseudo'];
if (!$identity['is_admin'] && !$owns) {
    json_error('Vous ne pouvez modifier que vos propres dessins.', 403);
}

$upd = db()->prepare('UPDATE strokes SET deleted = 1 WHERE id = ?');
$upd->execute([$id]);

json_out(['ok' => true, 'id' => $id]);
