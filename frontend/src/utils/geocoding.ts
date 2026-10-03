import type { LonLat } from './trackEdit'

// Recherche de lieux et noms des points de passage : Photon, le géocodeur de Komoot basé
// sur OpenStreetMap (gratuit, sans clé, en français, appels depuis le navigateur acceptés).

const PHOTON_URL = 'https://photon.komoot.io'

export interface Place {
  id: string
  name: string
  /** « Village · Gard » */
  detail: string
  coordinates: LonLat
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_type?: string
    osm_id?: number
    osm_key?: string
    osm_value?: string
    name?: string
    city?: string
    district?: string
    locality?: string
    county?: string
    state?: string
    country?: string
  }
}

// Genre de lieu affiché sous le nom ; les autres valeurs OSM n'affichent que la région
const KIND_LABELS: Record<string, string> = {
  city: 'Ville',
  town: 'Ville',
  village: 'Village',
  hamlet: 'Hameau',
  locality: 'Lieu-dit',
  isolated_dwelling: 'Lieu-dit',
  peak: 'Sommet',
  saddle: 'Col',
  mountain_pass: 'Col',
  alpine_hut: 'Refuge',
  wilderness_hut: 'Cabane',
  shelter: 'Abri',
  camp_site: 'Camping',
  spring: 'Source',
  lake: 'Lac',
  water: "Plan d'eau",
  viewpoint: 'Point de vue',
  parking: 'Parking',
  station: 'Gare',
}

function toPlace({ geometry, properties: p }: PhotonFeature): Place | null {
  if (!p.name) return null
  const kind = KIND_LABELS[p.osm_value ?? '']
  const region = p.city && p.city !== p.name ? p.city : (p.county ?? p.state)
  return {
    id: `${p.osm_type}${p.osm_id}`,
    name: p.name,
    detail: [kind, region, p.country !== 'France' ? p.country : null].filter(Boolean).join(' · '),
    coordinates: geometry.coordinates,
  }
}

/** Lieux correspondant au texte, les plus proches de `near` d'abord */
export async function searchPlaces(
  query: string,
  near: LonLat | null,
  signal?: AbortSignal,
): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, lang: 'fr', limit: '10' })
  if (near) {
    params.set('lon', near[0].toFixed(4))
    params.set('lat', near[1].toFixed(4))
  }
  const response = await fetch(`${PHOTON_URL}/api/?${params}`, { signal })
  if (!response.ok) throw new Error('Recherche de lieux indisponible')
  const { features } = (await response.json()) as { features: PhotonFeature[] }

  // Une commune revient souvent deux fois (limite administrative + village) : on garde
  // la première de chaque nom + région
  const seen = new Set<string>()
  return features.flatMap((feature) => {
    const place = toPlace(feature)
    if (!place) return []
    const key = `${place.name}|${feature.properties.county ?? ''}`
    if (seen.has(key)) return []
    seen.add(key)
    return [place]
  })
}

const reverseCache = new Map<string, Promise<string | null>>()

/** Nom du lieu le plus proche (lieu-dit, sommet, village…) ; null si rien de parlant */
export function placeName([lon, lat]: LonLat): Promise<string | null> {
  const key = `${lon.toFixed(4)},${lat.toFixed(4)}`
  let cached = reverseCache.get(key)
  if (!cached) {
    const params = new URLSearchParams({
      lon: String(lon),
      lat: String(lat),
      lang: 'fr',
      limit: '1',
    })
    cached = fetch(`${PHOTON_URL}/reverse?${params}`)
      .then((response) => (response.ok ? response.json() : { features: [] }))
      .then(({ features }: { features: PhotonFeature[] }) => {
        const p = features[0]?.properties
        return p?.name ?? p?.locality ?? p?.district ?? p?.city ?? null
      })
      .catch(() => {
        reverseCache.delete(key) // réessayé plus tard
        return null
      })
    reverseCache.set(key, cached)
  }
  return cached
}
