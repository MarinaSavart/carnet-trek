# Carnet Trek — Backend

API REST de gestion des randonnées : Express 5, TypeScript et Mongoose (MongoDB).

## Lancer le backend

### Avec Docker (recommandé)

Depuis la racine du projet :

```bash
docker compose up -d backend
```

### En local

Prérequis : Node.js 24 et un MongoDB accessible (par exemple `docker compose up -d mongo`).

```bash
cp .env.example .env
npm install
npm run dev
```

L'API écoute sur http://localhost:3000.

## Scripts

| Commande        | Description                                         |
| --------------- | --------------------------------------------------- |
| `npm run dev`   | Lancement avec rechargement automatique (tsx watch) |
| `npm run build` | Compilation TypeScript dans `dist/`                 |
| `npm start`     | Lancement de la version compilée                    |

## Variables d'environnement

| Variable    | Défaut                                  | Description         |
| ----------- | --------------------------------------- | ------------------- |
| `PORT`      | `3000`                                  | Port du serveur     |
| `MONGO_URI` | `mongodb://localhost:27017/carnet-trek` | Connexion à MongoDB |

Avec Docker Compose, `MONGO_URI` vaut `mongodb://mongo:27017/carnet-trek` (nom du service Mongo).

## Endpoints

Base : `/api/treks`

| Méthode  | Route            | Description                  | Réponse         |
| -------- | ---------------- | ---------------------------- | --------------- |
| `GET`    | `/api/treks`     | Liste des randos (date desc) | `200` + tableau |
| `GET`    | `/api/treks/:id` | Détail d'une rando           | `200` / `404`   |
| `POST`   | `/api/treks`     | Création d'une rando         | `201` / `400`   |
| `DELETE` | `/api/treks/:id` | Suppression d'une rando      | `204`           |

Exemple de création :

```bash
curl -X POST http://localhost:3000/api/treks \
  -H "Content-Type: application/json" \
  -d '{"name":"Tour du Mont Blanc","distanceKm":170,"elevationGain":10000}'
```

## Modèle `Trek`

| Champ           | Type   | Requis | Défaut     |
| --------------- | ------ | ------ | ---------- |
| `name`          | String | oui    |            |
| `distanceKm`    | Number | oui    |            |
| `elevationGain` | Number | oui    |            |
| `date`          | Date   | non    | `Date.now` |
| `notes`         | String | non    | `""`       |

`createdAt` et `updatedAt` sont ajoutés automatiquement.

## Structure

```
src/
├── server.ts        # connexion MongoDB + démarrage du serveur
├── app.ts           # configuration Express (CORS, JSON, routes)
├── models/Trek.ts   # schéma Mongoose
└── routes/treks.ts  # routes CRUD /api/treks
```
