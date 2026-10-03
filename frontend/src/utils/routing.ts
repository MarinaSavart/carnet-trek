import type { LonLat, Segment } from './trackEdit'

// Calcul des tronçons de l'éditeur de trace, toujours en suivant les sentiers : BRouter
// (gratuit, sans clé, profil randonnée montagne, altitudes incluses, appels directs
// depuis le navigateur acceptés).

const BROUTER_URL = 'https://brouter.de/brouter'
const BROUTER_PROFILE = 'hiking-mountain'

export class RoutingError extends Error {}

const NO_TRAIL = "Aucun sentier trouvé jusqu'ici : place le point plus près d'un chemin."

export async function routeOnTrails(from: LonLat, to: LonLat): Promise<Segment> {
  const lonlats = [from, to].map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join('|')
  const url = `${BROUTER_URL}?lonlats=${lonlats}&profile=${BROUTER_PROFILE}&alternativeidx=0&format=geojson`
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new RoutingError("Calcul d'itinéraire injoignable")
  }
  if (!response.ok) {
    // BRouter répond en texte brut (ex. « no track found… », point loin de tout chemin)
    throw new RoutingError(NO_TRAIL)
  }
  const data = (await response.json()) as {
    features?: { geometry?: { coordinates?: number[][] } }[]
  }
  const coordinates = data.features?.[0]?.geometry?.coordinates ?? []
  if (coordinates.length < 2) throw new RoutingError(NO_TRAIL)
  return {
    kind: 'routed',
    points: coordinates.map(([lon, lat, ele]) => [lon!, lat!, ele ?? null]),
  }
}
