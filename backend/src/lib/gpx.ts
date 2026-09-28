import { DOMParser, type Element } from '@xmldom/xmldom'
import type { PoiType } from '../models/Trek.js'

// Même logique que frontend/src/utils/gpx.ts : le front s'en sert pour pré-remplir le
// formulaire, le serveur pour les données qui font foi. Garder les deux alignés.

export interface ParsedPoi {
  type: PoiType
  name: string
  notes?: string
  location: { type: 'Point'; coordinates: [number, number] }
}

export interface ParsedGpx {
  name?: string
  track: { type: 'LineString'; coordinates: [number, number][] }
  elevationProfile: { distanceKm: number; elevation: number; coordinates: [number, number] }[]
  waypoints: ParsedPoi[]
  distanceKm: number
  elevationGain: number
  elevationLoss: number
  /** Absent si le fichier ne contient pas d'horodatage */
  durationMin?: number
}

// Symboles GPX (Garmin, repris par Komoot) → types de POI de l'appli
const SYMBOL_TO_POI_TYPE: Record<string, PoiType> = {
  'drinking water': 'point_eau',
  summit: 'sommet',
  'picnic area': 'camping',
  campground: 'camping',
  // Komoot exporte les refuges / hébergements sous ce symbole
  'fishing hot spot facility': 'refuge',
  lodging: 'refuge',
  restaurant: 'ravitaillement',
  'convenience store': 'ravitaillement',
  'shopping center': 'ravitaillement',
}

// En dessous de ce seuil, une variation d'altitude est traitée comme du bruit GPS
const ELEVATION_NOISE_M = 3
const EARTH_RADIUS_KM = 6371

// Profil d'altitude stocké : au-delà, on sous-échantillonne (inutile pour un graphique
// de quelques centaines de pixels, et ça allège le document Mongo)
const MAX_PROFILE_POINTS = 1500

export class GpxError extends Error {}

function haversineKm([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

function childText(el: Element, tag: string): string | undefined {
  return el.getElementsByTagName(tag)[0]?.textContent?.trim() || undefined
}

// Attention à l'ordre : le GPX stocke lat/lon, GeoJSON attend [lon, lat]
function readLonLat(el: Element): [number, number] {
  const lon = Number(el.getAttribute('lon'))
  const lat = Number(el.getAttribute('lat'))
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new GpxError('Coordonnées GPX invalides')
  }
  return [lon, lat]
}

function computeElevationDelta(elevations: number[]): { gain: number; loss: number } {
  let gain = 0
  let loss = 0
  let reference = elevations[0]
  if (reference === undefined) return { gain, loss }

  for (const ele of elevations) {
    const delta = ele - reference
    if (delta >= ELEVATION_NOISE_M) {
      gain += delta
      reference = ele
    } else if (delta <= -ELEVATION_NOISE_M) {
      loss -= delta
      reference = ele
    }
  }
  return { gain: Math.round(gain), loss: Math.round(loss) }
}

function downsample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items
  const step = (items.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => items[Math.round(i * step)]!)
}

export function parseGpx(xml: string): ParsedGpx {
  let doc
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml')
  } catch {
    throw new GpxError('Fichier GPX illisible')
  }
  if (doc.documentElement?.nodeName !== 'gpx') throw new GpxError("Ce fichier n'est pas un GPX")

  // Un tracé peut être découpé en plusieurs segments (pauses) : on les met bout à bout
  const points = Array.from(doc.getElementsByTagName('trkpt'))
  if (points.length < 2) throw new GpxError('Le fichier GPX ne contient pas de tracé')

  const coordinates = points.map(readLonLat)
  const times = points
    .map((p) => Date.parse(childText(p, 'time') ?? ''))
    .filter((t) => Number.isFinite(t))

  const cumulativeKm = [0]
  for (let i = 1; i < coordinates.length; i++) {
    cumulativeKm.push(cumulativeKm[i - 1]! + haversineKm(coordinates[i - 1]!, coordinates[i]!))
  }
  const distanceKm = cumulativeKm[cumulativeKm.length - 1] ?? 0

  const elevationProfile = points.flatMap((p, i) => {
    const elevation = Number(childText(p, 'ele'))
    return Number.isFinite(elevation)
      ? [{ distanceKm: cumulativeKm[i]!, elevation, coordinates: coordinates[i]! }]
      : []
  })

  const { gain, loss } = computeElevationDelta(elevationProfile.map((p) => p.elevation))
  const firstTime = times[0]
  const lastTime = times[times.length - 1]

  const waypoints = Array.from(doc.getElementsByTagName('wpt')).map((wpt): ParsedPoi => ({
    type: SYMBOL_TO_POI_TYPE[childText(wpt, 'sym')?.toLowerCase() ?? ''] ?? 'autre',
    name: childText(wpt, 'name') ?? 'Point sans nom',
    notes: childText(wpt, 'desc'),
    location: { type: 'Point', coordinates: readLonLat(wpt) },
  }))

  return {
    name: childText(doc.documentElement, 'name'),
    track: { type: 'LineString', coordinates },
    elevationProfile: downsample(elevationProfile, MAX_PROFILE_POINTS),
    waypoints,
    distanceKm: Math.round(distanceKm * 10) / 10,
    elevationGain: gain,
    elevationLoss: loss,
    durationMin:
      firstTime !== undefined && lastTime !== undefined && lastTime > firstTime
        ? Math.round((lastTime - firstTime) / 60_000)
        : undefined,
  }
}
