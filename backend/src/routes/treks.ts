import { Router } from 'express'
import multer from 'multer'
import { isValidObjectId } from 'mongoose'
import { config } from '../config.js'
import { HttpError } from '../lib/errors.js'
import { PHOTO_EXTENSIONS } from '../lib/storage.js'
import { Trek } from '../models/Trek.js'
import {
  createTrek,
  deleteTrek,
  listTrekSummaries,
  type EtapeFiles,
} from '../services/trekService.js'
import { trekInputSchema } from '../validation/trek.js'

const router = Router()

// Création en multipart/form-data :
//   data                  → JSON du trek (voir validation/trek.ts)
//   etapes[<i>][gpx]      → trace GPX de l'étape i (facultatif, un seul)
//   etapes[<i>][photos]   → photos de l'étape i (facultatif, plusieurs)
const FILE_FIELD = /^etapes\[(\d+)\]\[(gpx|photos)\]$/

// Fichiers gardés en mémoire le temps de tout valider, puis écrits sur disque par le service
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024, files: config.maxFilesPerRequest },
  fileFilter: (_req, file, callback) => {
    const kind = FILE_FIELD.exec(file.fieldname)?.[2]
    if (kind === 'gpx' && file.originalname.toLowerCase().endsWith('.gpx')) {
      return callback(null, true)
    }
    if (kind === 'photos' && file.mimetype in PHOTO_EXTENSIONS) return callback(null, true)
    callback(new HttpError(400, `Fichier refusé : ${file.originalname}`))
  },
})

function groupFilesByEtape(files: Express.Multer.File[], etapeCount: number): EtapeFiles[] {
  const grouped: EtapeFiles[] = Array.from({ length: etapeCount }, () => ({ photos: [] }))
  for (const file of files) {
    const [, index, kind] = FILE_FIELD.exec(file.fieldname) ?? []
    const etape = grouped[Number(index)]
    if (!etape)
      throw new HttpError(400, `Fichier rattaché à une étape inexistante : ${file.fieldname}`)
    if (kind === 'gpx') {
      if (etape.gpx) throw new HttpError(400, `Étape ${Number(index) + 1} : un seul GPX par étape`)
      etape.gpx = file
    } else {
      etape.photos.push(file)
    }
  }
  return grouped
}

function parseJsonField(value: unknown): unknown {
  if (typeof value !== 'string') throw new HttpError(400, 'Champ "data" manquant')
  try {
    return JSON.parse(value)
  } catch {
    throw new HttpError(400, 'Champ "data" : JSON invalide')
  }
}

router.get('/', async (_req, res) => {
  res.json(await listTrekSummaries())
})

router.get('/:id', async (req, res) => {
  const trek = isValidObjectId(req.params.id) ? await Trek.findById(req.params.id) : null
  if (!trek) throw new HttpError(404, 'Trek introuvable')
  res.json(trek)
})

router.post('/', upload.any(), async (req, res) => {
  const input = trekInputSchema.parse(parseJsonField(req.body.data))
  const files = groupFilesByEtape((req.files as Express.Multer.File[]) ?? [], input.etapes.length)
  const trek = await createTrek(input, files)
  res.status(201).json(trek)
})

router.delete('/:id', async (req, res) => {
  const deleted = isValidObjectId(req.params.id) && (await deleteTrek(req.params.id))
  if (!deleted) throw new HttpError(404, 'Trek introuvable')
  res.status(204).send()
})

export default router
