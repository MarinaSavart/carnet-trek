# Carnet Trek — Backend

API REST des treks et de leurs étapes : Express 5, TypeScript, Mongoose (MongoDB). Les traces GPX et les photos sont stockées sur disque et servies en statique.

## Lancer le backend

### Avec Docker (recommandé)

Depuis la racine du projet :

```bash
docker compose up -d backend
docker compose exec backend npm run seed   # données d'exemple (facultatif)
```

### En local

Prérequis : Node.js 24 et un MongoDB accessible (par exemple `docker compose up -d mongo`).

```bash
cp .env.example .env
npm install
npm run seed   # facultatif
npm run dev
```

L'API écoute sur http://localhost:3000.

## Scripts

| Commande                  | Description                                                 |
| ------------------------- | ----------------------------------------------------------- |
| `npm run dev`             | Lancement avec rechargement automatique (tsx watch)         |
| `npm run build`           | Compilation TypeScript dans `dist/`                         |
| `npm start`               | Lancement de la version compilée                            |
| `npm run seed`            | Ajoute les treks d'exemple absents (repérés par leur nom)   |
| `npm run seed -- --reset` | Supprime **tous** les treks et leurs fichiers, puis re-seed |
| `npm run lint`            | ESLint                                                      |
| `npm run type-check`      | Vérification des types                                      |

## Variables d'environnement

| Variable                | Défaut                                        | Description                                                      |
| ----------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| `PORT`                  | `3000`                                        | Port du serveur                                                  |
| `MONGO_URI`             | `mongodb://127.0.0.1:27017/carnet-trek`       | Connexion à MongoDB                                              |
| `UPLOAD_DIR`            | `uploads`                                     | Dossier des fichiers envoyés (relatif à `backend/`)              |
| `CORS_ORIGIN`           | `http://localhost:5173,http://127.0.0.1:5173` | Origines du front autorisées, séparées par des virgules          |
| `MAX_FILE_SIZE_MB`      | `20`                                          | Taille maximale d'un fichier envoyé                              |
| `MAX_FILES_PER_REQUEST` | `60`                                          | Nombre maximal de fichiers par envoi (borne la mémoire utilisée) |

Avec Docker Compose, `MONGO_URI` vaut `mongodb://mongo:27017/carnet-trek` (nom du service Mongo).

## Endpoints

| Méthode  | Route            | Description                                         | Réponse               |
| -------- | ---------------- | --------------------------------------------------- | --------------------- |
| `GET`    | `/api/treks`     | Liste allégée (totaux, photo de couverture)         | `200`                 |
| `GET`    | `/api/treks/:id` | Trek complet : étapes, tracés, profils, POI, photos | `200` / `404`         |
| `POST`   | `/api/treks`     | Création (multipart, voir ci-dessous)               | `201` / `400` / `413` |
| `DELETE` | `/api/treks/:id` | Suppression du trek **et de ses fichiers**          | `204` / `404`         |
| `GET`    | `/uploads/…`     | Fichiers envoyés (GPX, photos)                      | `200` / `404`         |

Les erreurs ont toujours la forme `{ "error": "message", "details"?: ["…"] }`.

## Sécurité

- **Pas d'authentification** pour l'instant : l'API est prévue pour un usage local. Ne pas l'exposer sur Internet en l'état.
- **CORS** : seules les origines de `CORS_ORIGIN` (le front) peuvent appeler l'API depuis un navigateur.
- **CSRF** : les requêtes qui modifient des données (`POST`, `DELETE`…) doivent envoyer l'en-tête `X-Requested-With: carnet-trek`, sinon `403`.
- **Fichiers envoyés** : les photos sont vérifiées d'après leur contenu réel (signature), pas le type annoncé ; les GPX invalides (entités inconnues, XML mal formé) sont refusés. Tout ce qui est servi sous `/uploads` porte `Content-Security-Policy: sandbox` et `nosniff`, et les GPX sont servis en téléchargement : aucun contenu envoyé ne peut s'exécuter dans le navigateur.
- **En-têtes** : `helmet` applique les en-têtes de sécurité standard.

### Création d'un trek

Requête `multipart/form-data` :

| Champ               | Contenu                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `data`              | JSON du trek (voir exemple)                                       |
| `etapes[i][gpx]`    | Trace GPX de l'étape `i` (facultatif, une seule)                  |
| `etapes[i][photos]` | Photos de l'étape `i` (facultatif, plusieurs ; jpg/png/webp/avif) |

```bash
curl -X POST http://localhost:3000/api/treks \
  -H 'X-Requested-With: carnet-trek' \
  -F 'data={"name":"Laugavegur","region":"Islande","etapes":[
        {"name":"Landmannalaugar → Hrafntinnusker","difficulty":"difficile"},
        {"name":"Jour de repos","difficulty":"facile","distanceKm":5,"durationMin":90}]}' \
  -F 'etapes[0][gpx]=@etape1.gpx' \
  -F 'etapes[1][photos]=@photo.jpg'
```

Quand une étape a un GPX, le serveur l'analyse : tracé, profil d'altitude et points d'intérêt (waypoints) viennent du fichier. Les stats (`distanceKm`, `durationMin`, `elevationGain`, `elevationLoss`) sont facultatives : une valeur envoyée prime sur celle du GPX. Sans GPX, `distanceKm` et `durationMin` sont obligatoires.

Tout est validé avant la moindre écriture ; si l'enregistrement échoue, les fichiers déjà écrits sont supprimés.

## Stockage des fichiers

```
uploads/treks/<trekId>/<etapeId>/trace.gpx
uploads/treks/<trekId>/<etapeId>/photos/<uuid>.<ext>
```

Le nom envoyé par le client n'est jamais utilisé dans le chemin ; il est conservé en base (`originalName`). Le dossier `uploads/` n'est pas versionné.

## Modèle `Trek`

Un document par trek, les étapes sont des sous-documents :

- **Trek** : `name`, `region`, `description`, `etapes[]`, `createdAt`, `updatedAt`
- **Étape** : `order`, `name`, `description`, `difficulty` (`facile` · `moyen` · `difficile` · `tres_difficile`), `distanceKm`, `elevationGain`, `elevationLoss`, `durationMin`, `gpxFile`, `gpxTrack` (GeoJSON LineString), `elevationProfile[]`, `pois[]`, `photos[]`

Les coordonnées suivent la convention GeoJSON : `[longitude, latitude]`.

## Structure

```
src/
├── server.ts                # connexion MongoDB + démarrage
├── app.ts                   # Express : CORS, /uploads, routes, erreurs
├── config.ts                # variables d'environnement
├── models/Trek.ts           # schémas Mongoose
├── validation/trek.ts       # schéma zod du JSON reçu
├── routes/treks.ts          # routes /api/treks (multer pour les fichiers)
├── services/trekService.ts  # création / suppression / liste
├── lib/gpx.ts               # analyse GPX (même logique que le front)
├── lib/storage.ts           # écriture / suppression des fichiers
├── middleware/errorHandler.ts
└── scripts/seed.ts          # données d'exemple (seed/)
```
