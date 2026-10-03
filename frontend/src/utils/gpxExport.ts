import type { Etape } from '../types/trek'
import { piecePois, type Piece } from './decoupage'
import { haversineKm } from './geo'
import { escapeXml, poiWaypointXml } from './gpxWaypoints'

// GPX d'un trek ou d'une journée : une seule trace continue, morceaux d'étapes mis bout à
// bout (une montre GPS la suit d'un trait). Les fichiers d'origine sont relus pour garder
// altitudes et horaires, et coupés au bon km quand la journée ne prend qu'une partie
// d'une étape ; une étape sans fichier est reconstituée à partir de son tracé (sans
// altitude). Les points d'intérêt sont ceux de l'appli (éventuellement édités), pas ceux
// du fichier d'origine, avec leur type (voir gpxWaypoints.ts).

interface TrackPoint {
  lat: string
  lon: string
  ele?: string
  time?: string
}

function childText(el: Element, tag: string): string | undefined {
  return el.getElementsByTagName(tag)[0]?.textContent?.trim() || undefined
}

function readPoint(el: Element): TrackPoint {
  return {
    lat: el.getAttribute('lat') ?? '',
    lon: el.getAttribute('lon') ?? '',
    ele: childText(el, 'ele'),
    time: childText(el, 'time'),
  }
}

async function readTrackPoints(etape: Etape): Promise<TrackPoint[]> {
  if (etape.gpxFile) {
    try {
      const response = await fetch(etape.gpxFile.url)
      if (response.ok) {
        const doc = new DOMParser().parseFromString(await response.text(), 'application/xml')
        if (!doc.getElementsByTagName('parsererror').length) {
          return Array.from(doc.getElementsByTagName('trkpt')).map(readPoint)
        }
      }
    } catch {
      // Fichier injoignable : on retombe sur le tracé stocké
    }
  }
  // Attention à l'ordre : GeoJSON stocke [lon, lat]
  return (etape.gpxTrack?.coordinates ?? []).map(([lon, lat]) => ({
    lat: String(lat),
    lon: String(lon),
  }))
}

function trackPointXml(point: TrackPoint): string {
  const children = (['ele', 'time'] as const)
    .filter((key) => point[key] !== undefined)
    .map((key) => `<${key}>${escapeXml(point[key]!)}</${key}>`)
    .join('')
  return `      <trkpt lat="${escapeXml(point.lat)}" lon="${escapeXml(point.lon)}">${children}</trkpt>`
}

const lonLat = (point: TrackPoint): [number, number] => [Number(point.lon), Number(point.lat)]

// Garde les points entre deux positions (km mesurés sur la trace, comme pour la coupe)
function sliceBetween(points: TrackPoint[], fromKm: number, toKm: number): TrackPoint[] {
  let km = 0
  return points.filter((point, i) => {
    if (i > 0) km += haversineKm(lonLat(points[i - 1]!), lonLat(point))
    return km >= fromKm && km <= toKm
  })
}

export async function buildMergedGpx(name: string, pieces: Piece[]): Promise<string> {
  const parts = await Promise.all(
    pieces.map(async (piece) => {
      const points = await readTrackPoints(piece.etape)
      return piece.whole ? points : sliceBetween(points, piece.fromKm, piece.toKm)
    }),
  )
  const waypoints = pieces.flatMap(piecePois).map((poi) => poiWaypointXml(poi))

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Carnet Trek" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${escapeXml(name)}</name></metadata>`,
    ...waypoints,
    '  <trk>',
    `    <name>${escapeXml(name)}</name>`,
    '    <trkseg>',
    ...parts.flat().map(trackPointXml),
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
  ].join('\n')
}
