import path from 'node:path'

export const config = {
  port: Number(process.env.PORT ?? 3000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/carnet-trek',
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
