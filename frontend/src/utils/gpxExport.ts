import type { Etape } from '../types/trek'

// GPX d'une étape fusionnée : un segment de tracé par étape d'origine. Les fichiers
// d'origine sont relus pour garder altitudes et horaires ; une étape sans fichier
// est reconstituée à partir de son tracé (sans altitude).

interface TrackPoint {
  lat: string
  lon: string
  ele?: string
  time?: string
}

interface Waypoint extends TrackPoint {
  name?: string
  desc?: string
  sym?: string
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`)
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

async function readEtape(etape: Etape): Promise<{ points: TrackPoint[]; waypoints: Waypoint[] }> {
  if (etape.gpxFile) {
    try {
      const response = await fetch(etape.gpxFile.url)
      if (response.ok) {
        const doc = new DOMParser().parseFromString(await response.text(), 'application/xml')
        if (!doc.getElementsByTagName('parsererror').length) {
          return {
            points: Array.from(doc.getElementsByTagName('trkpt')).map(readPoint),
            waypoints: Array.from(doc.getElementsByTagName('wpt')).map((wpt) => ({
              ...readPoint(wpt),
              name: childText(wpt, 'name'),
              desc: childText(wpt, 'desc'),
              sym: childText(wpt, 'sym'),
            })),
          }
        }
      }
    } catch {
      // Fichier injoignable : on retombe sur le tracé stocké
    }
  }
  // Attention à l'ordre : GeoJSON stocke [lon, lat]
  return {
    points: (etape.gpxTrack?.coordinates ?? []).map(([lon, lat]) => ({
      lat: String(lat),
      lon: String(lon),
    })),
    waypoints: etape.pois.map((poi) => ({
      lat: String(poi.location.coordinates[1]),
      lon: String(poi.location.coordinates[0]),
      name: poi.name,
      desc: poi.notes,
    })),
  }
}

function pointXml(tag: string, point: Waypoint, indent: string): string {
  const children = (['ele', 'time', 'name', 'desc', 'sym'] as const)
    .filter((key) => point[key] !== undefined)
    .map((key) => `<${key}>${escapeXml(point[key]!)}</${key}>`)
    .join('')
  return `${indent}<${tag} lat="${escapeXml(point.lat)}" lon="${escapeXml(point.lon)}">${children}</${tag}>`
}

export async function buildMergedGpx(name: string, etapes: Etape[]): Promise<string> {
  const parts = await Promise.all(etapes.map(readEtape))
  const waypoints = parts.flatMap((p) => p.waypoints).map((w) => pointXml('wpt', w, '  '))
  const segments = parts.map(
    (p) =>
      `    <trkseg>\n${p.points.map((pt) => pointXml('trkpt', pt, '      ')).join('\n')}\n    </trkseg>`,
  )

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Carnet Trek" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${escapeXml(name)}</name></metadata>`,
    ...waypoints,
    `  <trk>`,
    `    <name>${escapeXml(name)}</name>`,
    ...segments,
    '  </trk>',
    '</gpx>',
  ].join('\n')
}
