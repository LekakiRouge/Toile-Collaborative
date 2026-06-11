<?php
/**
 * GET  ?canvas=slug[&since=ID] : synchronisation des éléments.
 *      -> { ids:[...], new:[...elements...] }
 *      'ids' = tous les ids actuellement visibles (pour détecter les suppressions)
 *      'new' = éléments complets dont l'id > since (nouveaux dessins)
 *
 * POST { canvas, tool, data } : ajoute un élément. Nécessite une identité.
 *      -> { id, element }
 *
 * Les champs d'auteur (prénom, horodatage) ne sont renvoyés que pour l'admin.
 * Pour un passager, chaque élément porte juste un drapeau 'mine'.
 */
declare(strict_types=1);
require __DIR__ . '/config.php';

const ALLOWED_TOOLS = ['pen', 'pencil', 'line', 'rect', 'circle', 'triangle', 'fill'];

$identity = current_identity();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $slug = trim((string)($_GET['canvas'] ?? ''));
    $canvas = $slug !== '' ? find_canvas($slug) : null;
    if (!$canvas) {
        json_error('Toile introuvable.', 404);
    }
    $since = (int)($_GET['since'] ?? 0);
    $isAdmin = $identity['is_admin'] ?? false;

    // Tous les ids encore visibles (léger, sert à détecter les suppressions).
    $stmt = db()->prepare(
        'SELECT id FROM strokes WHERE canvas_id = ? AND deleted = 0 ORDER BY id ASC'
    );
    $stmt->execute([$canvas['id']]);
    $ids = array_map('intval', array_column($stmt->fetchAll(), 'id'));

    // Nouveaux éléments depuis `since`.
    $stmt = db()->prepare(
        'SELECT * FROM strokes WHERE canvas_id = ? AND deleted = 0 AND id > ? ORDER BY id ASC'
    );
    $stmt->execute([$canvas['id'], $since]);
    $rows = $stmt->fetchAll();

    $new = [];
    foreach ($rows as $r) {
        $el = [
            'id'   => (int)$r['id'],
            'tool' => $r['tool'],
            'data' => json_decode($r['data'], true),
            'mine' => $identity !== null
                && $r['prenom'] === $identity['prenom']
                && $r['pseudo'] === $identity['pseudo'],
        ];
        if ($isAdmin) {
            $el['prenom']     = $r['prenom'];
            $el['pseudo']     = $r['pseudo'];
            $el['created_at'] = $r['created_at'];
        }
        $new[] = $el;
    }

    json_out(['ok' => true, 'ids' => $ids, 'new' => $new]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($identity === null) {
        json_error('Vous devez renseigner votre prénom et pseudo avant de dessiner.', 401);
    }
    $body = read_json_body();
    $slug = trim((string)($body['canvas'] ?? ''));
    $canvas = $slug !== '' ? find_canvas($slug) : null;
    if (!$canvas) {
        json_error('Toile introuvable.', 404);
    }
    $tool = (string)($body['tool'] ?? '');
    if (!in_array($tool, ALLOWED_TOOLS, true)) {
        json_error('Outil invalide.');
    }
    $data = $body['data'] ?? null;
    if (!is_array($data)) {
        json_error('Données du dessin manquantes.');
    }
    $encoded = json_encode($data, JSON_UNESCAPED_UNICODE);
    if ($encoded === false || strlen($encoded) > 5_000_000) {
        json_error('Données du dessin invalides ou trop volumineuses.');
    }

    $stmt = db()->prepare(
        'INSERT INTO strokes (canvas_id, prenom, pseudo, tool, data) VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $canvas['id'],
        $identity['prenom'],
        $identity['pseudo'],
        $tool,
        $encoded,
    ]);
    $id = (int) db()->lastInsertId();

    $el = ['id' => $id, 'tool' => $tool, 'data' => $data, 'mine' => true];
    if ($identity['is_admin']) {
        $el['prenom']     = $identity['prenom'];
        $el['pseudo']     = $identity['pseudo'];
        $el['created_at'] = date('Y-m-d H:i:s');
    }
    json_out(['ok' => true, 'id' => $id, 'element' => $el]);
}

json_error('Méthode non supportée.', 405);
