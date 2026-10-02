import type { GeoJSONMultiLineString } from '../types/trek'

/** [ouest, sud, est, nord], en degrés */
export type BBox = [number, number, number, number]

const EARTH_RADIUS_KM = 6371

export function haversineKm([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

export function trackBBox(track: GeoJSONMultiLineString): BBox {
  const bbox: BBox = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [lon, lat] of track.coordinates.flat()) {
    bbox[0] = Math.min(bbox[0], lon)
    bbox[1] = Math.min(bbox[1], lat)
    bbox[2] = Math.max(bbox[2], lon)
    bbox[3] = Math.max(bbox[3], lat)
  }
  return bbox
}

export function bboxIntersects(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
}

/** Distance du point au sommet le plus proche du tracé (simplifié : précision ~ centaine de m) */
export function distanceToTrackKm(point: [number, number], track: GeoJSONMultiLineString) {
  let min = Infinity
  for (const coord of track.coordinates.flat()) min = Math.min(min, haversineKm(point, coord))
  return min
}
