# Carnet Trek

Application pour garder une trace de ses randonnées : nom, distance, dénivelé, date et notes.

- **Frontend** : Vue 3 + TypeScript + Vite, Pinia, Vue Router → [frontend/](frontend/README.md)
- **Backend** : Express 5 + TypeScript, Mongoose → [backend/](backend/README.md)
- **Base de données** : MongoDB 7

## Démarrage rapide (Docker)

Prérequis : [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up -d --build
```

| Service  | URL                             |
| -------- | ------------------------------- |
| Frontend | http://127.0.0.1:5173           |
| API      | http://localhost:3000/api/treks |
| MongoDB  | mongodb://127.0.0.1:27017       |

Le code est monté en volume : les modifications dans `src/` sont rechargées automatiquement.

## Commandes utiles

```bash
docker compose ps                         # état des conteneurs
docker compose logs -f frontend           # logs d'un service (frontend, backend, mongo)
docker compose restart frontend           # après une modif du .env ou de vite.config.ts
docker compose up -d --build -V backend frontend  # après une modif de package.json ou de docker-compose.yml
docker compose down                       # tout arrêter
docker compose down -v                    # tout arrêter ET supprimer les données Mongo
```

> `-V` recrée les volumes `node_modules` des conteneurs : sans lui, un conteneur garde ses anciennes dépendances même après `--build`. Une variable ajoutée dans `docker-compose.yml` n'est prise en compte qu'à la recréation du conteneur (`up -d`), pas avec `restart`.

## Variables d'environnement

Chaque dossier contient un `.env.example` à copier en `.env` :

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Les fichiers `.env` ne sont pas versionnés.

## Qualité du code

ESLint (lint) et Prettier (formatage) sont configurés dans `frontend/` et `backend/`, avec une config Prettier commune à la racine (`.prettierrc.json`). À lancer dans chaque dossier :

```bash
npm run lint          # vérifie le code
npm run lint:fix      # corrige automatiquement ce qui peut l'être
npm run format        # formate tous les fichiers
npm run format:check  # vérifie le formatage sans modifier
npm run type-check    # vérifie les types TypeScript
```

Dans VS Code, installer les extensions recommandées (ESLint, Prettier) : le formatage et les corrections ESLint s'appliquent à l'enregistrement.

## Structure

```
carnet-trek/
├── backend/            # API REST Express
├── frontend/           # Application Vue
└── docker-compose.yml  # frontend + backend + mongo
```

## Dépannage

- **Création / suppression qui ne fait rien** : vérifier que `VITE_API_URL` est bien défini, puis redémarrer le frontend (Vite ne lit le `.env` qu'au démarrage).
- **http://localhost:5173 affiche une autre application** : un autre serveur Vite tourne déjà en local sur ce port. L'arrêter, ou utiliser http://127.0.0.1:5173.
