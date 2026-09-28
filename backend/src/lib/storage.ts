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

/**
 * Type réel d'une image d'après ses premiers octets (signature). Le type annoncé par le
 * client (Content-Type) n'est pas fiable : une page HTML peut être envoyée en « image/png ».
 */
export function detectImageType(buffer: Buffer): keyof typeof PHOTO_EXTENSIONS | null {
  const ascii = (start: number, end: number) => buffer.subarray(start, end).toString('latin1')
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) return 'image/avif'
  return null
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
  // Extension déduite du contenu réel (validé en amont par le service), jamais du client
  const type = detectImageType(file.buffer)
  if (!type) throw new Error(`Photo non reconnue : ${file.originalname}`)
  const extension = PHOTO_EXTENSIONS[type]
  const url = await save(
    ['treks', trekId, etapeId, 'photos', `${randomUUID()}${extension}`],
    file.buffer,
  )
  return { url, originalName: file.originalname }
}

export async function removeTrekFiles(trekId: string): Promise<void> {
  await rm(trekDir(trekId), { recursive: true, force: true })
}
