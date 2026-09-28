import { randomBytes } from 'node:crypto'
import path from 'node:path'

const isProduction = process.env.NODE_ENV === 'production'

// Secret de signature des jetons de session : obligatoire (et long) en production.
// En développement, à défaut, un secret aléatoire est généré à chaque démarrage
// (les sessions sont alors perdues à chaque redémarrage du serveur).
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret && secret.length >= 32) return secret
  if (isProduction) throw new Error('JWT_SECRET manquant ou trop court (32 caractères minimum)')
  console.warn('⚠ JWT_SECRET absent : secret temporaire généré, ajoute-le dans backend/.env')
  return randomBytes(48).toString('base64url')
}

export const config = {
  isProduction,
  jwtSecret: resolveJwtSecret(),
  /** Durée de validité d'une session */
  sessionDays: Number(process.env.SESSION_DAYS ?? 7),
  /** Création de compte ouverte à tous (sinon : comptes créés via `npm run create-user`) */
  allowRegistration: (process.env.ALLOW_REGISTRATION ?? 'true') === 'true',
  port: Number(process.env.PORT ?? 3000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/carnet-trek',
  /** Dossier où sont écrits les fichiers envoyés (GPX, photos) */
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? 'uploads'),
  /** Origines du front autorisées à appeler l'API (CORS_ORIGIN, séparées par des virgules) */
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB ?? 20),
  /** Nombre maximal de fichiers par requête : les fichiers sont gardés en mémoire le temps
   *  de la validation, cette limite borne la mémoire consommée par un envoi */
  maxFilesPerRequest: Number(process.env.MAX_FILES_PER_REQUEST ?? 60),
}

/** Préfixe public sous lequel les fichiers envoyés sont servis */
export const UPLOADS_URL_PREFIX = '/uploads'
