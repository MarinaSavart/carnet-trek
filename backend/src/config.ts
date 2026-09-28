import path from 'node:path'

export const config = {
  port: Number(process.env.PORT ?? 3000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/carnet-trek',
  /** Dossier où sont écrits les fichiers envoyés (GPX, photos) */
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? 'uploads'),
  /** Origines autorisées à appeler l'API, séparées par des virgules ("*" = toutes) */
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB ?? 20),
}

/** Préfixe public sous lequel les fichiers envoyés sont servis */
export const UPLOADS_URL_PREFIX = '/uploads'
