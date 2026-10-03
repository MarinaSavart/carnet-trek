import type { POIType } from '../types/trek'

// Points utiles à la randonnée, lus dans OpenStreetMap via l'API Overpass (gratuite, sans
// clé, usage raisonnable) : on ne charge que la zone affichée, par cases mises en cache.

export interface OsmPoi {
  /** Identifiant OSM, ex. « node/123 » */
  id: string
  type: POIType
  /** Libellé du genre de lieu (« Source », « Cabane »…) */
  kind: string
  name: string
  /** Complément affiché sous le nom (altitude, eau non potable…) */
  notes?: string
  coordinates: [number, number]
}

/** [ouest, sud, est, nord], en degrés */
export type BBox = [number, number, number, number]

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// Taille d'une case de cache (~ 5 km) : une zone n'est demandée qu'une fois par session
const CELL_DEG = 0.05

type Tags = Record<string, string | undefined>

interface Rule {
  type: POIType
  kind: string
  /** Filtre Overpass, sans la zone */
  query: string
  test: (tags: Tags) => boolean
}

// L'ordre compte : la première règle qui correspond l'emporte
const RULES: Rule[] = [
  {
    type: 'point_eau',
    kind: "Point d'eau potable",
    query: 'nwr["amenity"="drinking_water"]',
    test: (t) => t.amenity === 'drinking_water',
  },
  {
    type: 'point_eau',
    kind: "Point d'eau",
    query: 'nwr["amenity"="water_point"]',
    test: (t) => t.amenity === 'water_point',
  },
  {
    type: 'point_eau',
    kind: 'Source',
    query: 'nwr["natural"="spring"]',
    test: (t) => t.natural === 'spring',
  },
  {
    type: 'refuge',
    kind: 'Refuge',
    query: 'nwr["tourism"="alpine_hut"]',
    test: (t) => t.tourism === 'alpine_hut',
  },
  {
    type: 'refuge',
    kind: 'Cabane',
    query: 'nwr["tourism"="wilderness_hut"]',
    test: (t) => t.tourism === 'wilderness_hut',
  },
  {
    type: 'refuge',
    kind: 'Abri',
    query: 'nwr["amenity"="shelter"]',
    test: (t) => t.amenity === 'shelter',
  },
  {
    type: 'camping',
    kind: 'Camping',
    query: 'nwr["tourism"="camp_site"]',
    test: (t) => t.tourism === 'camp_site',
  },
  {
    type: 'sommet',
    kind: 'Sommet',
    query: 'node["natural"="peak"]',
    test: (t) => t.natural === 'peak',
  },
  {
    type: 'ravitaillement',
    kind: 'Supermarché',
    query: 'nwr["shop"="supermarket"]',
    test: (t) => t.shop === 'supermarket',
  },
  {
    type: 'ravitaillement',
    kind: 'Épicerie',
    query: 'nwr["shop"="convenience"]',
    test: (t) => t.shop === 'convenience',
  },
  {
    type: 'ravitaillement',
    kind: 'Boulangerie',
    query: 'nwr["shop"="bakery"]',
    test: (t) => t.shop === 'bakery',
  },
  {
    type: 'autre',
    kind: 'Point de vue',
    query: 'nwr["tourism"="viewpoint"]',
    test: (t) => t.tourism === 'viewpoint',
  },
]

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  /** Centre des chemins et relations (« out center ») */
  center?: { lat: number; lon: number }
  tags?: Tags
}

function toPoi(element: OverpassElement): OsmPoi | null {
  const tags = element.tags ?? {}
  const rule = RULES.find((r) => r.test(tags))
  const lat = element.lat ?? element.center?.lat
  const lon = element.lon ?? element.center?.lon
  if (!rule || lat === undefined || lon === undefined) return null

  const notes = [
    tags.ele && `Altitude ${Math.round(Number(tags.ele))} m`,
    tags.drinking_water === 'no' && 'Eau non potable',
    tags.drinking_water === 'yes' && rule.kind === 'Source' && 'Eau potable',
  ].filter(Boolean)

  return {
    id: `${element.type}/${element.id}`,
    type: rule.type,
    kind: rule.kind,
    name: tags['name:fr'] ?? tags.name ?? rule.kind,
    notes: notes.length ? notes.join(' · ') : undefined,
    coordinates: [lon, lat],
  }
}

function buildQuery([west, south, east, north]: BBox): string {
  // Ordre Overpass : sud, ouest, nord, est
  const area = `(${south},${west},${north},${east})`
  return `[out:json][timeout:25];(${RULES.map((r) => r.query + area + ';').join('')});out center tags;`
}

const poisById = new Map<string, OsmPoi>()
const loadedCells = new Set<string>()

const cellIndex = (deg: number) => Math.floor(deg / CELL_DEG)

/**
 * Points utiles de la zone, depuis le cache ou Overpass. Seules les cases pas encore
 * chargées sont demandées, en une seule requête couvrant leur rectangle.
 */
export async function fetchOsmPois(bbox: BBox, signal?: AbortSignal): Promise<OsmPoi[]> {
  const [west, south, east, north] = bbox
  const missing: [number, number][] = []
  for (let x = cellIndex(west); x <= cellIndex(east); x++) {
    for (let y = cellIndex(south); y <= cellIndex(north); y++) {
      if (!loadedCells.has(`${x}:${y}`)) missing.push([x, y])
    }
  }

  if (missing.length) {
    const xs = missing.map(([x]) => x)
    const ys = missing.map(([, y]) => y)
    const [minX, maxX, minY, maxY] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ]
    const area: BBox = [
      minX * CELL_DEG,
      minY * CELL_DEG,
      (maxX + 1) * CELL_DEG,
      (maxY + 1) * CELL_DEG,
    ]
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: new URLSearchParams({ data: buildQuery(area) }),
      signal,
    })
    if (!response.ok) {
      throw new Error(
        response.status === 429 || response.status === 504
          ? 'Service OpenStreetMap saturé, réessaie dans un instant'
          : `Points utiles indisponibles (erreur ${response.status})`,
      )
    }
    const { elements } = (await response.json()) as { elements: OverpassElement[] }
    for (const element of elements) {
      const poi = toPoi(element)
      if (poi) poisById.set(poi.id, poi)
    }
    // Le rectangle demandé couvre aussi des cases déjà chargées : toutes sont à jour
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) loadedCells.add(`${x}:${y}`)
    }
  }

  return [...poisById.values()].filter(
    ({ coordinates: [lon, lat] }) => lon >= west && lon <= east && lat >= south && lat <= north,
  )
}

/** Point utile déjà chargé le plus proche, à moins de `maxKm` (pour nommer un point de passage) */
export function nearestLoadedOsmPoi([lon, lat]: [number, number], maxKm: number): OsmPoi | null {
  // Distance approchée, suffisante à cette échelle : 1° de latitude ≈ 111 km
  const lonScale = Math.cos((lat * Math.PI) / 180)
  let best: OsmPoi | null = null
  let bestKm = maxKm
  for (const poi of poisById.values()) {
    const [pLon, pLat] = poi.coordinates
    const km = Math.hypot((pLon - lon) * lonScale, pLat - lat) * 111
    if (km <= bestKm) {
      best = poi
      bestKm = km
    }
  }
  return best
}
