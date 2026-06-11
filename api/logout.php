<?php
/** Oublie l'identité courante (changer de prénom/pseudo). */
declare(strict_types=1);
require __DIR__ . '/config.php';
start_session();
$_SESSION = [];
json_out(['ok' => true]);
