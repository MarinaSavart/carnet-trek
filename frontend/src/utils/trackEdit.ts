import type { ElevationPoint, POI } from '../types/trek'
import { computeElevationDelta } from './gpx'
import { haversineKm } from './geo'
import { escapeXml, poiWaypointXml } from './gpxWaypoints'

// Modèle de l'éditeur de trace : des poignées (points de contrôle) reliées par des
// tronçons. Un GPX importé démarre avec deux poignées (départ, arrivée) et un seul tronçon
// « enregistré » : ses milliers de points ne deviennent jamais des poignées, et seule la
// portion touchée par une modification est recalculée.
//
// Toutes les opérations sont pures : elles renvoient une nouvelle trace (annuler /
// rétablir = garder les versions précédentes). Le calcul d'un tronçon (en suivant les
// sentiers) est fourni par l'appelant.

/** [longitude, latitude, altitude (null si inconnue)] */
export type TrackPoint = [number, number, number | null]
export type LonLat = [number, number]

export type SegmentKind =
  /** Portion du GPX d'origine, gardée telle quelle */
  | 'recorded'
  /** Calculée en suivant les sentiers */
  | 'routed'

export interface Segment {
  kind: SegmentKind
  points: TrackPoint[]
}

/** `segments[i]` relie `controls[i]` à `controls[i + 1]` */
export interface EditableTrack {
  controls: LonLat[]
  segments: Segment[]
}

/** Calcule le tronçon entre deux poignées */
export type SegmentRouter = (from: LonLat, to: LonLat) => Promise<Segment>

// Modifier une portion d'une trace enregistrée : on recalcule autant de part et d'autre du
// point attrapé, le reste du GPX ne bouge pas
const ANCHOR_DISTANCE_KM = 0.5

const lonLat = (point: TrackPoint): LonLat => [point[0], point[1]]

export function emptyTrack(): EditableTrack {
  return { controls: [], segments: [] }
}

export function trackFromPoints(points: TrackPoint[]): EditableTrack {
  if (points.length < 2) return emptyTrack()
  return {
    controls: [lonLat(points[0]!), lonLat(points[points.length - 1]!)],
    segments: [{ kind: 'recorded', points }],
  }
}

/** Ajoute une poignée à la fin (ou au début) ; la première poignée pose le départ */
export async function addControl(
  track: EditableTrack,
  point: LonLat,
  route: SegmentRouter,
  atStart = false,
): Promise<EditableTrack> {
  if (!track.controls.length) return { controls: [point], segments: [] }
  if (atStart) {
    const segment = await route(point, track.controls[0]!)
    return { controls: [point, ...track.controls], segments: [segment, ...track.segments] }
  }
  const segment = await route(track.controls[track.controls.length - 1]!, point)
  return { controls: [...track.controls, point], segments: [...track.segments, segment] }
}

/** Déplace une poignée : ses deux tronçons voisins sont recalculés */
export async function moveControl(
  track: EditableTrack,
  index: number,
  point: LonLat,
  route: SegmentRouter,
): Promise<EditableTrack> {
  const controls = track.controls.map((c, i) => (i === index ? point : c))
  const segments = [...track.segments]
  const [before, after] = await Promise.all([
    index > 0 ? route(controls[index - 1]!, point) : null,
    index < controls.length - 1 ? route(point, controls[index + 1]!) : null,
  ])
  if (before) segments[index - 1] = before
  if (after) segments[index] = after
  return { controls, segments }
}

/**
 * Retire une poignée. Au départ ou à l'arrivée, le tronçon voisin disparaît ; au milieu,
 * ses deux voisines sont reliées par un nouveau tronçon.
 */
export async function removeControl(
  track: EditableTrack,
  index: number,
  route: SegmentRouter,
): Promise<EditableTrack> {
  const last = track.controls.length - 1
  if (last <= 0) return emptyTrack()
  if (index === 0) return { controls: track.controls.slice(1), segments: track.segments.slice(1) }
  if (index === last) {
    return { controls: track.controls.slice(0, -1), segments: track.segments.slice(0, -1) }
  }
  const bridge = await route(track.controls[index - 1]!, track.controls[index + 1]!)
  return {
    controls: track.controls.filter((_, i) => i !== index),
    segments: [...track.segments.slice(0, index - 1), bridge, ...track.segments.slice(index + 1)],
  }
}

const samePoint = (a: LonLat, b: LonLat) => a[0] === b[0] && a[1] === b[1]

/**
 * Nouvelle liste de poignées (réordonnée, boucle…) : un tronçon dont les deux extrémités
 * se suivaient déjà est gardé (retourné si besoin), seuls les autres sont recalculés.
 */
export async function setControls(
  track: EditableTrack,
  controls: LonLat[],
  route: SegmentRouter,
): Promise<EditableTrack> {
  const findExisting = (from: LonLat, to: LonLat): Segment | null => {
    for (const [i, segment] of track.segments.entries()) {
      const start = track.controls[i]!
      const end = track.controls[i + 1]!
      if (samePoint(start, from) && samePoint(end, to)) return segment
      if (samePoint(start, to) && samePoint(end, from)) {
        return { ...segment, points: [...segment.points].reverse() }
      }
    }
    return null
  }
  const segments = await Promise.all(
    controls.slice(1).map((to, i) => findExisting(controls[i]!, to) ?? route(controls[i]!, to)),
  )
  return { controls, segments }
}

/** Déplace une poignée dans la liste (glisser-déposer de la liste des points) */
export function reorderControl(
  track: EditableTrack,
  from: number,
  to: number,
  route: SegmentRouter,
): Promise<EditableTrack> {
  const controls = [...track.controls]
  const [moved] = controls.splice(from, 1)
  controls.splice(to, 0, moved!)
  return setControls(track, controls, route)
}

/** Ajoute le retour au départ, par les sentiers */
export function closeLoop(track: EditableTrack, route: SegmentRouter): Promise<EditableTrack> {
  return addControl(track, track.controls[0]!, route)
}

/** Supprime tout ce qui précède la poignée (elle devient le départ) */
export function cutBefore(track: EditableTrack, index: number): EditableTrack {
  return { controls: track.controls.slice(index), segments: track.segments.slice(index) }
}

/** Supprime tout ce qui suit la poignée (elle devient l'arrivée) */
export function cutAfter(track: EditableTrack, index: number): EditableTrack {
  return { controls: track.controls.slice(0, index + 1), segments: track.segments.slice(0, index) }
}

export function reverseTrack(track: EditableTrack): EditableTrack {
  return {
    controls: [...track.controls].reverse(),
    segments: [...track.segments]
      .reverse()
      .map((segment) => ({ ...segment, points: [...segment.points].reverse() })),
  }
}

function cumulativeKm(points: TrackPoint[]): number[] {
  const cumulative = [0]
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1]! + haversineKm(lonLat(points[i - 1]!), lonLat(points[i]!)))
  }
  return cumulative
}

/**
 * La trace est attrapée au point `vertexIndex` du tronçon `segmentIndex` et lâchée en
 * `point`. Sur une portion enregistrée, deux poignées « ancres » sont posées à
 * ANCHOR_DISTANCE_KM de part et d'autre : seule la portion entre elles est recalculée.
 */
export async function insertControl(
  track: EditableTrack,
  segmentIndex: number,
  vertexIndex: number,
  point: LonLat,
  route: SegmentRouter,
): Promise<EditableTrack> {
  const segment = track.segments[segmentIndex]
  if (!segment) return track
  const start = track.controls[segmentIndex]!
  const end = track.controls[segmentIndex + 1]!

  const keptBefore: Segment[] = []
  const keptAfter: Segment[] = []
  let from = start
  let to = end

  if (segment.kind === 'recorded' && segment.points.length > 2) {
    const cumulative = cumulativeKm(segment.points)
    const grabbedKm = cumulative[Math.min(vertexIndex, cumulative.length - 1)]!
    let anchorBefore = 0
    while (
      anchorBefore + 1 < cumulative.length &&
      cumulative[anchorBefore + 1]! <= grabbedKm - ANCHOR_DISTANCE_KM
    ) {
      anchorBefore++
    }
    let anchorAfter = cumulative.length - 1
    while (anchorAfter - 1 >= 0 && cumulative[anchorAfter - 1]! >= grabbedKm + ANCHOR_DISTANCE_KM) {
      anchorAfter--
    }
    if (anchorBefore > 0) {
      keptBefore.push({ kind: 'recorded', points: segment.points.slice(0, anchorBefore + 1) })
      from = lonLat(segment.points[anchorBefore]!)
    }
    if (anchorAfter < segment.points.length - 1) {
      keptAfter.push({ kind: 'recorded', points: segment.points.slice(anchorAfter) })
      to = lonLat(segment.points[anchorAfter]!)
    }
  }

  const [toPoint, fromPoint] = await Promise.all([route(from, point), route(point, to)])
  const newControls = [
    ...(keptBefore.length ? [from] : []),
    point,
    ...(keptAfter.length ? [to] : []),
  ]
  return {
    controls: [
      ...track.controls.slice(0, segmentIndex + 1),
      ...newControls,
      ...track.controls.slice(segmentIndex + 1),
    ],
    segments: [
      ...track.segments.slice(0, segmentIndex),
      ...keptBefore,
      toPoint,
      fromPoint,
      ...keptAfter,
      ...track.segments.slice(segmentIndex + 1),
    ],
  }
}

/** Tous les points de la trace, tronçons mis bout à bout (jonctions dédoublonnées) */
export function trackPoints(track: EditableTrack): TrackPoint[] {
  const points: TrackPoint[] = []
  for (const segment of track.segments) {
    const previous = points[points.length - 1]
    const first = segment.points[0]
    const skipFirst = previous && first && previous[0] === first[0] && previous[1] === first[1]
    points.push(...(skipFirst ? segment.points.slice(1) : segment.points))
  }
  return points
}

/**
 * Durée de marche estimée (règle DIN 33466, utilisée par les fédérations de randonnée) :
 * 4 km/h à plat, 300 m/h en montée, 500 m/h en descente ; on garde la plus longue des
 * deux composantes, plus la moitié de l'autre.
 */
export function estimateDurationMin(distanceKm: number, gain: number, loss: number): number {
  const horizontal = distanceKm / 4
  const vertical = gain / 300 + loss / 500
  const hours = Math.max(horizontal, vertical) + Math.min(horizontal, vertical) / 2
  return Math.round(hours * 60)
}

export interface TrackStats {
  distanceKm: number
  elevationGain: number
  elevationLoss: number
  durationMin: number
  /** Une partie de la trace n'a pas d'altitude : D+ / D- sous-estimés */
  missingElevation: boolean
}

export function trackStats(points: TrackPoint[]): TrackStats {
  let distanceKm = 0
  for (let i = 1; i < points.length; i++) {
    distanceKm += haversineKm(lonLat(points[i - 1]!), lonLat(points[i]!))
  }
  const elevations = points.flatMap(([, , ele]) => (ele === null ? [] : [ele]))
  const { gain, loss } = computeElevationDelta(elevations)
  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    elevationGain: gain,
    elevationLoss: loss,
    durationMin: estimateDurationMin(distanceKm, gain, loss),
    missingElevation: elevations.length < points.length,
  }
}

// Profil affiché pendant l'édition : quelques centaines de points suffisent
const MAX_PROFILE_POINTS = 800

export function profileFromPoints(points: TrackPoint[]): ElevationPoint[] {
  const profile: ElevationPoint[] = []
  let distanceKm = 0
  points.forEach((point, i) => {
    if (i > 0) distanceKm += haversineKm(lonLat(points[i - 1]!), lonLat(point))
    if (point[2] !== null) {
      profile.push({ distanceKm, elevation: point[2], coordinates: lonLat(point) })
    }
  })
  if (profile.length <= MAX_PROFILE_POINTS) return profile
  const step = (profile.length - 1) / (MAX_PROFILE_POINTS - 1)
  return Array.from({ length: MAX_PROFILE_POINTS }, (_, i) => profile[Math.round(i * step)]!)
}

/** Points du tracé d'un fichier GPX, avec leur altitude */
export function readGpxPoints(xml: string): TrackPoint[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) return []
  const elements = Array.from(doc.getElementsByTagName('trkpt'))
  // Un fichier « itinéraire » (rtept) plutôt que « trace » (trkpt)
  const points = elements.length ? elements : Array.from(doc.getElementsByTagName('rtept'))
  return points.flatMap((el): TrackPoint[] => {
    const lon = Number(el.getAttribute('lon'))
    const lat = Number(el.getAttribute('lat'))
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return []
    const eleText = el.getElementsByTagName('ele')[0]?.textContent
    const ele = eleText ? Number(eleText) : NaN
    return [[lon, lat, Number.isFinite(ele) ? ele : null]]
  })
}

/** Fichier GPX de la trace éditée, avec les points d'intérêt de l'étape en waypoints */
export function buildGpx(name: string, points: TrackPoint[], pois: POI[]): string {
  const waypoints = pois.map((poi) => poiWaypointXml(poi))
  const trackPointsXml = points.map(
    ([lon, lat, ele]) =>
      `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">` +
      (ele === null ? '' : `<ele>${ele.toFixed(1)}</ele>`) +
      '</trkpt>',
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Carnet Trek" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${escapeXml(name)}</name></metadata>`,
    ...waypoints,
    '  <trk>',
    `    <name>${escapeXml(name)}</name>`,
    '    <trkseg>',
    ...trackPointsXml,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
  ].join('\n')
}
