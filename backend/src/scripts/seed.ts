// Charge les treks d'exemple en base.
//   npm run seed           → ajoute les treks absents (repérés par leur nom)
//   npm run seed -- --reset → supprime d'abord TOUS les treks et leurs fichiers
import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { config } from '../config.js'
import { PHOTO_EXTENSIONS, removeTrekFiles, type IncomingFile } from '../lib/storage.js'
import { Trek } from '../models/Trek.js'
import { createTrek, type EtapeFiles } from '../services/trekService.js'
import { trekInputSchema } from '../validation/trek.js'
import { seedTreks } from './seedData.js'

const SEED_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../seed')

const MIME_BY_EXTENSION = Object.fromEntries(
  Object.entries(PHOTO_EXTENSIONS).map(([mime, ext]) => [ext, mime]),
)

async function listFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).sort()
  } catch {
    return []
  }
}

async function loadEtapeFiles(folder: string | undefined): Promise<EtapeFiles> {
  if (!folder) return { photos: [] }
  const dir = path.join(SEED_DIR, folder)

  const gpxName = (await listFiles(dir)).find((f) => f.toLowerCase().endsWith('.gpx'))
  const gpx: IncomingFile | undefined = gpxName
    ? {
        buffer: await readFile(path.join(dir, gpxName)),
        originalname: gpxName,
        mimetype: 'application/gpx+xml',
      }
    : undefined

  const photos: IncomingFile[] = []
  for (const name of await listFiles(path.join(dir, 'photos'))) {
    const extension = path.extname(name).toLowerCase().replace('.jpeg', '.jpg')
    const mimetype = MIME_BY_EXTENSION[extension]
    if (!mimetype) continue
    photos.push({
      buffer: await readFile(path.join(dir, 'photos', name)),
      originalname: name,
      mimetype,
    })
  }

  return { gpx, photos }
}

async function main() {
  await mongoose.connect(config.mongoUri)

  if (process.argv.includes('--reset')) {
    const existing = await Trek.find().select('_id').lean()
    await Promise.all(existing.map((t) => removeTrekFiles(t._id.toString())))
    await Trek.deleteMany({})
    console.log(`${existing.length} trek(s) supprimé(s)`)
  }

  for (const seed of seedTreks) {
    if (await Trek.exists({ name: seed.name })) {
      console.log(`= ${seed.name} (déjà présent)`)
      continue
    }
    const input = trekInputSchema.parse(seed)
    const files = await Promise.all(seed.etapes.map((e) => loadEtapeFiles(e.folder)))
    const trek = await createTrek(input, files)
    console.log(`+ ${trek.name} (${trek.etapes.length} étapes)`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
