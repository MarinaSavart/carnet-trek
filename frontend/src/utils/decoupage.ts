import type { Difficulty, ElevationPoint, Etape } from '../types/trek'

// Découpage personnalisé d'un trek : on choisit où dormir entre les étapes d'origine.
// `nights[i]` vaut true si l'on dort à l'arrivée de l'étape i (donc entre i et i + 1) ;
// retirer une nuit fusionne les deux étapes voisines. Rien n'est modifié dans le trek :
// les étapes fusionnées sont recalculées à l'affichage.

/** Étape affichée : une étape d'origine, ou plusieurs fusionnées (`sources`) */
export interface DisplayEtape extends Etape {
  /** Étapes d'origine regroupées ; absent pour une étape non fusionnée */
  sources?: Etape[]
}

// Séparateur des identifiants d'étapes fusionnées dans l'URL (/etapes/<id1>+<id2>)
const ID_SEPARATOR = '+'

const DIFFICULTY_RANK: Difficulty[] = ['facile', 'moyen', 'difficile', 'tres_difficile']

/** Découpage d'origine : une nuit après chaque étape */
export function defaultNights(etapeCount: number): boolean[] {
  return Array.from({ length: Math.max(etapeCount - 1, 0) }, () => true)
}

export function isDefaultNights(nights: boolean[]): boolean {
  return nights.every(Boolean)
}

/** Positions (à partir de 0) des étapes d'origine de chaque groupe */
export function groupIndexes(nights: boolean[]): number[][] {
  const groups: number[][] = [[0]]
  nights.forEach((night, i) => {
    if (night) groups.push([i + 1])
    else groups[groups.length - 1]!.push(i + 1)
  })
  return groups
}

/**
 * Lit le paramètre d'URL `decoupage` (ex. « 1-2,3,4-6 », positions à partir de 1).
 * Renvoie null s'il ne décrit pas toutes les étapes, dans l'ordre et sans trou :
 * le trek s'affiche alors dans son découpage d'origine.
 */
export function parseDecoupage(value: unknown, etapeCount: number): boolean[] | null {
  if (typeof value !== 'string' || !value || etapeCount < 1) return null
  const nights = defaultNights(etapeCount)
  let expected = 1

  for (const part of value.split(',')) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part.trim())
    if (!match) return null
    const first = Number(match[1])
    const last = match[2] ? Number(match[2]) : first
    if (first !== expected || last < first || last > etapeCount) return null
    for (let position = first; position < last; position++) nights[position - 1] = false
    expected = last + 1
  }
  return expected === etapeCount + 1 ? nights : null
}

/** Inverse de parseDecoupage ; null pour le découpage d'origine (rien à mettre dans l'URL) */
export function serializeDecoupage(nights: boolean[]): string | null {
  if (isDefaultNights(nights)) return null
  return groupIndexes(nights)
    .map((group) => {
      const first = group[0]! + 1
      const last = group[group.length - 1]! + 1
      return first === last ? String(first) : `${first}-${last}`
    })
    .join(',')
}

/** Découpage décrit par des groupes d'identifiants (variante enregistrée) ; null s'il ne colle plus au trek */
export function nightsFromGroups(groups: string[][], etapes: Etape[]): boolean[] | null {
  const flat = groups.flat()
  if (flat.length !== etapes.length || flat.some((id, i) => id !== etapes[i]?._id)) return null
  const nights = defaultNights(etapes.length)
  let position = 0
  for (const group of groups) {
    position += group.length
    // Pas de nuit à l'intérieur d'un groupe
    for (let i = position - group.length; i < position - 1; i++) nights[i] = false
  }
  return nights
}

export function groupsOfIds(nights: boolean[], etapes: Etape[]): string[][] {
  return groupIndexes(nights).map((group) => group.map((i) => etapes[i]!._id))
}

export function mergedEtapeId(etapes: Etape[]): string {
  return etapes.map((e) => e._id).join(ID_SEPARATOR)
}

// « Les Houches → Les Contamines » + « Les Contamines → Les Chapieux »
// → « Les Houches → Les Chapieux ». Sans flèche, les noms sont mis bout à bout.
const NAME_ARROW = /\s*(?:→|->)\s*/

function mergedName(etapes: Etape[]): string {
  const start = etapes[0]!.name.split(NAME_ARROW)
  const end = etapes[etapes.length - 1]!.name.split(NAME_ARROW)
  if (start.length > 1 && end.length > 1) return `${start[0]} → ${end[end.length - 1]}`
  return etapes.map((e) => e.name).join(' + ')
}

function mergedDescription(etapes: Etape[]): string {
  return etapes
    .filter((e) => e.description?.trim())
    .map((e) => `${e.name}\n${e.description!.trim()}`)
    .join('\n\n')
}

// Profils mis bout à bout : chaque profil repart de la distance où s'arrête le précédent
function mergedProfile(etapes: Etape[]): ElevationPoint[] | undefined {
  let offsetKm = 0
  const points = etapes.flatMap((etape) => {
    const profile = etape.elevationProfile ?? []
    const shifted = profile.map((p) => ({ ...p, distanceKm: p.distanceKm + offsetKm }))
    offsetKm += profile[profile.length - 1]?.distanceKm ?? etape.distanceKm
    return shifted
  })
  return points.length ? points : undefined
}

function mergeGroup(etapes: Etape[], order: number): DisplayEtape {
  const tracks = etapes.flatMap((e) => e.gpxTrack?.coordinates ?? [])
  const hardest = Math.max(...etapes.map((e) => DIFFICULTY_RANK.indexOf(e.difficulty)))
  const sum = (stat: (e: Etape) => number) => etapes.reduce((total, e) => total + stat(e), 0)

  return {
    _id: mergedEtapeId(etapes),
    order,
    name: mergedName(etapes),
    description: mergedDescription(etapes),
    difficulty: DIFFICULTY_RANK[hardest] ?? etapes[0]!.difficulty,
    distanceKm: Math.round(sum((e) => e.distanceKm) * 10) / 10,
    elevationGain: sum((e) => e.elevationGain),
    elevationLoss: sum((e) => e.elevationLoss),
    durationMin: sum((e) => e.durationMin),
    gpxTrack: tracks.length ? { type: 'LineString', coordinates: tracks } : undefined,
    elevationProfile: mergedProfile(etapes),
    pois: etapes.flatMap((e) => e.pois),
    photos: etapes.flatMap((e) => e.photos ?? []),
    sources: etapes,
  }
}

/** Étapes à afficher pour un découpage ; les étapes non fusionnées gardent leur identifiant */
export function mergeEtapes(etapes: Etape[], nights: boolean[]): DisplayEtape[] {
  if (!etapes.length) return []
  return groupIndexes(nights).map((group, index) => {
    const members = group.map((i) => etapes[i]!)
    return members.length === 1
      ? { ...members[0]!, order: index + 1 }
      : mergeGroup(members, index + 1)
  })
}
