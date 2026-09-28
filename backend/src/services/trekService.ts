import { Types } from 'mongoose'
import { HttpError } from '../lib/errors.js'
import { GpxError, parseGpx, type ParsedGpx } from '../lib/gpx.js'
import { removeTrekFiles, saveGpx, savePhoto, type IncomingFile } from '../lib/storage.js'
import { Trek } from '../models/Trek.js'
import type { EtapeInput, TrekInput } from '../validation/trek.js'

export interface EtapeFiles {
  gpx?: IncomingFile
  photos: IncomingFile[]
}

function parseEtapeGpx(file: IncomingFile | undefined, etapeNumber: number): ParsedGpx | null {
  if (!file) return null
  try {
    return parseGpx(file.buffer.toString('utf8'))
  } catch (err) {
    if (err instanceof GpxError) throw new HttpError(400, `Étape ${etapeNumber} : ${err.message}`)
    throw err
  }
}

// Les valeurs saisies priment (l'utilisateur a pu corriger le GPX), le GPX complète le reste
function resolveStats(input: EtapeInput, gpx: ParsedGpx | null, etapeNumber: number) {
  const distanceKm = input.distanceKm ?? gpx?.distanceKm
  const durationMin = input.durationMin ?? gpx?.durationMin
  if (!distanceKm) throw new HttpError(400, `Étape ${etapeNumber} : distance requise (ou un GPX)`)
  if (!durationMin) throw new HttpError(400, `Étape ${etapeNumber} : durée requise (ou un GPX)`)

  return {
    distanceKm,
    durationMin: Math.round(durationMin),
    elevationGain: Math.round(input.elevationGain ?? gpx?.elevationGain ?? 0),
    elevationLoss: Math.round(input.elevationLoss ?? gpx?.elevationLoss ?? 0),
  }
}

/**
 * Crée un trek et enregistre ses fichiers. Tout est validé avant la moindre écriture ;
 * si l'enregistrement en base échoue, les fichiers déjà écrits sont supprimés.
 */
export async function createTrek(input: TrekInput, files: EtapeFiles[]) {
  const prepared = input.etapes.map((etape, index) => {
    const gpx = parseEtapeGpx(files[index]?.gpx, index + 1)
    return { etape, gpx, stats: resolveStats(etape, gpx, index + 1) }
  })

  const trekId = new Types.ObjectId()
  try {
    const etapes = await Promise.all(
      prepared.map(async ({ etape, gpx, stats }, index) => {
        const etapeId = new Types.ObjectId()
        const etapeFiles = files[index] ?? { photos: [] }
        return {
          _id: etapeId,
          order: index + 1,
          name: etape.name,
          description: etape.description,
          difficulty: etape.difficulty,
          ...stats,
          gpxFile: etapeFiles.gpx
            ? await saveGpx(trekId.toString(), etapeId.toString(), etapeFiles.gpx)
            : undefined,
          gpxTrack: gpx?.track,
          elevationProfile: gpx?.elevationProfile,
          pois: gpx?.waypoints ?? [],
          photos: await Promise.all(
            etapeFiles.photos.map((photo) =>
              savePhoto(trekId.toString(), etapeId.toString(), photo),
            ),
          ),
        }
      }),
    )

    return await Trek.create({
      _id: trekId,
      name: input.name,
      region: input.region,
      description: input.description,
      etapes,
    })
  } catch (err) {
    await removeTrekFiles(trekId.toString())
    throw err
  }
}

export async function deleteTrek(id: string): Promise<boolean> {
  const deleted = await Trek.findByIdAndDelete(id)
  if (deleted) await removeTrekFiles(id)
  return Boolean(deleted)
}

/** Liste allégée : ni tracés ni profils, seulement de quoi afficher une carte de trek */
export async function listTrekSummaries() {
  const treks = await Trek.find()
    .select(
      'name region description createdAt etapes.distanceKm etapes.durationMin etapes.elevationGain etapes.photos',
    )
    .sort({ createdAt: -1 })
    .lean()

  return treks.map((trek) => {
    // Des documents créés avec l'ancien modèle (sans étapes) peuvent encore exister
    const etapes = trek.etapes ?? []
    return {
      _id: trek._id.toString(),
      name: trek.name,
      region: trek.region ?? '',
      description: trek.description ?? '',
      createdAt: trek.createdAt,
      etapeCount: etapes.length,
      distanceKm: Math.round(etapes.reduce((sum, e) => sum + e.distanceKm, 0) * 10) / 10,
      durationMin: etapes.reduce((sum, e) => sum + e.durationMin, 0),
      elevationGain: etapes.reduce((sum, e) => sum + (e.elevationGain ?? 0), 0),
      coverPhotoUrl: etapes.flatMap((e) => e.photos ?? [])[0]?.url ?? null,
    }
  })
}
