# 🎨 Toile collaborative

Une grande toile de dessin **collaborative** : chaque toile possède son propre
lien de partage. Avant de dessiner, chaque personne renseigne son **prénom** et
son **pseudo**. Tout ce qui est dessiné est **enregistré en base de données**,
afin de construire une grande toile au fil du temps.

Stack : **HTML / CSS / PHP / MySQL (MariaDB) / JavaScript navigateur**.
**Aucun Node.js.**

## Fonctionnalités

- **Une toile = un lien** (`canvas.php?c=<code>`), partageable.
- **Identification** obligatoire avant de dessiner (prénom + pseudo).
- **Outils** : pot de peinture (remplissage), stylo, crayon, formes
  géométriques (ligne, rectangle, cercle/ellipse, triangle), gomme, et le
  choix des couleurs + épaisseur.
- **Sauvegarde** : chaque élément dessiné est stocké en base et rechargé.
- **Collaboration en temps quasi-réel** : synchronisation par *polling*
  (chaque ~1,8 s) — pas de WebSocket, donc pas de Node.
- **Rôles & permissions** :
  - **Passager** : peut dessiner et ne peut effacer que **ses propres**
    éléments (mêmes prénom + pseudo). Il ne voit pas l'identité des autres.
  - **Admin** (prénom `Khalil` + pseudo `kaki1403`) : peut tout modifier,
    voit le **prénom** et l'**heure** de chaque dessin (panneau Admin), et
    peut **exporter la toile en PNG**.

## Structure

```
index.php              Accueil : créer ou rejoindre une toile
canvas.php             Page de dessin d'une toile
.htaccess              DirectoryIndex index.php
assets/
  style.css
  home.js              Logique de l'accueil
  app.js               Dessin, outils, synchronisation, admin, export
api/
  config.php           Connexion BDD, session, helpers, identifiant admin
  create.php           Créer une toile
  identify.php         Enregistrer prénom + pseudo (détecte l'admin)
  logout.php           Oublier l'identité
  strokes.php          Charger / ajouter des éléments
  delete.php           Supprimer un élément (avec contrôle des droits)
  admin.php            Données admin (contributeurs, horodatage)
schema.sql             Schéma de la base
```

## Installation

1. **Base de données** (MySQL/MariaDB) :

   ```bash
   mysql -u root -p < schema.sql
   # Puis créez un utilisateur applicatif :
   # CREATE USER 'toile'@'localhost' IDENTIFIED BY 'mot_de_passe';
   # GRANT ALL PRIVILEGES ON toile.* TO 'toile'@'localhost';
   ```

2. **Configuration** : les identifiants BDD sont lus depuis des variables
   d'environnement (sinon valeurs par défaut de dev) :

   | Variable          | Défaut        |
   |-------------------|---------------|
   | `TOILE_DB_HOST`   | `127.0.0.1`   |
   | `TOILE_DB_NAME`   | `toile`       |
   | `TOILE_DB_USER`   | `toile`       |
   | `TOILE_DB_PASS`   | `toile_dev_pw`|

3. **Lancer en local** :

   ```bash
   TOILE_DB_PASS=mot_de_passe php -S 127.0.0.1:8080
   ```

   Ouvrez http://127.0.0.1:8080

   En production (hébergement PHP/MySQL classique), déposez les fichiers à la
   racine web et importez `schema.sql`. Définissez les variables `TOILE_DB_*`
   (ou adaptez les valeurs par défaut dans `api/config.php`).

## Notes techniques

- Le rendu est **vectoriel** : la scène est reconstruite à partir de la liste
  des éléments. Cela permet la suppression par élément et l'application des
  permissions. Le pot de peinture est un *flood fill* appliqué sur la scène
  rasterisée dans l'ordre des éléments.
- L'identité (prénom/pseudo) est auto-déclarée et stockée en session PHP — il
  ne s'agit pas d'une authentification forte ; le rôle admin est déterminé par
  la correspondance exacte `Khalil` / `kaki1403`.
