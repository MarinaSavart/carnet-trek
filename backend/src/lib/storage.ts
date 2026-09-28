import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { config, UPLOADS_URL_PREFIX } from '../config.js'

// Organisation sur disque, une arborescence par trek puis par étape :
//   uploads/treks/<trekId>/<etapeId>/trace.gpx
//   uploads/treks/<trekId>/<etapeId>/photos/<uuid>.<ext>

/** Fichier reçu : sous-ensemble commun à multer et au script de seed */
export interface IncomingFile {
  buffer: Buffer
  originalname: string
  mimetype: string
}

export const PHOTO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
}

function trekDir(trekId: string): string {
  return path.join(config.uploadDir, 'treks', trekId)
}

// Le nom envoyé par le client n'est jamais utilisé dans le chemin (traversée de dossier,
// caractères spéciaux) : il est seulement conservé en base pour l'affichage.
async function save(relativePath: string[], buffer: Buffer): Promise<string> {
  const absolute = path.join(config.uploadDir, ...relativePath)
  await mkdir(path.dirname(absolute), { recursive: true })
  await writeFile(absolute, buffer)
  return [UPLOADS_URL_PREFIX, ...relativePath].join('/')
}

export async function saveGpx(trekId: string, etapeId: string, file: IncomingFile) {
  const url = await save(['treks', trekId, etapeId, 'trace.gpx'], file.buffer)
  return { url, originalName: file.originalname }
}

export async function savePhoto(trekId: string, etapeId: string, file: IncomingFile) {
  const extension = PHOTO_EXTENSIONS[file.mimetype] ?? ''
  const url = await save(
    ['treks', trekId, etapeId, 'photos', `${randomUUID()}${extension}`],
    file.buffer,
  )
  return { url, originalName: file.originalname }
}

export async function removeTrekFiles(trekId: string): Promise<void> {
  await rm(trekDir(trekId), { recursive: true, force: true })
}
