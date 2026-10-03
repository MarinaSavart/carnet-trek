import { Types } from 'mongoose'
import { HttpError } from '../lib/errors.js'
import { GpxError, parseGpx, type ParsedGpx } from '../lib/gpx.js'
import {
  detectImageType,
  removeEtapeFiles,
  removeTrekFiles,
  removeUpload,
  saveGpx,
  savePhoto,
  type IncomingFile,
} from '../lib/storage.js'
import { simplifyLine } from '../lib/simplify.js'
import { Trek } from '../models/Trek.js'
import type { EtapeInput, TrekInput, TrekUpdateInput } from '../validation/trek.js'
import { deleteTrekVariantes } from './varianteService.js'

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

interface StatsSource {
  distanceKm?: number
  durationMin?: number
  elevationGain?: number
  elevationLoss?: number
}

// Les valeurs saisies priment (l'utilisateur a pu corriger le GPX) ; la source
// (nouveau GPX, ou valeurs actuelles de l'étape en modification) complète le reste
function resolveStats(input: EtapeInput, source: StatsSource | null, etapeNumber: number) {
  const distanceKm = input.distanceKm ?? source?.distanceKm
  const durationMin = input.durationMin ?? source?.durationMin
  if (!distanceKm) throw new HttpError(400, `Étape ${etapeNumber} : distance requise (ou un GPX)`)
  if (!durationMin) throw new HttpError(400, `Étape ${etapeNumber} : durée requise (ou un GPX)`)

  return {
    distanceKm,
    durationMin: Math.round(durationMin),
    elevationGain: Math.round(input.elevationGain ?? source?.elevationGain ?? 0),
    elevationLoss: Math.round(input.elevationLoss ?? source?.elevationLoss ?? 0),
  }
}

function assertImages(photos: IncomingFile[], etapeNumber: number) {
  for (const photo of photos) {
    if (!detectImageType(photo.buffer)) {
      throw new HttpError(
        400,
        `Étape ${etapeNumber} : « ${photo.originalname} » n'est pas une image valide`,
      )
    }
  }
}

/**
 * Crée un trek et enregistre ses fichiers. Tout est validé avant la moindre écriture ;
 * si l'enregistrement en base échoue, les fichiers déjà écrits sont supprimés.
 */
export async function createTrek(input: TrekInput, files: EtapeFiles[], ownerId?: string) {
  const prepared = input.etapes.map((etape, index) => {
    const gpx = parseEtapeGpx(files[index]?.gpx, index + 1)
    assertImages(files[index]?.photos ?? [], index + 1)
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
          pois: etape.pois ?? gpx?.waypoints ?? [],
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
      owner: ownerId,
    })
  } catch (err) {
    await removeTrekFiles(trekId.toString())
    throw err
  }
}

/**
 * Un trek ne peut être modifié ou supprimé que par son auteur. Les treks sans auteur
 * (antérieurs à l'authentification, ou issus du seed) restent gérables par tout utilisateur connecté.
 */
export function canEditTrek(trek: { owner?: unknown }, userId: string): boolean {
  return !trek.owner || String(trek.owner) === userId
}

export async function deleteTrek(id: string, userId: string): Promise<void> {
  const trek = await Trek.findById(id).select('owner').lean()
  if (!trek) throw new HttpError(404, 'Trek introuvable')
  if (!canEditTrek(trek, userId)) {
    throw new HttpError(403, "Seul l'auteur du trek peut le supprimer")
  }
  await Trek.deleteOne({ _id: id })
  await Promise.all([removeTrekFiles(id), deleteTrekVariantes(id)])
}

/**
 * Modifie un trek : infos générales, étapes (ordre, ajout, suppression), traces GPX
 * (remplacement / retrait) et photos (ajout / retrait).
 *
 * Même principe qu'à la création : tout est validé avant d'écrire ; les nouveaux
 * fichiers sont écrits, puis le document est enregistré, et seulement ensuite les
 * fichiers devenus inutiles sont supprimés. En cas d'échec, seuls les fichiers
 * nouvellement écrits sont retirés : le trek reste dans son état précédent.
 */
export async function updateTrek(
  id: string,
  input: TrekUpdateInput,
  files: EtapeFiles[],
  userId: string,
) {
  const trek = await Trek.findById(id)
  if (!trek) throw new HttpError(404, 'Trek introuvable')
  if (!canEditTrek(trek, userId)) {
    throw new HttpError(403, "Seul l'auteur du trek peut le modifier")
  }

  const trekId = trek._id.toString()
  const existingById = new Map(trek.etapes.map((e) => [e._id.toString(), e.toObject()]))

  // 1. Validation complète, sans rien écrire
  const seenIds = new Set<string>()
  const prepared = input.etapes.map((etape, index) => {
    const number = index + 1
    const existing = etape._id ? existingById.get(etape._id) : undefined
    if (etape._id) {
      if (!existing) throw new HttpError(400, `Étape ${number} : étape inconnue pour ce trek`)
      if (seenIds.has(etape._id)) throw new HttpError(400, `Étape ${number} : étape en double`)
      seenIds.add(etape._id)
    }
    const newGpx = parseEtapeGpx(files[index]?.gpx, number)
    assertImages(files[index]?.photos ?? [], number)
    return {
      etape,
      existing,
      newGpx,
      stats: resolveStats(etape, newGpx ?? existing ?? null, number),
    }
  })

  // 2. Écriture des nouveaux fichiers (retirés si la suite échoue)
  const writtenUrls: string[] = []
  const obsoleteUrls: string[] = []
  const track = <T extends { url: string }>(file: T): T => {
    writtenUrls.push(file.url)
    return file
  }

  try {
    const etapes = await Promise.all(
      prepared.map(async ({ etape, existing, newGpx, stats }, index) => {
        const etapeId = existing?._id ?? new Types.ObjectId()
        const etapeFiles = files[index] ?? { photos: [] }

        // Trace GPX : nouvelle > conservée > retirée
        let gpxFields: Record<string, unknown> = {
          gpxFile: undefined,
          gpxTrack: undefined,
          elevationProfile: undefined,
          pois: [],
        }
        if (newGpx && etapeFiles.gpx) {
          gpxFields = {
            gpxFile: track(await saveGpx(trekId, etapeId.toString(), etapeFiles.gpx)),
            gpxTrack: newGpx.track,
            elevationProfile: newGpx.elevationProfile,
            pois: newGpx.waypoints,
          }
          if (existing?.gpxFile) obsoleteUrls.push(existing.gpxFile.url)
        } else if (existing && !etape.removeGpx) {
          gpxFields = {
            gpxFile: existing.gpxFile,
            gpxTrack: existing.gpxTrack,
            elevationProfile: existing.elevationProfile,
            pois: existing.pois,
          }
        } else if (existing?.gpxFile) {
          obsoleteUrls.push(existing.gpxFile.url)
        }

        // Photos : existantes conservées (dans leur ordre) + nouvelles à la suite
        const keep = etape.keepPhotoIds ? new Set(etape.keepPhotoIds) : null
        const keptPhotos = (existing?.photos ?? []).filter((photo) => {
          const kept = !keep || keep.has(photo._id.toString())
          if (!kept) obsoleteUrls.push(photo.url)
          return kept
        })
        const newPhotos = await Promise.all(
          etapeFiles.photos.map(async (photo) =>
            track(await savePhoto(trekId, etapeId.toString(), photo)),
          ),
        )

        return {
          _id: etapeId,
          order: index + 1,
          name: etape.name,
          description: etape.description,
          difficulty: etape.difficulty,
          ...stats,
          ...gpxFields,
          // POI édités à la main : priment sur ceux du GPX et sur ceux déjà enregistrés
          ...(etape.pois && { pois: etape.pois }),
          photos: [...keptPhotos, ...newPhotos],
        }
      }),
    )

    trek.set({
      name: input.name,
      region: input.region,
      description: input.description,
      etapes,
    })
    await trek.save()
  } catch (err) {
    await Promise.all(writtenUrls.map((url) => removeUpload(url, trekId)))
    throw err
  }

  // 3. Ménage, une fois la base à jour : fichiers remplacés et étapes supprimées
  const removedEtapeIds = [...existingById.keys()].filter((etapeId) => !seenIds.has(etapeId))
  await Promise.all([
    ...obsoleteUrls.map((url) => removeUpload(url, trekId)),
    ...removedEtapeIds.map((etapeId) => removeEtapeFiles(trekId, etapeId)),
  ])

  return trek
}

// Tolérance de simplification des tracés de la carte d'accueil (~30 m) : invisible à
// l'échelle d'une région, et divise le poids des tracés par ~20
const MAP_TRACK_TOLERANCE_DEG = 0.0003

/**
 * Liste allégée : pas de profils ni de POI, seulement de quoi afficher une carte de trek
 * et son tracé simplifié (une ligne par étape) sur la carte d'accueil
 */
export async function listTrekSummaries() {
  const treks = await Trek.find()
    .select(
      'name region description createdAt etapes.distanceKm etapes.durationMin etapes.elevationGain etapes.photos etapes.gpxTrack',
    )
    .sort({ createdAt: -1 })
    .lean()

  return treks.map((trek) => {
    // Des documents créés avec l'ancien modèle (sans étapes) peuvent encore exister
    const etapes = trek.etapes ?? []
    const lines = etapes.flatMap((e) =>
      e.gpxTrack?.coordinates.length
        ? // Mongoose type mal les tableaux imbriqués ([[Number]]) : ce sont bien des [lon, lat]
          [
            simplifyLine(
              e.gpxTrack.coordinates as unknown as [number, number][],
              MAP_TRACK_TOLERANCE_DEG,
            ),
          ]
        : [],
    )
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
      track: lines.length ? { type: 'MultiLineString' as const, coordinates: lines } : null,
    }
  })
}
