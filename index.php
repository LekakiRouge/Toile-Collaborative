<?php

declare(strict_types=1);

require_once __DIR__ . '/database.php';

$canvasId = sanitize_canvas_id((string) ($_GET['toile'] ?? ''));
if (!isset($_GET['toile']) || $canvasId === 'toile') {
    $canvasId = bin2hex(random_bytes(4));
    header('Location: ?toile=' . rawurlencode($canvasId));
    exit;
}

$initialCanvas = ['id' => $canvasId, 'drawings' => [], 'updatedAt' => null];
$initialError = null;

try {
    $initialCanvas = fetch_canvas($canvasId);
} catch (Throwable $error) {
    error_log($error->getMessage());
    $initialError = 'Connexion MySQL impossible. Vérifie config.php et la base de données.';
}
?>
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Toile collaborative</title>
    <script>
      window.TOILE_BOOTSTRAP = <?= json_encode(['canvas' => $initialCanvas, 'error' => $initialError], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?>;
    </script>
    <link rel="stylesheet" href="./src/styles.css" />
  </head>
  <body>
    <main class="app-shell">
      <section id="loginPanel" class="login-panel" aria-labelledby="loginTitle">
        <div class="login-card">
          <p class="eyebrow">Grande toile collaborative</p>
          <h1 id="loginTitle">Entre dans la toile</h1>
          <p>
            Chaque lien représente une toile différente. Indique ton prénom et ton pseudo avant de dessiner.
          </p>
          <form id="identityForm" class="identity-form">
            <label>
              Prénom
              <input id="firstNameInput" name="firstName" required maxlength="40" autocomplete="given-name" placeholder="Ex : Inès" />
            </label>
            <label>
              Pseudo
              <input id="nicknameInput" name="nickname" required maxlength="40" autocomplete="nickname" placeholder="Ex : artiste42" />
            </label>
            <button type="submit">Rejoindre la toile</button>
          </form>
          <p class="hint">Admin : prénom <strong>Khalil</strong> + pseudo <strong>kaki1403</strong>.</p>
        </div>
      </section>

      <section id="canvasPanel" class="canvas-panel is-hidden" aria-label="Toile collaborative">
        <header class="topbar">
          <div>
            <p class="eyebrow">Toile <span id="canvasIdLabel"></span></p>
            <h1>Atelier collaboratif</h1>
          </div>
          <div class="session-box">
            <span id="roleBadge" class="role-badge">Passager</span>
            <span id="userLabel"></span>
            <button id="copyLinkButton" type="button" class="ghost-button">Copier le lien</button>
            <button id="logoutButton" type="button" class="ghost-button">Changer d'identité</button>
          </div>
        </header>

        <div class="workspace">
          <aside class="toolbar" aria-label="Outils de dessin">
            <fieldset>
              <legend>Outils</legend>
              <button class="tool-button is-active" type="button" data-tool="pen">Stylo</button>
              <button class="tool-button" type="button" data-tool="pencil">Crayon</button>
              <button class="tool-button" type="button" data-tool="bucket">Pot de peinture</button>
              <button class="tool-button" type="button" data-tool="rectangle">Rectangle</button>
              <button class="tool-button" type="button" data-tool="circle">Cercle</button>
              <button class="tool-button" type="button" data-tool="line">Ligne</button>
              <button class="tool-button" type="button" data-tool="eraser">Gomme</button>
            </fieldset>

            <label class="control-label">
              Couleur
              <input id="colorInput" type="color" value="#5b5cf6" />
            </label>
            <label class="control-label">
              Taille
              <input id="sizeInput" type="range" min="2" max="56" value="8" />
              <span id="sizeLabel">8 px</span>
            </label>
            <button id="undoMineButton" type="button" class="secondary-button">Annuler mon dernier dessin</button>
            <button id="clearMineButton" type="button" class="danger-button">Effacer mes dessins</button>
            <button id="exportButton" type="button" class="admin-only primary-button">Exporter en photo</button>
            <button id="clearAllButton" type="button" class="admin-only danger-button">Vider la toile</button>
          </aside>

          <div class="canvas-wrap">
            <canvas id="drawingCanvas" width="1600" height="1000" aria-label="Zone de dessin"></canvas>
            <p id="canvasNotice" class="canvas-notice" role="status"></p>
          </div>

          <aside id="adminPanel" class="admin-panel admin-only" aria-labelledby="adminTitle">
            <h2 id="adminTitle">Vue admin</h2>
            <p>Tu peux modifier tous les dessins, voir les prénoms et l'heure de création.</p>
            <div class="stats-grid">
              <div><strong id="strokeCount">0</strong><span>dessins</span></div>
              <div><strong id="artistCount">0</strong><span>artistes</span></div>
            </div>
            <h3>Historique</h3>
            <ol id="historyList" class="history-list"></ol>
          </aside>
        </div>
      </section>
    </main>
    <script src="./src/main.js" defer></script>
  </body>
</html>
