# Toile collaborative

Application web servie par PHP pour créer une grande toile collaborative par lien.

## Fonctionnalités

- chaque URL `?toile=...` correspond à une toile séparée ;
- l'utilisateur doit renseigner son prénom et son pseudo avant de dessiner ;
- le compte admin est activé avec le prénom `Khalil` et le pseudo `kaki1403` ;
- les passagers peuvent uniquement déplacer, gommer ou annuler les dessins associés à leur prénom ;
- l'admin peut modifier tous les dessins, voir l'historique avec prénom, pseudo et heure de création, vider la toile et exporter la toile en PNG ;
- outils disponibles : stylo, crayon, pot de peinture, rectangle, cercle, ligne, gomme, couleurs et taille de trait ;
- les dessins sont enregistrés côté serveur, dans `data/canvases/<id>.json`, pour que les modifications restent disponibles depuis le lien de la toile ;
- la toile est resynchronisée automatiquement avec le serveur toutes les quelques secondes.

## Lancer le projet

```bash
npm run start
```

Puis ouvrir <http://localhost:4173>. Le routeur PHP expose aussi l'API `GET /api/canvases/:id` et `PUT /api/canvases/:id` utilisée par le navigateur pour charger et sauvegarder la toile.

## Vérifier le JavaScript et le PHP

```bash
npm run check
```
