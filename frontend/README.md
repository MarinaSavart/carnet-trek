# Carnet Trek — Frontend

Interface de gestion des randonnées : Vue 3 (`<script setup>`), TypeScript, Vite, Pinia et Vue Router.

## Lancer le frontend

### Avec Docker (recommandé)

Depuis la racine du projet :

```bash
docker compose up -d frontend
```

### En local

Prérequis : Node.js 24 et le backend démarré sur le port 3000.

```bash
cp .env.example .env
npm install
npm run dev
```

L'application est disponible sur http://127.0.0.1:5173.

## Scripts

| Commande          | Description                                  |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Serveur de développement Vite (HMR)          |
| `npm run build`   | Vérification des types (vue-tsc) + build     |
| `npm run preview` | Prévisualisation du build de production      |

## Variables d'environnement

| Variable       | Défaut                      | Description        |
| -------------- | --------------------------- | ------------------ |
| `VITE_API_URL` | `http://localhost:3000/api` | URL de base de l'API |

⚠️ Vite ne lit le `.env` qu'au démarrage : après une modification, redémarrer le serveur (`docker compose restart frontend`).

## Routes

| Chemin        | Vue              | Description             |
| ------------- | ---------------- | ----------------------- |
| `/`           | `TrekList.vue`    | Liste des treks          |
| `/treks/:id`  | `TrekDetail.vue`  | Étapes d'un trek         |
| `/etapes/:id` | `EtapeDetail.vue` | Détail d'une étape + POI |

## Structure

```
src/
├── main.ts                  # création de l'app (Pinia + Router)
├── App.vue                  # <RouterView />
├── router/index.ts          # définition des routes
├── types/trek.ts            # types Trek, Etape, POI, Difficulty (GeoJSON)
├── data/mockTreks.ts        # données de démo (utilisées par le store)
├── stores/treks.ts          # store Pinia (treks, étapes, totaux)
├── composables/useTreks.ts  # appels à l'API (pas encore branché)
├── utils/format.ts          # formatDuration
├── styles/tokens.css        # variables CSS + styles globaux
├── components/
│   └── DifficultyBadge.vue
└── views/
    ├── TrekList.vue
    ├── TrekDetail.vue
    └── EtapeDetail.vue
```

## IDE recommandé

[VS Code](https://code.visualstudio.com/) + l'extension [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar).
