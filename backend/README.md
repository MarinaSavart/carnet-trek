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

| Commande                                 | Description                                                 |
| ---------------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                            | Lancement avec rechargement automatique (tsx watch)         |
| `npm run build`                          | Compilation TypeScript dans `dist/`                         |
| `npm start`                              | Lancement de la version compilée                            |
| `npm run seed`                           | Ajoute les treks d'exemple absents (repérés par leur nom)   |
| `npm run seed -- --reset`                | Supprime **tous** les treks et leurs fichiers, puis re-seed |
| `npm run create-user -- <email> "<nom>"` | Crée un compte (mot de passe demandé au clavier)            |
| `npm run lint`                           | ESLint                                                      |
| `npm run type-check`                     | Vérification des types                                      |

## Variables d'environnement

| Variable                | Défaut                                        | Description                                                         |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| `PORT`                  | `3000`                                        | Port du serveur                                                     |
| `MONGO_URI`             | `mongodb://127.0.0.1:27017/carnet-trek`       | Connexion à MongoDB                                                 |
| `UPLOAD_DIR`            | `uploads`                                     | Dossier des fichiers envoyés (relatif à `backend/`)                 |
| `CORS_ORIGIN`           | `http://localhost:5173,http://127.0.0.1:5173` | Origines du front autorisées, séparées par des virgules             |
| `MAX_FILE_SIZE_MB`      | `20`                                          | Taille maximale d'un fichier envoyé                                 |
| `MAX_FILES_PER_REQUEST` | `60`                                          | Nombre maximal de fichiers par envoi (borne la mémoire utilisée)    |
| `JWT_SECRET`            | — (**obligatoire en production**)             | Secret de signature des sessions, 32 caractères minimum             |
| `SESSION_DAYS`          | `7`                                           | Durée d'une session                                                 |
| `ALLOW_REGISTRATION`    | `true`                                        | `false` : plus d'inscription libre, comptes créés via `create-user` |

Avec Docker Compose, `MONGO_URI` vaut `mongodb://mongo:27017/carnet-trek` (nom du service Mongo).

## Endpoints

| Méthode     | Route                | Description                                                    | Réponse                       |
| ----------- | -------------------- | -------------------------------------------------------------- | ----------------------------- |
| `GET`       | `/api/treks`         | Liste allégée (totaux, photo de couverture)                    | `200`                         |
| `GET`       | `/api/treks/:id`     | Trek complet : étapes, tracés, profils, POI, photos            | `200` / `404`                 |
| `POST` 🔒   | `/api/treks`         | Création (multipart, voir ci-dessous)                          | `201` / `400` / `401` / `413` |
| `DELETE` 🔒 | `/api/treks/:id`     | Suppression du trek **et de ses fichiers** (auteur uniquement) | `204` / `401` / `403` / `404` |
| `GET`       | `/uploads/…`         | Fichiers envoyés (GPX, photos)                                 | `200` / `404`                 |
| `GET`       | `/api/auth/me`       | Utilisateur connecté (`{ user: null }` sinon)                  | `200`                         |
| `POST`      | `/api/auth/register` | Inscription `{ email, name, password }` + ouverture de session | `201` / `400` / `403` / `409` |
| `POST`      | `/api/auth/login`    | Connexion `{ email, password }`                                | `200` / `401` / `429`         |
| `POST`      | `/api/auth/logout`   | Déconnexion                                                    | `204`                         |

🔒 : connexion requise. Les lectures sont publiques.

Les erreurs ont toujours la forme `{ "error": "message", "details"?: ["…"] }`.

## Authentification

- **Session** : un jeton JWT signé (HS256) dans un cookie `ct_session` `httpOnly` (illisible par le JavaScript de la page), `SameSite=Lax`, `Secure` en production. Le front et l'API sont servis sur la même origine grâce au proxy de Vite, le cookie reste donc « first-party ».
- **Mots de passe** : hachés avec scrypt (sel aléatoire, paramètres OWASP), 10 caractères minimum. Jamais renvoyés par l'API.
- **Propriété** : chaque trek créé a un auteur (`owner`) ; lui seul peut le supprimer (et plus tard le modifier). Les treks sans auteur (créés avant l'authentification, ou par le seed) sont gérables par tout utilisateur connecté.
- **Révocation** : chaque utilisateur a un `tokenVersion` ; l'incrémenter invalide toutes ses sessions.
- **Anti-bruteforce** : 10 échecs de connexion par IP et par quart d'heure, 5 inscriptions par IP et par heure. Réponse identique (message et temps) que l'email existe ou non.

## Sécurité

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
# 1. Connexion : le cookie de session est enregistré dans cookies.txt
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'X-Requested-With: carnet-trek' -H 'Content-Type: application/json' \
  -d '{"email":"moi@exemple.fr","password":"mon-mot-de-passe"}'

# 2. Création, avec ce cookie
curl -b cookies.txt -X POST http://localhost:3000/api/treks \
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
├── routes/auth.ts           # inscription, connexion, déconnexion, me
├── middleware/auth.ts       # loadUser (lit la session) / requireAuth
├── lib/password.ts          # hachage scrypt
├── lib/session.ts           # cookie + JWT
├── models/User.ts
├── services/trekService.ts  # création / suppression / liste
├── lib/gpx.ts               # analyse GPX (même logique que le front)
├── lib/storage.ts           # écriture / suppression des fichiers
├── middleware/errorHandler.ts
├── scripts/seed.ts          # données d'exemple (seed/)
└── scripts/createUser.ts    # création de compte en ligne de commande
```
