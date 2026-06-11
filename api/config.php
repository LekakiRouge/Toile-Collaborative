<?php
/**
 * Configuration centrale : connexion BDD, session, helpers JSON,
 * et détection de l'administrateur.
 *
 * Les identifiants de connexion sont lus depuis des variables
 * d'environnement si présentes, sinon des valeurs par défaut (dev local).
 * Pour la prod, définissez TOILE_DB_* dans l'environnement du serveur.
 */

declare(strict_types=1);

// ---- Identifiant administrateur (en dur, comme demandé) ----
const ADMIN_PRENOM = 'Khalil';
const ADMIN_PSEUDO = 'kaki1403';

// ---- Connexion BDD ----
function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $host = getenv('TOILE_DB_HOST') ?: '127.0.0.1';
    $name = getenv('TOILE_DB_NAME') ?: 'toile';
    $user = getenv('TOILE_DB_USER') ?: 'toile';
    $pass = getenv('TOILE_DB_PASS');
    if ($pass === false) {
        $pass = 'toile_dev_pw';
    }

    $dsn = "mysql:host={$host};dbname={$name};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

// ---- Session ----
function start_session(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

// ---- Identité courante ----
/** @return array{prenom:string,pseudo:string,is_admin:bool}|null */
function current_identity(): ?array
{
    start_session();
    if (empty($_SESSION['prenom']) || empty($_SESSION['pseudo'])) {
        return null;
    }
    return [
        'prenom'   => (string) $_SESSION['prenom'],
        'pseudo'   => (string) $_SESSION['pseudo'],
        'is_admin' => !empty($_SESSION['is_admin']),
    ];
}

function is_admin_identity(string $prenom, string $pseudo): bool
{
    return trim($prenom) === ADMIN_PRENOM && trim($pseudo) === ADMIN_PSEUDO;
}

// ---- Helpers de réponse JSON ----
function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $code = 400): void
{
    json_out(['ok' => false, 'error' => $message], $code);
}

/** Lit le corps JSON d'une requête POST. */
function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Récupère une toile par son slug. */
function find_canvas(string $slug): ?array
{
    $stmt = db()->prepare('SELECT * FROM canvases WHERE slug = ?');
    $stmt->execute([$slug]);
    $row = $stmt->fetch();
    return $row ?: null;
}
