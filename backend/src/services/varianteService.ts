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
}

async function loadTrek(trekId: string): Promise<TrekRef> {
  const trek = await Trek.findById(trekId).select('owner etapes._id etapes.order').lean()
  if (!trek) throw new HttpError(404, 'Trek introuvable')
  const etapeIds = [...(trek.etapes ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((e) => e._id.toString())
  return { owner: trek.owner, etapeIds }
}

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
  variante: { _id: unknown; owner: unknown; groups: unknown; createdAt?: Date },
  trek: TrekRef,
  userId?: string,
) {
  const groups = readGroups(variante.groups)
  return {
    _id: String(variante._id),
    groups,
    createdAt: variante.createdAt,
    // Le trek a changé depuis (étape ajoutée, supprimée ou réordonnée) : à refaire
    isStale: !coversEtapes(groups, trek.etapeIds),
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
    .sort((a, b) => b.groups.length - a.groups.length)
}

/** Enregistre un découpage ; s'il existe déjà pour ce trek, renvoie l'existant (created: false) */
export async function createVariante(trekId: string, input: VarianteInput, userId: string) {
  const trek = await loadTrek(trekId)
  if (!coversEtapes(input.groups, trek.etapeIds)) {
    throw new HttpError(400, "Le découpage doit reprendre toutes les étapes du trek, dans l'ordre")
  }
  if (input.groups.length === trek.etapeIds.length) {
    throw new HttpError(400, 'Ce découpage est identique à celui du trek')
  }

  const existing = await Variante.find({ trek: trekId }).lean()
  const duplicate = existing.find((v) => sameGroups(readGroups(v.groups), input.groups))
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

  const variante = await Variante.create({ owner: userId, trek: trekId, groups: input.groups })
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
