import { HttpError } from '../lib/errors.js'
import { Trek } from '../models/Trek.js'
import { Variante } from '../models/Variante.js'
import type { VarianteInput } from '../validation/variante.js'
import { canEditTrek } from './trekService.js'

const MAX_VARIANTES_PER_USER = 10
const MAX_VARIANTES_PER_TREK = 30

interface TrekRef {
  owner?: unknown
  /** Identifiants des étapes, dans l'ordre du parcours */
  etapeIds: string[]
  /** Longueur de la trace de chaque étape (km), absente sans GPX : on ne peut pas la couper */
  trackKm: Map<string, number>
}

interface Cut {
  etape: string
  km: number
}

const EARTH_RADIUS_KM = 6371

function haversineKm([lon1, lat1]: number[], [lon2, lat2]: number[]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2! - lat1!)
  const dLon = toRad(lon2! - lon1!)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1!)) * Math.cos(toRad(lat2!)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

function lineLengthKm(coordinates: number[][]): number {
  let km = 0
  for (let i = 1; i < coordinates.length; i++)
    km += haversineKm(coordinates[i - 1]!, coordinates[i]!)
  return km
}

async function loadTrek(trekId: string): Promise<TrekRef> {
  const trek = await Trek.findById(trekId)
    .select('owner etapes._id etapes.order etapes.gpxTrack')
    .lean()
  if (!trek) throw new HttpError(404, 'Trek introuvable')
  const etapes = [...(trek.etapes ?? [])].sort((a, b) => a.order - b.order)
  const trackKm = new Map<string, number>()
  for (const etape of etapes) {
    // Mongoose type mal les tableaux imbriqués ([[Number]]) : ce sont bien des [lon, lat]
    const coordinates = etape.gpxTrack?.coordinates as unknown as number[][] | undefined
    if (coordinates && coordinates.length > 1) {
      trackKm.set(etape._id.toString(), lineLengthKm(coordinates))
    }
  }
  return { owner: trek.owner, etapeIds: etapes.map((e) => e._id.toString()), trackKm }
}

// Une nuit au milieu d'une étape doit tomber sur sa trace, ni au départ ni à l'arrivée
function cutsFit(cuts: Cut[], trek: TrekRef): boolean {
  return cuts.every(({ etape, km }) => {
    const length = trek.trackKm.get(etape)
    return length !== undefined && km > 0 && km < length
  })
}

function readCuts(cuts: unknown): Cut[] {
  return ((cuts as { etape: unknown; km: number }[] | undefined) ?? []).map(({ etape, km }) => ({
    etape: String(etape),
    km,
  }))
}

// Ordre canonique (étape puis km) : deux découpages identiques se comparent à l'identique
function sortCuts(cuts: Cut[], trek: TrekRef): Cut[] {
  return [...cuts].sort(
    (a, b) => trek.etapeIds.indexOf(a.etape) - trek.etapeIds.indexOf(b.etape) || a.km - b.km,
  )
}

// À 50 m près, deux nuits sont au même endroit
const sameCuts = (a: Cut[], b: Cut[]) =>
  a.length === b.length &&
  a.every((cut, i) => cut.etape === b[i]!.etape && Math.abs(cut.km - b[i]!.km) < 0.05)

// Un découpage est valide s'il reprend toutes les étapes, une seule fois, dans l'ordre :
// les groupes mis bout à bout redonnent exactement la liste des étapes
function coversEtapes(groups: string[][], etapeIds: string[]): boolean {
  const flat = groups.flat()
  return flat.length === etapeIds.length && flat.every((id, i) => id === etapeIds[i])
}

// Mongoose type mal les tableaux imbriqués ([[ObjectId]]) : ce sont bien des listes d'ids
function readGroups(groups: unknown): string[][] {
  return (groups as unknown[][]).map((group) => group.map(String))
}

const sameGroups = (a: string[][], b: string[][]) => JSON.stringify(a) === JSON.stringify(b)

/** L'auteur du découpage, et celui du trek (pour faire le ménage), peuvent le supprimer */
function canDeleteVariante(variante: { owner: unknown }, trek: TrekRef, userId?: string) {
  return !!userId && (String(variante.owner) === userId || canEditTrek(trek, userId))
}

function toResponse(
  variante: { _id: unknown; owner: unknown; groups: unknown; cuts?: unknown; createdAt?: Date },
  trek: TrekRef,
  userId?: string,
) {
  const groups = readGroups(variante.groups)
  const cuts = readCuts(variante.cuts)
  return {
    _id: String(variante._id),
    groups,
    cuts,
    createdAt: variante.createdAt,
    // Le trek a changé depuis (étape ajoutée, supprimée, réordonnée, trace raccourcie) :
    // à refaire
    isStale: !coversEtapes(groups, trek.etapeIds) || !cutsFit(cuts, trek),
    canDelete: canDeleteVariante(variante, trek, userId),
  }
}

/**
 * Découpages d'un trek, du plus long au plus court. Ceux devenus invalides ne sont
 * montrés qu'aux personnes qui peuvent les supprimer.
 */
export async function listVariantes(trekId: string, userId?: string) {
  const trek = await loadTrek(trekId)
  const variantes = await Variante.find({ trek: trekId }).lean()
  return variantes
    .map((v) => toResponse(v, trek, userId))
    .filter((v) => !v.isStale || v.canDelete)
    .sort((a, b) => b.groups.length + b.cuts.length - (a.groups.length + a.cuts.length))
}

/** Enregistre un découpage ; s'il existe déjà pour ce trek, renvoie l'existant (created: false) */
export async function createVariante(trekId: string, input: VarianteInput, userId: string) {
  const trek = await loadTrek(trekId)
  if (!coversEtapes(input.groups, trek.etapeIds)) {
    throw new HttpError(400, "Le découpage doit reprendre toutes les étapes du trek, dans l'ordre")
  }
  if (!cutsFit(input.cuts, trek)) {
    throw new HttpError(400, 'Une nuit ajoutée ne tombe pas sur la trace de son étape')
  }
  const cuts = sortCuts(input.cuts, trek)
  if (input.groups.length === trek.etapeIds.length && !cuts.length) {
    throw new HttpError(400, 'Ce découpage est identique à celui du trek')
  }

  const existing = await Variante.find({ trek: trekId }).lean()
  const duplicate = existing.find(
    (v) =>
      sameGroups(readGroups(v.groups), input.groups) &&
      sameCuts(sortCuts(readCuts(v.cuts), trek), cuts),
  )
  if (duplicate) return { created: false, variante: toResponse(duplicate, trek, userId) }

  if (existing.length >= MAX_VARIANTES_PER_TREK) {
    throw new HttpError(400, `Ce trek a déjà ${MAX_VARIANTES_PER_TREK} découpages`)
  }
  if (existing.filter((v) => String(v.owner) === userId).length >= MAX_VARIANTES_PER_USER) {
    throw new HttpError(
      400,
      `Maximum ${MAX_VARIANTES_PER_USER} découpages par personne et par trek`,
    )
  }

  const variante = await Variante.create({
    owner: userId,
    trek: trekId,
    groups: input.groups,
    cuts,
  })
  return { created: true, variante: toResponse(variante.toObject(), trek, userId) }
}

export async function deleteVariante(trekId: string, varianteId: string, userId: string) {
  const variante = await Variante.findOne({ _id: varianteId, trek: trekId }).select('owner').lean()
  if (!variante) throw new HttpError(404, 'Découpage introuvable')
  if (!canDeleteVariante(variante, await loadTrek(trekId), userId)) {
    throw new HttpError(403, "Seuls l'auteur du découpage et celui du trek peuvent le supprimer")
  }
  await Variante.deleteOne({ _id: varianteId })
}

/** Les variantes n'ont plus de sens sans leur trek */
export async function deleteTrekVariantes(trekId: string): Promise<void> {
  await Variante.deleteMany({ trek: trekId })
}
