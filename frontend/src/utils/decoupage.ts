import type { Difficulty, ElevationPoint, Etape, POI } from '../types/trek'
import {
  canCut,
  locateOnTrack,
  pieceStats,
  pointAt,
  sliceProfile,
  sliceTrack,
  trackLengthKm,
} from './etapeGeometry'
import { nearestLoadedOsmPoi } from './overpass'

// Découpage personnalisé d'un trek : on choisit où dormir. Rien n'est modifié dans le
// trek, les journées sont recalculées à l'affichage.
// - `nights[i]` vaut true si l'on dort à l'arrivée de l'étape i (entre i et i + 1) ;
//   retirer une nuit fusionne les deux étapes voisines.
// - `cuts` ajoute des nuits au milieu d'une étape (« nuit au refuge, km 8,2 ») : l'étape
//   est alors coupée en morceaux, répartis sur plusieurs journées.

export interface Cut {
  /** Position de l'étape (à partir de 0) */
  etape: number
  /** km depuis le départ de l'étape, mesurés sur sa trace */
  km: number
}

export interface Decoupage {
  nights: boolean[]
  cuts: Cut[]
}

/** Morceau d'étape parcouru dans une journée */
export interface Piece {
  etape: Etape
  /** Position de l'étape (à partir de 0) */
  index: number
  fromKm: number
  toKm: number
  /** Étape entière (pas coupée) */
  whole: boolean
}

/** Journée affichée : une étape d'origine, ou des étapes / morceaux regroupés */
export interface DisplayEtape extends Etape {
  /** Étapes d'origine concernées ; absent pour une étape inchangée */
  sources?: Etape[]
  /** Morceaux d'étapes de la journée ; absent pour une étape inchangée */
  pieces?: Piece[]
}

// Séparateur des identifiants dans l'URL d'une journée (/etapes/<id1>+<id2>@0.00-8.20)
const ID_SEPARATOR = '+'
// Deux nuits à moins de 300 m l'une de l'autre, ou d'un bout d'étape, n'ont pas de sens
export const MIN_CUT_GAP_KM = 0.3

const DIFFICULTY_RANK: Difficulty[] = ['facile', 'moyen', 'difficile', 'tres_difficile']

/** Découpage d'origine : une nuit après chaque étape, aucune coupe */
export function defaultNights(etapeCount: number): boolean[] {
  return Array.from({ length: Math.max(etapeCount - 1, 0) }, () => true)
}

export function defaultDecoupage(etapeCount: number): Decoupage {
  return { nights: defaultNights(etapeCount), cuts: [] }
}

export function isDefaultDecoupage({ nights, cuts }: Decoupage): boolean {
  return nights.every(Boolean) && !cuts.length
}

/** Positions (à partir de 0) des étapes d'origine de chaque groupe (fusion seule) */
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
 * Renvoie null s'il ne décrit pas toutes les étapes, dans l'ordre et sans trou.
 */
export function parseNights(value: unknown, etapeCount: number): boolean[] | null {
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

/** Inverse de parseNights ; null pour le découpage d'origine (rien à mettre dans l'URL) */
export function serializeNights(nights: boolean[]): string | null {
  if (nights.every(Boolean)) return null
  return groupIndexes(nights)
    .map((group) => {
      const first = group[0]! + 1
      const last = group[group.length - 1]! + 1
      return first === last ? String(first) : `${first}-${last}`
    })
    .join(',')
}

/** Garde les coupes valides (sur la trace, assez espacées), triées par étape puis km */
export function normalizeCuts(cuts: Cut[], etapes: Etape[]): Cut[] {
  const sorted = [...cuts].sort((a, b) => a.etape - b.etape || a.km - b.km)
  const kept: Cut[] = []
  for (const cut of sorted) {
    const etape = etapes[cut.etape]
    if (!etape || !canCut(etape)) continue
    const length = trackLengthKm(etape)
    if (cut.km < MIN_CUT_GAP_KM || cut.km > length - MIN_CUT_GAP_KM) continue
    const previous = kept[kept.length - 1]
    if (previous?.etape === cut.etape && cut.km - previous.km < MIN_CUT_GAP_KM) continue
    kept.push(cut)
  }
  return kept
}

/** Paramètre d'URL `coupes` : « 3@8.20,5@4.75 » (étape à partir de 1, km) */
export function parseCuts(value: unknown, etapes: Etape[]): Cut[] {
  if (typeof value !== 'string' || !value) return []
  const cuts = value.split(',').flatMap((part): Cut[] => {
    const match = /^(\d+)@(\d+(?:\.\d+)?)$/.exec(part.trim())
    return match ? [{ etape: Number(match[1]) - 1, km: Number(match[2]) }] : []
  })
  return normalizeCuts(cuts, etapes)
}

export function serializeCuts(cuts: Cut[]): string | null {
  return cuts.length ? cuts.map((c) => `${c.etape + 1}@${c.km.toFixed(2)}`).join(',') : null
}

/** Clé unique d'un découpage, pour comparer deux découpages */
export function decoupageKey({ nights, cuts }: Decoupage): string {
  return `${serializeNights(nights) ?? ''}|${serializeCuts(cuts) ?? ''}`
}

/** Découpage enregistré (identifiants d'étapes) → découpage affichable ; null s'il ne colle plus */
export function decoupageFromSaved(
  groups: string[][],
  cuts: { etape: string; km: number }[],
  etapes: Etape[],
): Decoupage | null {
  const flat = groups.flat()
  if (flat.length !== etapes.length || flat.some((id, i) => id !== etapes[i]?._id)) return null
  const nights = defaultNights(etapes.length)
  let position = 0
  for (const group of groups) {
    position += group.length
    for (let i = position - group.length; i < position - 1; i++) nights[i] = false
  }
  const indexed = cuts.map((cut) => ({
    etape: etapes.findIndex((e) => e._id === cut.etape),
    km: cut.km,
  }))
  const valid = normalizeCuts(indexed, etapes)
  return valid.length === cuts.length ? { nights, cuts: valid } : null
}

/** Découpage affichable → format enregistré (identifiants d'étapes) */
export function decoupageToSaved({ nights, cuts }: Decoupage, etapes: Etape[]) {
  return {
    groups: groupIndexes(nights).map((group) => group.map((i) => etapes[i]!._id)),
    cuts: cuts.map((cut) => ({
      etape: etapes[cut.etape]!._id,
      km: Math.round(cut.km * 100) / 100,
    })),
  }
}

/** Nombre de journées d'un découpage */
export function dayCount({ nights, cuts }: Decoupage): number {
  return nights.filter(Boolean).length + 1 + cuts.length
}

/** Journées du découpage, chacune décrite par ses morceaux d'étapes */
export function decoupageDays(etapes: Etape[], { nights, cuts }: Decoupage): Piece[][] {
  const days: Piece[][] = []
  let current: Piece[] = []
  etapes.forEach((etape, index) => {
    const etapeCuts = cuts.filter((c) => c.etape === index).map((c) => c.km)
    if (!etapeCuts.length) {
      current.push({ etape, index, fromKm: 0, toKm: trackLengthKm(etape), whole: true })
    } else {
      const bounds = [0, ...etapeCuts, trackLengthKm(etape)]
      for (let k = 0; k < bounds.length - 1; k++) {
        current.push({ etape, index, fromKm: bounds[k]!, toKm: bounds[k + 1]!, whole: false })
        // Nuit à la coupe
        if (k < bounds.length - 2) {
          days.push(current)
          current = []
        }
      }
    }
    if (index < etapes.length - 1 && nights[index]) {
      days.push(current)
      current = []
    }
  })
  if (current.length) days.push(current)
  return days
}

// --- Noms ---

const NAME_ARROW = /\s*(?:→|->)\s*/
const LODGING_TYPES: POI['type'][] = ['refuge', 'camping']
// Un hébergement à moins de 200 m (le long de la trace) d'une coupe lui donne son nom
const LODGING_MATCH_KM = 0.2

export function formatKm(km: number): string {
  return km.toFixed(1).replace('.', ',')
}

/** Nom d'une nuit au milieu d'une étape : hébergement tout proche, sinon « km 8,2 » */
export function cutName(etape: Etape, km: number): string {
  const lodging = etape.pois.find((poi) => {
    if (!LODGING_TYPES.includes(poi.type)) return false
    const located = locateOnTrack(etape, poi.location.coordinates)
    return located && Math.abs(located.km - km) <= LODGING_MATCH_KM && located.offsetKm <= 0.3
  })
  if (lodging) return lodging.name
  const point = pointAt(etape, km)
  const osm = point && nearestLoadedOsmPoi(point, LODGING_MATCH_KM)
  if (osm && LODGING_TYPES.includes(osm.type) && osm.name !== osm.kind) return osm.name
  return `km ${formatKm(km)} de « ${etape.name} »`
}

function startName(piece: Piece): string {
  if (piece.fromKm > 0) return cutName(piece.etape, piece.fromKm)
  const parts = piece.etape.name.split(NAME_ARROW)
  return parts.length > 1 ? parts[0]! : `début de « ${piece.etape.name} »`
}

function endName(piece: Piece): string {
  if (!piece.whole && piece.toKm < trackLengthKm(piece.etape)) {
    return cutName(piece.etape, piece.toKm)
  }
  const parts = piece.etape.name.split(NAME_ARROW)
  return parts.length > 1 ? parts[parts.length - 1]! : `fin de « ${piece.etape.name} »`
}

// Fusion d'étapes entières : « Les Houches → Les Contamines » + « Les Contamines → Les
// Chapieux » → « Les Houches → Les Chapieux » ; sans flèche, les noms bout à bout
function dayName(pieces: Piece[]): string {
  const first = pieces[0]!
  const last = pieces[pieces.length - 1]!
  if (pieces.every((p) => p.whole)) {
    const start = first.etape.name.split(NAME_ARROW)
    const end = last.etape.name.split(NAME_ARROW)
    if (start.length > 1 && end.length > 1) return `${start[0]} → ${end[end.length - 1]}`
    return pieces.map((p) => p.etape.name).join(' + ')
  }
  return `${startName(first)} → ${endName(last)}`
}

/** « étape 2 + étape 3 (km 0 → 8,2) », pour expliquer d'où vient une journée */
export function describePieces(pieces: Piece[]): string {
  return pieces
    .map((p) =>
      p.whole
        ? `étape ${p.etape.order}`
        : `étape ${p.etape.order} (km ${formatKm(p.fromKm)} → ${formatKm(p.toKm)})`,
    )
    .join(' + ')
}

// --- Journée affichée ---

function pieceId(piece: Piece): string {
  return piece.whole
    ? piece.etape._id
    : `${piece.etape._id}@${piece.fromKm.toFixed(2)}-${piece.toKm.toFixed(2)}`
}

function piecePois(piece: Piece): POI[] {
  if (piece.whole) return piece.etape.pois
  return piece.etape.pois.filter((poi) => {
    const located = locateOnTrack(piece.etape, poi.location.coordinates)
    // Un point exactement à la coupe va avec le morceau qui y arrive (on y dort)
    return located && located.km > piece.fromKm && located.km <= piece.toKm + 0.01
  })
}

function buildDay(pieces: Piece[], order: number): DisplayEtape {
  const first = pieces[0]!
  if (pieces.length === 1 && first.whole) return { ...first.etape, order }

  const stats = pieces.map((p) =>
    p.whole
      ? {
          distanceKm: p.etape.distanceKm,
          elevationGain: p.etape.elevationGain,
          elevationLoss: p.etape.elevationLoss,
          durationMin: p.etape.durationMin,
        }
      : pieceStats(p.etape, p.fromKm, p.toKm),
  )
  const sum = (key: keyof (typeof stats)[number]) => stats.reduce((total, s) => total + s[key], 0)

  // Tracés et profils mis bout à bout, chaque profil repartant où s'arrête le précédent
  const track = pieces.flatMap((p) =>
    p.whole ? (p.etape.gpxTrack?.coordinates ?? []) : sliceTrack(p.etape, p.fromKm, p.toKm),
  )
  let offsetKm = 0
  const profile: ElevationPoint[] = pieces.flatMap((p) => {
    const points = p.whole
      ? (p.etape.elevationProfile ?? [])
      : sliceProfile(p.etape, p.fromKm, p.toKm)
    const shifted = points.map((point) => ({ ...point, distanceKm: point.distanceKm + offsetKm }))
    offsetKm += p.whole
      ? (points[points.length - 1]?.distanceKm ?? p.etape.distanceKm)
      : p.toKm - p.fromKm
    return shifted
  })

  const sources = [...new Set(pieces.map((p) => p.etape))]
  const hardest = Math.max(...sources.map((e) => DIFFICULTY_RANK.indexOf(e.difficulty)))

  return {
    _id: pieces.map(pieceId).join(ID_SEPARATOR),
    order,
    name: dayName(pieces),
    description: sources
      .filter((e) => e.description?.trim())
      .map((e) => `${e.name}\n${e.description!.trim()}`)
      .join('\n\n'),
    difficulty: DIFFICULTY_RANK[hardest] ?? first.etape.difficulty,
    distanceKm: Math.round(sum('distanceKm') * 10) / 10,
    elevationGain: Math.round(sum('elevationGain')),
    elevationLoss: Math.round(sum('elevationLoss')),
    durationMin: Math.round(sum('durationMin')),
    gpxTrack: track.length > 1 ? { type: 'LineString', coordinates: track } : undefined,
    elevationProfile: profile.length ? profile : undefined,
    pois: pieces.flatMap(piecePois),
    // Les photos n'ont pas de position : elles vont avec le début de leur étape
    photos: pieces.flatMap((p) => (p.fromKm === 0 ? (p.etape.photos ?? []) : [])),
    sources,
    pieces,
  }
}

/** Journées à afficher pour un découpage ; une étape inchangée garde son identifiant */
export function mergeEtapes(etapes: Etape[], decoupage: Decoupage): DisplayEtape[] {
  if (!etapes.length) return []
  return decoupageDays(etapes, decoupage).map((pieces, index) => buildDay(pieces, index + 1))
}
