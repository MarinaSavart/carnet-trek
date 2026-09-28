import type { Etape, Photo, Trek } from '../types/trek'
import { parseGpx, type ParsedGpx } from '../utils/gpx'

// En attendant le formulaire d'upload (et le stockage côté backend), les fichiers sont
// déposés dans le projet, rangés par trek puis par étape :
//
//   src/assets/treks/<id-trek>/<id-etape>/<n'importe quel nom>.gpx   (un seul par étape)
//   src/assets/treks/<id-trek>/<id-etape>/photos/<n'importe quel nom>.jpg
const gpxFiles = import.meta.glob<string>('../assets/treks/*/*/*.gpx', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const photoFiles = import.meta.glob<string>(
  '../assets/treks/*/*/photos/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}',
  { import: 'default', eager: true },
)

// '../assets/treks/<trek>/<etape>/…' → '<trek>/<etape>'
function etapeKey(path: string): string {
  const [trekId, etapeId] = path.replace('../assets/treks/', '').split('/')
  return `${trekId}/${etapeId}`
}

const gpxByEtape = new Map<string, ParsedGpx>()
for (const [path, xml] of Object.entries(gpxFiles)) {
  const key = etapeKey(path)
  if (gpxByEtape.has(key)) {
    console.warn(`Plusieurs fichiers GPX pour l'étape ${key}, seul le premier est utilisé`)
    continue
  }
  gpxByEtape.set(key, parseGpx(xml, key))
}

// Triées par nom de fichier : les noms d'appareil photo (IMG_0001…) suivent l'ordre de prise de vue
const photosByEtape = new Map<string, Photo[]>()
for (const [path, url] of Object.entries(photoFiles).sort(([a], [b]) => a.localeCompare(b))) {
  const key = etapeKey(path)
  const photos = photosByEtape.get(key) ?? []
  photos.push({ _id: path, url })
  photosByEtape.set(key, photos)
}

// Le GPX fait foi quand il existe : tracé réel, stats calculées et waypoints comme POI
function withAssets(trekId: string, etape: Etape): Etape {
  const key = `${trekId}/${etape._id}`
  const gpx = gpxByEtape.get(key)
  const photos = photosByEtape.get(key) ?? etape.photos ?? []
  if (!gpx) return { ...etape, photos }

  return {
    ...etape,
    gpxTrack: gpx.track,
    elevationProfile: gpx.elevationProfile,
    distanceKm: gpx.distanceKm,
    elevationGain: gpx.elevationGain,
    elevationLoss: gpx.elevationLoss,
    durationMin: gpx.durationMin ?? etape.durationMin,
    pois: gpx.waypoints.length ? gpx.waypoints : etape.pois,
    photos,
  }
}

export function withEtapeAssets(treks: Trek[]): Trek[] {
  return treks.map((trek) => ({
    ...trek,
    etapes: trek.etapes.map((etape) => withAssets(trek._id, etape)),
  }))
}
