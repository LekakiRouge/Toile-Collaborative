<?php
declare(strict_types=1);
require __DIR__ . '/api/config.php';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Toile collaborative</title>
  <link rel="stylesheet" href="assets/style.css">
</head>
<body class="home">
  <main class="home-card">
    <h1>🎨 Toile collaborative</h1>
    <p class="subtitle">
      Créez une grande toile partagée. Chaque toile a son propre lien :
      partagez-le pour dessiner à plusieurs.
    </p>

    <section class="panel">
      <h2>Créer une nouvelle toile</h2>
      <label>Nom de la toile
        <input id="newName" type="text" placeholder="Ma super toile" maxlength="255">
      </label>
      <div class="row">
        <label>Largeur
          <input id="newWidth" type="number" value="1600" min="400" max="6000">
        </label>
        <label>Hauteur
          <input id="newHeight" type="number" value="900" min="300" max="6000">
        </label>
        <label>Fond
          <input id="newBg" type="color" value="#ffffff">
        </label>
      </div>
      <button id="createBtn" class="primary">Créer la toile</button>
      <p id="createMsg" class="msg"></p>
    </section>

    <section class="panel">
      <h2>Rejoindre une toile</h2>
      <p>Collez le lien (ou le code) d'une toile existante :</p>
      <div class="row">
        <input id="joinInput" type="text" placeholder="https://.../canvas.php?c=xxxx ou code">
        <button id="joinBtn">Ouvrir</button>
      </div>
    </section>
  </main>
  <script src="assets/home.js"></script>
</body>
</html>
