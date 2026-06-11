# Toile collaborative

Application web PHP/MySQL avec HTML, CSS et JavaScript classique pour créer une grande toile collaborative par lien.

## Fonctionnalités

- chaque URL `?toile=...` correspond à une toile séparée ;
- l'utilisateur doit renseigner son prénom et son pseudo avant de dessiner ;
- le compte admin est activé avec le prénom `Khalil` et le pseudo `kaki1403` ;
- les passagers peuvent uniquement déplacer, gommer ou annuler les dessins associés à leur prénom ;
- l'admin peut modifier tous les dessins, voir l'historique avec prénom, pseudo et heure de création, vider la toile et exporter la toile en PNG ;
- outils disponibles : stylo, crayon, pot de peinture, rectangle, cercle, ligne, gomme, couleurs et taille de trait ;
- les dessins sont enregistrés dans MySQL, dans la table `canvases`, pour que les modifications restent disponibles depuis le lien de la toile ;
- la toile est resynchronisée automatiquement avec MySQL via les scripts PHP `load_canvas.php` et `save_canvas.php`.

## Préparer MySQL

1. Importer le schéma :

```sql
SOURCE schema.sql;
```

2. Adapter les identifiants MySQL dans `config.php` si nécessaire.

## Lancer le projet en local

```bash
php -S 0.0.0.0:4173
```

Puis ouvrir <http://localhost:4173/index.php>.

## Vérifier le PHP

```bash
php -l index.php
php -l database.php
php -l load_canvas.php
php -l save_canvas.php
php -l config.php
```

Le JavaScript est chargé directement par une balise `<script>` classique : il n’y a pas de build Node.js ni de dépendance npm.
