<?php
declare(strict_types=1);
require __DIR__ . '/api/config.php';

$slug = trim((string)($_GET['c'] ?? ''));
$canvas = $slug !== '' ? find_canvas($slug) : null;
if (!$canvas) {
    http_response_code(404);
    echo '<!DOCTYPE html><meta charset="utf-8"><h1>Toile introuvable</h1>'
       . '<p><a href="index.php">Retour à l\'accueil</a></p>';
    exit;
}
$identity = current_identity();
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= htmlspecialchars($canvas['name']) ?> — Toile collaborative</title>
  <link rel="stylesheet" href="assets/style.css">
</head>
<body class="editor">

  <!-- Données injectées côté serveur -->
  <script>
    window.CANVAS = {
      slug: <?= json_encode($canvas['slug']) ?>,
      name: <?= json_encode($canvas['name']) ?>,
      width: <?= (int)$canvas['width'] ?>,
      height: <?= (int)$canvas['height'] ?>,
      bg: <?= json_encode($canvas['bg_color']) ?>
    };
    window.IDENTITY = <?= $identity ? json_encode($identity) : 'null' ?>;
  </script>

  <!-- Fenêtre d'identification -->
  <div id="identityModal" class="modal" hidden>
    <div class="modal-box">
      <h2>Avant de dessiner</h2>
      <p>Indiquez votre prénom et votre pseudo pour rejoindre la toile.</p>
      <label>Prénom
        <input id="idPrenom" type="text" maxlength="100" autocomplete="given-name">
      </label>
      <label>Pseudo
        <input id="idPseudo" type="text" maxlength="100" autocomplete="nickname">
      </label>
      <button id="idSubmit" class="primary">Entrer dans la toile</button>
      <p id="idMsg" class="msg"></p>
    </div>
  </div>

  <header class="topbar">
    <div class="brand"><a href="index.php">🎨 Toile</a> · <span id="canvasName"></span></div>
    <div class="who">
      <span id="whoami"></span>
      <button id="shareBtn" class="ghost" title="Copier le lien">🔗 Partager</button>
      <button id="exportBtn" class="ghost" hidden title="Exporter en PNG (admin)">⬇️ Exporter</button>
      <button id="adminBtn" class="ghost" hidden>👑 Admin</button>
      <button id="changeBtn" class="ghost">Changer d'identité</button>
    </div>
  </header>

  <div class="workspace">
    <aside class="toolbar">
      <div class="tool-group">
        <button class="tool" data-tool="pen" title="Stylo">🖊️</button>
        <button class="tool" data-tool="pencil" title="Crayon">✏️</button>
        <button class="tool" data-tool="line" title="Ligne">📏</button>
        <button class="tool" data-tool="rect" title="Rectangle">▭</button>
        <button class="tool" data-tool="circle" title="Cercle / Ellipse">⬭</button>
        <button class="tool" data-tool="triangle" title="Triangle">△</button>
        <button class="tool" data-tool="fill" title="Pot de peinture">🪣</button>
        <button class="tool" data-tool="eraser" title="Gomme (supprime un élément)">🧽</button>
      </div>

      <div class="tool-group">
        <label class="lbl">Couleur</label>
        <input id="color" type="color" value="#222222">
        <div class="swatches" id="swatches"></div>
      </div>

      <div class="tool-group">
        <label class="lbl">Épaisseur <span id="sizeVal">4</span></label>
        <input id="size" type="range" min="1" max="60" value="4">
      </div>

      <div class="tool-group">
        <label class="chk"><input id="shapeFill" type="checkbox"> Forme pleine</label>
      </div>

      <p class="hint">La gomme supprime un élément. Un passager ne peut effacer que ses propres dessins.</p>
    </aside>

    <main class="canvas-wrap">
      <div class="canvas-scroll">
        <canvas id="board"></canvas>
      </div>
      <div id="status" class="status"></div>
    </main>

    <aside id="adminPanel" class="admin-panel" hidden>
      <h3>👑 Panneau admin</h3>
      <div class="admin-section">
        <h4>Contributeurs</h4>
        <ul id="contribList"></ul>
      </div>
      <div class="admin-section">
        <h4>Historique des dessins</h4>
        <ul id="eventList"></ul>
      </div>
    </aside>
  </div>

  <script src="assets/app.js"></script>
</body>
</html>
