<?php
/**
 * Enregistre l'identité (prénom + pseudo) en session.
 * Renvoie le rôle : 'admin' ou 'passager'.
 * GET sans paramètre : renvoie l'identité courante (ou null).
 */
declare(strict_types=1);
require __DIR__ . '/config.php';
start_session();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $id = current_identity();
    json_out(['ok' => true, 'identity' => $id]);
}

$body   = read_json_body();
$prenom = trim((string)($body['prenom'] ?? ''));
$pseudo = trim((string)($body['pseudo'] ?? ''));

if ($prenom === '' || $pseudo === '') {
    json_error('Le prénom et le pseudo sont obligatoires.');
}
$prenom = mb_substr($prenom, 0, 100);
$pseudo = mb_substr($pseudo, 0, 100);

$isAdmin = is_admin_identity($prenom, $pseudo);

$_SESSION['prenom']   = $prenom;
$_SESSION['pseudo']   = $pseudo;
$_SESSION['is_admin'] = $isAdmin;

json_out([
    'ok'       => true,
    'identity' => [
        'prenom'   => $prenom,
        'pseudo'   => $pseudo,
        'is_admin' => $isAdmin,
    ],
    'role' => $isAdmin ? 'admin' : 'passager',
]);
