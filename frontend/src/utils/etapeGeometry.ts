import type { ElevationPoint, Etape } from '../types/trek'
import { haversineKm } from './geo'

// Mesures le long de la trace d'une étape, pour la couper en morceaux (nuit au milieu
// d'une étape). Les positions sont des km mesurés sur la trace GPX, comme les distances
// du profil d'altitude. Les stats d'un morceau sont ramenées à celles de l'étape : si
// l'auteur a corrigé la distance ou le dénivelé, les morceaux s'additionnent quand même
// exactement aux valeurs affichées pour l'étape entière.

type LonLat = [number, number]

interface Geometry {
  /** Longueur de la trace (km) ; 0 sans trace */
  lengthKm: number
  /** km cumulés à chaque point de la trace */
  trackKm: number[]
  lons: number[]
  lats: number[]
  /** Profil : km, D+ et D- cumulés à chaque point (même filtre de bruit que l'import) */
  profileKm: number[]
  profileGain: number[]
  profileLoss: number[]
}

// Même seuil que l'analyse GPX : en dessous, une variation d'altitude est du bruit
const ELEVATION_NOISE_M = 3

const cache = new WeakMap<Etape, Geometry>()

function geometry(etape: Etape): Geometry {
  const cached = cache.get(etape)
  if (cached) return cached

  const coordinates = etape.gpxTrack?.coordinates ?? []
  const trackKm = [0]
  for (let i = 1; i < coordinates.length; i++) {
    trackKm.push(trackKm[i - 1]! + haversineKm(coordinates[i - 1]!, coordinates[i]!))
  }

  const profile = etape.elevationProfile ?? []
  const profileGain: number[] = []
  const profileLoss: number[] = []
  let reference = profile[0]?.elevation ?? 0
  let gain = 0
  let loss = 0
  for (const { elevation } of profile) {
    const delta = elevation - reference
    if (delta >= ELEVATION_NOISE_M) {
      gain += delta
      reference = elevation
    } else if (delta <= -ELEVATION_NOISE_M) {
      loss -= delta
      reference = elevation
    }
    profileGain.push(gain)
    profileLoss.push(loss)
  }

  const result: Geometry = {
    lengthKm: coordinates.length > 1 ? trackKm[trackKm.length - 1]! : 0,
    trackKm,
    lons: coordinates.map((c) => c[0]),
    lats: coordinates.map((c) => c[1]),
    profileKm: profile.map((p) => p.distanceKm),
    profileGain,
    profileLoss,
  }
  cache.set(etape, result)
  return result
}

/** Longueur de la trace (km) ; 0 si l'étape n'a pas de GPX */
export function trackLengthKm(etape: Etape): number {
  return geometry(etape).lengthKm
}

// Une étape trop courte (ou sans trace) ne se coupe pas
export function canCut(etape: Etape): boolean {
  return trackLengthKm(etape) > 0.5
}

/** Indice du dernier élément ≤ x dans un tableau croissant */
function lowerIndex(values: number[], x: number): number {
  let low = 0
  let high = values.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (values[mid]! <= x) low = mid
    else high = mid - 1
  }
  return low
}

function interpolate(kms: number[], values: number[], x: number): number {
  if (!kms.length) return 0
  const i = lowerIndex(kms, x)
  const next = Math.min(i + 1, kms.length - 1)
  const span = kms[next]! - kms[i]!
  const t = span > 0 ? Math.min(Math.max((x - kms[i]!) / span, 0), 1) : 0
  return values[i]! + (values[next]! - values[i]!) * t
}

/** Position sur la trace à `km` du départ */
export function pointAt(etape: Etape, km: number): LonLat | null {
  const { trackKm, lons, lats } = geometry(etape)
  if (!lons.length) return null
  return [interpolate(trackKm, lons, km), interpolate(trackKm, lats, km)]
}

/** Point de la trace le plus proche : sa position (km) et son écart à la trace (km) */
export function locateOnTrack(
  etape: Etape,
  point: LonLat,
): { km: number; offsetKm: number } | null {
  const coordinates = etape.gpxTrack?.coordinates
  if (!coordinates?.length) return null
  const { trackKm } = geometry(etape)
  let best = 0
  let bestKm = Infinity
  coordinates.forEach((coordinate, i) => {
    const distance = haversineKm(coordinate, point)
    if (distance < bestKm) {
      best = i
      bestKm = distance
    }
  })
  return { km: trackKm[best]!, offsetKm: bestKm }
}

/** Tracé entre deux positions (km), extrémités incluses */
export function sliceTrack(etape: Etape, fromKm: number, toKm: number): LonLat[] {
  const coordinates = etape.gpxTrack?.coordinates ?? []
  const { trackKm } = geometry(etape)
  const inside = coordinates.filter((_, i) => trackKm[i]! > fromKm && trackKm[i]! < toKm)
  const start = pointAt(etape, fromKm)
  const end = pointAt(etape, toKm)
  return [...(start ? [start] : []), ...inside, ...(end ? [end] : [])]
}

/** Profil d'altitude entre deux positions, distances ramenées au début du morceau */
export function sliceProfile(etape: Etape, fromKm: number, toKm: number): ElevationPoint[] {
  return (etape.elevationProfile ?? [])
    .filter((p) => p.distanceKm >= fromKm && p.distanceKm <= toKm)
    .map((p) => ({ ...p, distanceKm: p.distanceKm - fromKm }))
}

export interface PieceStats {
  distanceKm: number
  elevationGain: number
  elevationLoss: number
  durationMin: number
}

// « km-effort » (randonnée, trail) : 100 m de montée comptent comme 1 km de plat
const effort = (distanceKm: number, gain: number) => distanceKm + gain / 100

/**
 * Stats d'un morceau d'étape. Distance et dénivelé sont pris sur la trace et le profil,
 * ramenés aux valeurs de l'étape ; la durée de l'étape est répartie au prorata du
 * km-effort de chaque morceau.
 */
export function pieceStats(etape: Etape, fromKm: number, toKm: number): PieceStats {
  const geo = geometry(etape)
  if (!geo.lengthKm) {
    return {
      distanceKm: etape.distanceKm,
      elevationGain: etape.elevationGain,
      elevationLoss: etape.elevationLoss,
      durationMin: etape.durationMin,
    }
  }
  const share = (toKm - fromKm) / geo.lengthKm
  const distanceKm = etape.distanceKm * share

  const totalGain = geo.profileGain[geo.profileGain.length - 1] ?? 0
  const totalLoss = geo.profileLoss[geo.profileLoss.length - 1] ?? 0
  const between = (values: number[]) =>
    interpolate(geo.profileKm, values, toKm) - interpolate(geo.profileKm, values, fromKm)
  const elevationGain = totalGain
    ? (etape.elevationGain * between(geo.profileGain)) / totalGain
    : etape.elevationGain * share
  const elevationLoss = totalLoss
    ? (etape.elevationLoss * between(geo.profileLoss)) / totalLoss
    : etape.elevationLoss * share

  const etapeEffort = effort(etape.distanceKm, etape.elevationGain)
  const durationMin = etapeEffort
    ? (etape.durationMin * effort(distanceKm, elevationGain)) / etapeEffort
    : etape.durationMin * share

  return { distanceKm, elevationGain, elevationLoss, durationMin }
}
