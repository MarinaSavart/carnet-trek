import type { ElevationPoint, GeoJSONLineString, POI, POIType } from '../types/trek'

export interface ParsedGpx {
  name?: string
  track: GeoJSONLineString
  elevationProfile: ElevationPoint[]
  waypoints: POI[]
  distanceKm: number
  elevationGain: number
  elevationLoss: number
  /** Absent si le fichier ne contient pas d'horodatage */
  durationMin?: number
}

// Symboles GPX (Garmin, repris par Komoot) → types de POI de l'appli
const SYMBOL_TO_POI_TYPE: Record<string, POIType> = {
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

// En dessous de ce seuil, une variation d'altitude est traitée comme du bruit GPS :
// sans ça, le D+ / D- est largement surestimé sur les tracés enregistrés.
const ELEVATION_NOISE_M = 3

const EARTH_RADIUS_KM = 6371

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
  return [Number(el.getAttribute('lon')), Number(el.getAttribute('lat'))]
}

export function computeElevationDelta(elevations: number[]): { gain: number; loss: number } {
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

// Préfixes écrits à l'export (voir frontend/src/utils/gpxWaypoints.ts) : retirés du nom,
// ils donnent le type quand le fichier n'a pas de symbole reconnu
const NAME_PREFIX_TO_POI_TYPE: Record<string, POIType> = {
  EAU: 'point_eau',
  REFUGE: 'refuge',
  CAMPING: 'camping',
  SOMMET: 'sommet',
  RAVITO: 'ravitaillement',
}
const NAME_PREFIX = /^(EAU|REFUGE|CAMPING|SOMMET|RAVITO) · (.+)$/

function readPoiNameAndType(wpt: Element): { name: string; type: POIType } {
  const rawName = childText(wpt, 'name') ?? 'Point sans nom'
  const symbolType = SYMBOL_TO_POI_TYPE[childText(wpt, 'sym')?.toLowerCase() ?? '']
  const prefixed = NAME_PREFIX.exec(rawName)
  return {
    name: prefixed ? prefixed[2]! : rawName,
    type: symbolType ?? (prefixed ? NAME_PREFIX_TO_POI_TYPE[prefixed[1]!] : undefined) ?? 'autre',
  }
}

export function parseGpx(xml: string, idPrefix = 'gpx'): ParsedGpx {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('Fichier GPX invalide')
  }

  // Un tracé peut être découpé en plusieurs segments (pauses) : on les met bout à bout
  const points = Array.from(doc.getElementsByTagName('trkpt'))
  const coordinates = points.map(readLonLat)
  const times = points
    .map((p) => Date.parse(childText(p, 'time') ?? ''))
    .filter((t) => Number.isFinite(t))

  // Distance cumulée à chaque point : sert au total et à l'axe du profil d'altitude
  const cumulativeKm = [0]
  for (let i = 1; i < coordinates.length; i++) {
    cumulativeKm.push(cumulativeKm[i - 1]! + haversineKm(coordinates[i - 1]!, coordinates[i]!))
  }
  const distanceKm = cumulativeKm[cumulativeKm.length - 1] ?? 0

  const elevationProfile = points.flatMap((p, i): ElevationPoint[] => {
    const elevation = Number(childText(p, 'ele'))
    return Number.isFinite(elevation)
      ? [{ distanceKm: cumulativeKm[i]!, elevation, coordinates: coordinates[i]! }]
      : []
  })

  const { gain, loss } = computeElevationDelta(elevationProfile.map((p) => p.elevation))
  const firstTime = times[0]
  const lastTime = times[times.length - 1]

  const waypoints = Array.from(doc.getElementsByTagName('wpt')).map((wpt, index): POI => ({
    _id: `${idPrefix}-wpt-${index}`,
    ...readPoiNameAndType(wpt),
    notes: childText(wpt, 'desc'),
    location: { type: 'Point', coordinates: readLonLat(wpt) },
  }))

  return {
    name: childText(doc.documentElement, 'name'),
    track: { type: 'LineString', coordinates },
    elevationProfile,
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
