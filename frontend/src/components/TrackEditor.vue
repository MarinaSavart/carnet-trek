<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { FeatureCollection, LineString } from 'geojson'
import maplibregl, { MAP_STYLE_URL } from '../lib/maplibre'
import { setupOutdoorMap } from '../lib/outdoorMap'
import { OsmPoiLayer, osmPoiStatusLabel, type OsmPoiStatus } from '../lib/osmPoiLayer'
import ElevationProfile, { type ProfileHover } from './ElevationProfile.vue'
import MapLayout from './MapLayout.vue'
import PlaceSearch from './PlaceSearch.vue'
import WaypointList from './WaypointList.vue'
import type { GeoJSONLineString, POI } from '../types/trek'
import { formatDuration } from '../utils/format'
import { haversineKm } from '../utils/geo'
import { POI_ICONS } from '../utils/poi'
import { routeOnTrails } from '../utils/routing'
import { placeName, type Place } from '../utils/geocoding'
import { nearestLoadedOsmPoi, type OsmPoi } from '../utils/overpass'
import {
  addControl,
  buildGpx,
  closeLoop,
  cutAfter,
  cutBefore,
  passThrough,
  emptyTrack,
  insertControl,
  moveControl,
  profileFromPoints,
  readGpxPoints,
  removeControl,
  reorderControl,
  reverseTrack,
  trackFromPoints,
  trackPoints,
  trackStats,
  type EditableTrack,
  type LonLat,
} from '../utils/trackEdit'

// Éditeur de trace plein écran, toujours en suivant les sentiers : créer, prolonger,
// modifier une portion (attraper la trace), déplacer / supprimer / réordonner les points
// de passage, couper, inverser, boucler, chercher un lieu. « Terminer » renvoie un
// nouveau fichier GPX au formulaire, comme si on venait d'en importer un.

const props = defineProps<{
  title: string
  /** Trace actuelle : fichier pas encore envoyé, ou URL du GPX enregistré */
  gpxFile: File | null
  gpxUrl: string | null
  /** À défaut de fichier lisible : tracé sans altitudes */
  fallbackTrack: GeoJSONLineString | null
  pois: POI[]
  previousTrack: GeoJSONLineString | null
  nextTrack: GeoJSONLineString | null
}>()

const emit = defineEmits<{
  save: [value: { file: File; durationMin: number }]
  close: []
}>()

// Au-delà, le départ / l'arrivée ne colle plus à l'étape voisine
const NEIGHBOUR_GAP_KM = 0.2
const MAX_HISTORY = 100

// --- Historique : chaque modification ajoute une version (annuler / rétablir) ---

// Une version = la trace, et les points d'intérêt ajoutés pendant l'édition (points utiles
// OSM par lesquels on fait passer la trace) : annuler retire aussi ces points
interface Version {
  track: EditableTrack
  addedPois: POI[]
}

// shallowRef : les traces comptent des milliers de points, inutile de les rendre réactifs
const history = shallowRef<Version[]>([{ track: emptyTrack(), addedPois: [] }])
const position = ref(0)
const track = computed(() => history.value[position.value]!.track)
const addedPois = computed(() => history.value[position.value]!.addedPois)
/** POI de l'étape + ceux ajoutés ici : affichés, nomment les points, exportés dans le GPX */
const allPois = computed(() => [...props.pois, ...addedPois.value])
const hasChanges = computed(() => position.value !== 0)

function commit(next: EditableTrack, newPoi?: POI) {
  const kept = history.value.slice(0, position.value + 1)
  const pois = newPoi ? [...addedPois.value, newPoi] : addedPois.value
  history.value = [...kept, { track: next, addedPois: pois }].slice(-MAX_HISTORY)
  position.value = history.value.length - 1
}

const undo = () => position.value > 0 && position.value--
const redo = () => position.value < history.value.length - 1 && position.value++

// --- Calcul des tronçons (sentiers uniquement : un point sans sentier est refusé) ---

const router = routeOnTrails
const extendFromStart = ref(false)
const isBusy = ref(false)
const isLoading = ref(true)
const notice = ref<string | null>(null)

/** Lance une modification ; une seule à la fois (les calculs d'itinéraire sont asynchrones) */
async function run(
  operation: (current: EditableTrack) => EditableTrack | Promise<EditableTrack>,
  /** Point d'intérêt ajouté en même temps (annulé avec la modification) */
  newPoi?: POI,
) {
  if (isBusy.value || isLoading.value) {
    renderControls()
    return
  }
  isBusy.value = true
  notice.value = null
  closeMenu()
  placePopup?.remove()
  osmPopup?.remove()
  try {
    commit(await operation(track.value), newPoi)
  } catch (e) {
    notice.value = e instanceof Error ? e.message : 'Modification impossible'
    renderControls()
  } finally {
    isBusy.value = false
  }
}

// --- Stats, profil, étapes voisines ---

const points = computed(() => trackPoints(track.value))
const stats = computed(() => trackStats(points.value))
const profileSegments = computed(() => {
  const profile = profileFromPoints(points.value)
  return profile.length ? [{ id: 'trace', label: 'Trace', color: '#d95926', points: profile }] : []
})

const startPoint = computed(() => track.value.controls[0] ?? null)
const endPoint = computed(() => track.value.controls[track.value.controls.length - 1] ?? null)
const previousEnd = computed(
  () =>
    (props.previousTrack?.coordinates[props.previousTrack.coordinates.length - 1] as LonLat) ??
    null,
)
const nextStart = computed(() => (props.nextTrack?.coordinates[0] as LonLat) ?? null)

const warnings = computed(() => {
  const list: string[] = []
  if (track.value.controls.length < 2) return list
  if (previousEnd.value && startPoint.value) {
    const gap = haversineKm(previousEnd.value, startPoint.value)
    if (gap > NEIGHBOUR_GAP_KM) {
      list.push(`Le départ est à ${gap.toFixed(1)} km de l'arrivée de l'étape précédente.`)
    }
  }
  if (nextStart.value && endPoint.value) {
    const gap = haversineKm(endPoint.value, nextStart.value)
    if (gap > NEIGHBOUR_GAP_KM) {
      list.push(`L'arrivée est à ${gap.toFixed(1)} km du départ de l'étape suivante.`)
    }
  }
  if (stats.value.missingElevation) {
    list.push("Une partie de la trace n'a pas d'altitude : le dénivelé est sous-estimé.")
  }
  return list
})

// --- Points de passage : noms et liste ---

const highlightedIndex = ref<number | null>(null)
const geocodedNames = ref(new Map<string, string | null>())
const nameKey = ([lon, lat]: LonLat) => `${lon.toFixed(5)},${lat.toFixed(5)}`

// Nom d'un point : POI de l'étape ou point utile OSM tout proche, sinon lieu le plus proche
const NAME_RADIUS_KM = 0.1
const waypointNames = computed(() => {
  void osmStatus.value // recalcul quand de nouveaux points utiles sont chargés
  const last = track.value.controls.length - 1
  return track.value.controls.map((point, index) => {
    const poi = allPois.value.find(
      (p) => haversineKm(p.location.coordinates, point) <= NAME_RADIUS_KM,
    )
    const osm = nearestLoadedOsmPoi(point, NAME_RADIUS_KM)
    const named = poi?.name ?? (osm && osm.name !== osm.kind ? osm.name : null)
    return (
      named ??
      geocodedNames.value.get(nameKey(point)) ??
      (index === 0 ? 'Départ' : index === last ? 'Arrivée' : `Point de passage ${index}`)
    )
  })
})

watch(
  () => track.value.controls,
  (controls) => {
    for (const point of controls) {
      const key = nameKey(point)
      if (geocodedNames.value.has(key)) continue
      geocodedNames.value.set(key, null)
      placeName(point).then((name) => {
        geocodedNames.value = new Map(geocodedNames.value).set(key, name)
      })
    }
  },
)

function focusWaypoint(index: number) {
  const point = track.value.controls[index]
  if (!map || !point) return
  map.easeTo({ center: point, zoom: Math.max(map.getZoom(), 14) })
  highlightedIndex.value = index
}

// --- Recherche de lieux ---

const placeSearch = ref<InstanceType<typeof PlaceSearch> | null>(null)
const searchBias = ref<LonLat | null>(null)
let placePopup: maplibregl.Popup | null = null

function onPlaceSelect(place: Place) {
  if (!map) return
  closeMenu()
  placePopup?.remove()
  map.flyTo({ center: place.coordinates, zoom: Math.max(map.getZoom(), 13) })

  const content = document.createElement('div')
  content.className = 'control-menu'
  const title = document.createElement('strong')
  title.textContent = place.name
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = track.value.controls.length ? 'Ajouter à la trace' : "Partir d'ici"
  button.addEventListener('click', () => {
    placePopup?.remove()
    run((current) => addControl(current, place.coordinates, router, extendFromStart.value))
  })
  content.append(title, button)
  placePopup = new maplibregl.Popup({ offset: 10, closeOnClick: false })
    .setLngLat(place.coordinates)
    .setDOMContent(content)
    .addTo(map)
  button.focus()
}

// --- Point utile OpenStreetMap → itinéraire ---

let osmPopup: maplibregl.Popup | null = null

// Un point utile déjà ajouté à l'étape (à ~15 m près) n'est plus proposé
function isAlreadyAdded(osm: OsmPoi): boolean {
  return allPois.value.some(
    ({ location: { coordinates } }) => haversineKm(coordinates, osm.coordinates) < 0.015,
  )
}

function showOsmPopup(osm: OsmPoi) {
  if (!map) return
  closeMenu()
  placePopup?.remove()
  osmPopup?.remove()

  const content = document.createElement('div')
  content.className = 'control-menu osm-add'
  const title = document.createElement('strong')
  title.textContent = `${POI_ICONS[osm.type]} ${osm.name}`
  content.append(title)
  const details = [osm.name === osm.kind ? '' : osm.kind, osm.notes ?? ''].filter(Boolean)
  if (details.length) {
    const p = document.createElement('p')
    p.textContent = details.join(' · ')
    content.append(p)
  }
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'osm-add-button'
  button.textContent = track.value.controls.length ? "Ajouter à l'itinéraire" : "Partir d'ici"
  const label = document.createElement('label')
  label.className = 'osm-add-check'
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = true
  label.append(checkbox, " Ajouter aussi aux points d'intérêt de l'étape")
  button.addEventListener('click', () => {
    osmPopup?.remove()
    const poi: POI | undefined = checkbox.checked
      ? {
          _id: `osm-${osm.id}`,
          type: osm.type,
          name: osm.name,
          notes: osm.notes,
          location: { type: 'Point', coordinates: osm.coordinates },
        }
      : undefined
    run((current) => passThrough(current, osm.coordinates, router), poi)
  })
  content.append(button, label)

  osmPopup = new maplibregl.Popup({ offset: 14, maxWidth: '280px', closeOnClick: false })
    .setLngLat(osm.coordinates)
    .setDOMContent(content)
    .addTo(map)
  button.focus()
}

function startFromPrevious() {
  const point = previousEnd.value
  if (point) run((current) => addControl(current, point, router))
}

// --- Enregistrement ---

const saveError = ref<string | null>(null)

function finish() {
  if (!hasChanges.value) {
    emit('close')
    return
  }
  if (points.value.length < 2) {
    saveError.value = 'La trace doit relier au moins deux points.'
    return
  }
  const xml = buildGpx(props.title, points.value, allPois.value)
  const slug = props.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'trace'
  const file = new File([xml], `${slug}.gpx`, { type: 'application/gpx+xml' })
  emit('save', { file, durationMin: stats.value.durationMin })
}

function cancel() {
  if (hasChanges.value && !window.confirm('Abandonner les modifications de la trace ?')) return
  emit('close')
}

// --- Chargement de la trace actuelle (avec ses altitudes si possible) ---

async function loadInitialPoints() {
  let xml: string | null = null
  try {
    if (props.gpxFile) xml = await props.gpxFile.text()
    else if (props.gpxUrl) {
      const response = await fetch(props.gpxUrl)
      if (response.ok) xml = await response.text()
    }
  } catch {
    // Fichier illisible : on retombe sur le tracé sans altitudes
  }
  let initial = xml ? readGpxPoints(xml) : []
  if (initial.length < 2 && props.fallbackTrack) {
    initial = props.fallbackTrack.coordinates.map(([lon, lat]) => [lon, lat, null])
  }
  history.value = [{ track: trackFromPoints(initial), addedPois: [] }]
  position.value = 0
  isLoading.value = false
}

// --- Carte ---

const TRACK_SOURCE = 'edit-track'
const NEIGHBOURS_SOURCE = 'neighbours'
const HIT_LAYER = 'edit-track-hit'

const mapContainer = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null
let osmLayer: OsmPoiLayer | null = null
let controlMarkers: maplibregl.Marker[] = []
let poiMarkers: maplibregl.Marker[] = []
let ghostMarker: maplibregl.Marker | null = null
let cursorMarker: maplibregl.Marker | null = null
let menu: maplibregl.Popup | null = null

const showOsm = ref(false)
const osmStatus = ref<OsmPoiStatus>({ state: 'off' })

function trackFeatures(): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: track.value.segments.map((segment, index) => ({
      type: 'Feature',
      properties: { index, kind: segment.kind },
      geometry: {
        type: 'LineString',
        coordinates: segment.points.map(([lon, lat]) => [lon, lat]),
      },
    })),
  }
}

function neighbourFeatures(): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: [props.previousTrack, props.nextTrack].flatMap((line) =>
      line ? [{ type: 'Feature' as const, properties: {}, geometry: line }] : [],
    ),
  }
}

function setupLayers() {
  if (!map) return
  map.addSource(NEIGHBOURS_SOURCE, { type: 'geojson', data: neighbourFeatures() })
  map.addLayer({
    id: 'neighbours-line',
    type: 'line',
    source: NEIGHBOURS_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#5b6b63', 'line-width': 3, 'line-opacity': 0.7 },
  })

  map.addSource(TRACK_SOURCE, { type: 'geojson', data: trackFeatures() })
  map.addLayer({
    id: 'edit-track-casing',
    type: 'line',
    source: TRACK_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#fff', 'line-width': 8 },
  })
  map.addLayer({
    id: 'edit-track-line',
    type: 'line',
    source: TRACK_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#d95926', 'line-width': 4.5 },
  })
  // Zone large et invisible : attraper la trace sans viser au pixel près
  map.addLayer({
    id: HIT_LAYER,
    type: 'line',
    source: TRACK_SOURCE,
    paint: { 'line-color': '#000', 'line-width': 20, 'line-opacity': 0 },
  })
}

function renderTrack() {
  const source = map?.getSource(TRACK_SOURCE) as maplibregl.GeoJSONSource | undefined
  source?.setData(trackFeatures())
  renderControls()
}

// Évite qu'un glisser de poignée soit aussi compris comme un clic (menu)
let justDragged = false

function renderControls() {
  if (!map) return
  controlMarkers.forEach((m) => m.remove())
  const last = track.value.controls.length - 1
  controlMarkers = track.value.controls.map((point, index) => {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'control-marker'
    el.classList.toggle('is-highlighted', highlightedIndex.value === index)
    if (index === 0) el.classList.add('is-start')
    if (index === last && last > 0) el.classList.add('is-end')
    el.setAttribute(
      'aria-label',
      index === 0 ? 'Départ' : index === last ? 'Arrivée' : `Point de passage ${index}`,
    )

    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat(point)
      .addTo(map!)
    marker.on('dragstart', () => (justDragged = true))
    marker.on('dragend', () => {
      setTimeout(() => (justDragged = false), 0)
      const { lng, lat } = marker.getLngLat()
      run((current) => moveControl(current, index, [lng, lat], router))
    })
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      if (!justDragged) openMenu(index)
    })
    el.addEventListener('mouseenter', () => (highlightedIndex.value = index))
    el.addEventListener('mouseleave', () => (highlightedIndex.value = null))
    return marker
  })
}

function renderPois() {
  poiMarkers.forEach((m) => m.remove())
  poiMarkers = allPois.value.map((poi) => {
    const el = document.createElement('div')
    el.className = 'track-editor-poi'
    el.textContent = POI_ICONS[poi.type]
    el.title = poi.name
    return new maplibregl.Marker({ element: el }).setLngLat(poi.location.coordinates).addTo(map!)
  })
}

function closeMenu() {
  menu?.remove()
  menu = null
}

// Menu d'une poignée : supprimer, couper avant / après
function openMenu(index: number) {
  if (!map || isBusy.value) return
  closeMenu()
  const last = track.value.controls.length - 1
  const content = document.createElement('div')
  content.className = 'control-menu'
  const actions: [string, () => void][] = [
    ['Supprimer ce point', () => run((current) => removeControl(current, index, router))],
  ]
  if (index > 0 && index < last) {
    actions.push([
      'Couper avant (nouveau départ)',
      () => run((current) => cutBefore(current, index)),
    ])
    actions.push([
      'Couper après (nouvelle arrivée)',
      () => run((current) => cutAfter(current, index)),
    ])
  }
  for (const [label, action] of actions) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.addEventListener('click', action)
    content.append(button)
  }
  menu = new maplibregl.Popup({ offset: 14, closeOnClick: false })
    .setLngLat(track.value.controls[index]!)
    .setDOMContent(content)
    .addTo(map)
  content.querySelector('button')?.focus()
}

function fitToContent() {
  if (!map) return
  const coordinates: LonLat[] = [
    ...points.value.map(([lon, lat]): LonLat => [lon, lat]),
    ...(previousEnd.value ? [previousEnd.value] : []),
    ...(nextStart.value ? [nextStart.value] : []),
    ...allPois.value.map((p) => p.location.coordinates),
  ]
  const [first] = coordinates
  if (!first) return
  const bounds = coordinates.reduce(
    (b, coord) => b.extend(coord),
    new maplibregl.LngLatBounds(first, first),
  )
  map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 })
}

// Point de la trace le plus proche (longitudes ramenées à l'échelle des latitudes)
function nearestVertex(segmentIndex: number, { lng, lat }: maplibregl.LngLat): number {
  const segmentPoints = track.value.segments[segmentIndex]?.points ?? []
  const lonScale = Math.cos((lat * Math.PI) / 180)
  let best = 0
  let bestDistance = Infinity
  segmentPoints.forEach(([lon, pLat], i) => {
    const distance = ((lon - lng) * lonScale) ** 2 + (pLat - lat) ** 2
    if (distance < bestDistance) {
      best = i
      bestDistance = distance
    }
  })
  return best
}

function ghost(): maplibregl.Marker {
  if (!ghostMarker) {
    const el = document.createElement('div')
    el.className = 'control-marker is-ghost'
    ghostMarker = new maplibregl.Marker({ element: el })
  }
  return ghostMarker
}

// MapLibre place marqueurs et bulles dans le conteneur de la carte : un clic dessus
// remonte aussi comme un clic sur la carte, à ignorer
function isOnOverlay(event: Event): boolean {
  return (
    event.target instanceof Element &&
    !!event.target.closest('.maplibregl-marker, .maplibregl-popup')
  )
}

// Attraper la trace : maintenir le clic, déplacer, relâcher → nouvelle poignée
function onTrackMouseDown(e: maplibregl.MapLayerMouseEvent) {
  if (!map || isBusy.value || isLoading.value || isOnOverlay(e.originalEvent)) return
  const index = e.features?.[0]?.properties?.index
  if (typeof index !== 'number') return
  e.preventDefault() // pas de déplacement de la carte pendant ce glisser
  const vertex = nearestVertex(index, e.lngLat)
  const startPixel = e.point
  map.getCanvas().style.cursor = 'grabbing'

  const onMove = (move: maplibregl.MapMouseEvent) => ghost().setLngLat(move.lngLat).addTo(map!)
  map.on('mousemove', onMove)
  map.once('mouseup', (up) => {
    map!.off('mousemove', onMove)
    map!.getCanvas().style.cursor = ''
    ghostMarker?.remove()
    // Simple clic sur la trace (sans glisser) : rien à faire
    if (Math.hypot(up.point.x - startPixel.x, up.point.y - startPixel.y) < 6) return
    const point: LonLat = [up.lngLat.lng, up.lngLat.lat]
    run((current) => insertControl(current, index, vertex, point, router))
  })
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeydown)
  document.getElementById('track-editor-title')?.focus()
  const loading = loadInitialPoints()

  if (!mapContainer.value) return
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: MAP_STYLE_URL,
    center: [2.5, 46.5],
    zoom: 5,
    attributionControl: { compact: true },
  })
  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  // Sentiers visibles, itinéraires balisés et choix du fond Plan / Topo
  setupOutdoorMap(map)
  map.addControl(new maplibregl.ScaleControl(), 'bottom-left')

  map.on('load', async () => {
    setupLayers()
    renderPois()
    await loading
    renderTrack()
    fitToContent()
    osmLayer = new OsmPoiLayer(map!, {
      onSelect: showOsmPopup,
      onStatus: (status) => (osmStatus.value = status),
      isHidden: isAlreadyAdded,
    })
    osmLayer.setEnabled(showOsm.value)
  })

  map.on('moveend', () => {
    const { lng, lat } = map!.getCenter()
    searchBias.value = [lng, lat]
  })
  map.on('mousedown', HIT_LAYER, onTrackMouseDown)
  map.on('mouseenter', HIT_LAYER, () => {
    if (!isBusy.value) map!.getCanvas().style.cursor = 'grab'
  })
  map.on('mouseleave', HIT_LAYER, () => (map!.getCanvas().style.cursor = ''))

  // Clic sur la carte : prolonge la trace (ou pose le départ)
  map.on('click', (e) => {
    if (isOnOverlay(e.originalEvent)) return
    if (menu || placePopup?.isOpen() || osmPopup?.isOpen()) {
      closeMenu()
      placePopup?.remove()
      osmPopup?.remove()
      return
    }
    if (map!.queryRenderedFeatures(e.point, { layers: [HIT_LAYER] }).length) return
    const point: LonLat = [e.lngLat.lng, e.lngLat.lat]
    run((current) => addControl(current, point, router, extendFromStart.value))
  })
})

watch(track, renderTrack)
// POI ajoutés (ou retirés en annulant) : marqueurs et calque OSM à jour
watch(addedPois, () => {
  renderPois()
  osmLayer?.refresh()
})
watch(highlightedIndex, (index) => {
  controlMarkers.forEach((marker, i) =>
    marker.getElement().classList.toggle('is-highlighted', i === index),
  )
})
watch(showOsm, (enabled) => osmLayer?.setEnabled(enabled))

function onProfileHover(value: ProfileHover | null) {
  if (!map) return
  if (!value) {
    cursorMarker?.remove()
    return
  }
  if (!cursorMarker) {
    const el = document.createElement('div')
    el.className = 'track-editor-cursor'
    cursorMarker = new maplibregl.Marker({ element: el })
  }
  cursorMarker.setLngLat(value.coordinates).addTo(map)
}

function onKeydown(e: KeyboardEvent) {
  const isField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
  if ((e.ctrlKey || e.metaKey) && !isField) {
    const key = e.key.toLowerCase()
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (!isBusy.value) undo()
    } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
      e.preventDefault()
      if (!isBusy.value) redo()
    }
  } else if (e.key === 'Escape') {
    if (menu) closeMenu()
    else if (placePopup?.isOpen()) placePopup.remove()
    else if (osmPopup?.isOpen()) osmPopup.remove()
    else cancel()
  }
}

onUnmounted(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKeydown)
  osmLayer?.destroy()
  map?.remove()
})
</script>

<template>
  <Teleport to="body">
    <div class="editor" role="dialog" aria-modal="true" aria-labelledby="track-editor-title">
      <MapLayout panel-label="Trace de l'étape" fullscreen flush>
        <template #panel>
          <div class="panel-inner">
            <header class="panel-header">
              <p class="eyebrow">Trace de l'étape</p>
              <h2 id="track-editor-title" tabindex="-1">{{ title }}</h2>
              <p class="hint">
                <template v-if="track.controls.length">
                  Clique sur la carte pour prolonger. Attrape la trace pour la déplacer, glisse un
                  point pour le bouger, clique dessus pour le supprimer ou couper.
                </template>
                <template v-else>Clique sur la carte pour poser le départ.</template>
              </p>
            </header>

            <div class="section">
              <label v-if="track.controls.length" class="check">
                <input v-model="extendFromStart" type="checkbox" />
                Prolonger depuis le départ (au lieu de l'arrivée)
              </label>
              <button
                v-if="!track.controls.length && previousEnd"
                type="button"
                class="btn"
                :disabled="isBusy || isLoading"
                @click="startFromPrevious"
              >
                Partir de l'arrivée de l'étape précédente
              </button>

              <div class="toolbar">
                <button
                  type="button"
                  class="btn btn-icon"
                  title="Annuler (Ctrl+Z)"
                  aria-label="Annuler"
                  :disabled="isBusy || position === 0"
                  @click="undo"
                >
                  ↶
                </button>
                <button
                  type="button"
                  class="btn btn-icon"
                  title="Rétablir (Ctrl+Y)"
                  aria-label="Rétablir"
                  :disabled="isBusy || position === history.length - 1"
                  @click="redo"
                >
                  ↷
                </button>
                <button
                  type="button"
                  class="btn"
                  :disabled="isBusy || track.controls.length < 2"
                  @click="run(reverseTrack)"
                >
                  ⇄ Inverser
                </button>
                <button
                  type="button"
                  class="btn"
                  :disabled="isBusy || track.controls.length < 2"
                  @click="run((current) => closeLoop(current, router))"
                >
                  ⟲ Boucler
                </button>
                <button
                  type="button"
                  class="btn"
                  :disabled="isBusy || !track.controls.length"
                  @click="run(emptyTrack)"
                >
                  Tout effacer
                </button>
              </div>
              <p class="status" aria-live="polite">
                <template v-if="isLoading">Chargement de la trace…</template>
                <template v-else-if="isBusy">Calcul de l'itinéraire…</template>
                <template v-else-if="notice">{{ notice }}</template>
              </p>
            </div>

            <div v-if="track.controls.length" class="section">
              <WaypointList
                class="waypoint-list"
                :names="waypointNames"
                :highlighted-index="highlightedIndex"
                :disabled="isBusy || isLoading"
                @reorder="(from, to) => run((current) => reorderControl(current, from, to, router))"
                @remove="(index) => run((current) => removeControl(current, index, router))"
                @focus="focusWaypoint"
                @hover="highlightedIndex = $event"
                @add="placeSearch?.focus()"
              />
            </div>

            <ul v-if="warnings.length" class="warnings">
              <li v-for="warning in warnings" :key="warning">⚠ {{ warning }}</li>
            </ul>

            <div class="section">
              <label class="check">
                <input v-model="showOsm" type="checkbox" />
                Points utiles OpenStreetMap
              </label>
              <p v-if="showOsm && osmStatus.state !== 'off'" class="status">
                {{ osmPoiStatusLabel(osmStatus) }}
              </p>
            </div>

            <footer class="panel-footer">
              <p v-if="saveError" class="field-error" role="alert">{{ saveError }}</p>
              <button type="button" class="btn" @click="cancel">Annuler</button>
              <button type="button" class="btn btn-primary" :disabled="isBusy" @click="finish">
                Terminer
              </button>
            </footer>
          </div>
        </template>

        <template #map>
          <div class="map-wrap">
            <div ref="mapContainer" class="map" />
            <PlaceSearch
              ref="placeSearch"
              class="map-search"
              :near="searchBias"
              @select="onPlaceSelect"
            />
          </div>
        </template>

        <!-- Comme sur les pages trek et étape : chiffres clés et profil sous la carte -->
        <template #dock>
          <dl class="stats">
            <div>
              <dt>Distance</dt>
              <dd>{{ stats.distanceKm.toFixed(1) }} km</dd>
            </div>
            <div>
              <dt>D+</dt>
              <dd>{{ stats.elevationGain }} m</dd>
            </div>
            <div>
              <dt>D−</dt>
              <dd>{{ stats.elevationLoss }} m</dd>
            </div>
            <div>
              <dt>Durée estimée</dt>
              <dd>{{ formatDuration(stats.durationMin) }}</dd>
            </div>
          </dl>

          <ElevationProfile
            v-if="profileSegments.length"
            :segments="profileSegments"
            @hover="onProfileHover"
          />
          <p v-else class="status">Le profil d'altitude s'affichera avec la trace.</p>
        </template>
      </MapLayout>
    </div>
  </Teleport>
</template>

<style scoped>
.editor {
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow-y: auto; /* mobile : la mise en page s'empile et défile */
  background: var(--color-bg);
}
/* Pied (Annuler / Terminer) toujours en bas du panneau, même si son contenu est court */
.panel-inner {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
.panel-header,
.section {
  padding: var(--space-sm) var(--space-md);
}
.panel-header {
  padding-top: var(--space-md);
}
.panel-header h2 {
  margin: 0.2rem 0 0;
  font-size: clamp(2rem, 2.4vw, 2.6rem);
  line-height: 1.1;
}
.panel-header h2:focus {
  outline: none;
}
.eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.hint {
  margin: var(--space-xs) 0 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
.section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
  border-top: var(--border-hairline);
}
.waypoint-list {
  width: 100%;
}
.map-wrap .map {
  position: absolute;
  inset: 0;
}
.map-search {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
  z-index: 2;
}
.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  cursor: pointer;
}
.check input {
  accent-color: var(--color-accent);
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}
.status {
  min-height: 1.2em;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
/* Chiffres clés en ligne, au-dessus du profil (bande sous la carte) */
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-lg);
  margin: 0 0 var(--space-xs);
}
.stats dt {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.stats dd {
  margin: 0.15rem 0 0;
  font-family: var(--font-display);
  font-size: 1.7rem;
  white-space: nowrap;
}
.warnings {
  margin: 0;
  padding: var(--space-xs) var(--space-md);
  list-style: none;
  color: var(--color-gold);
  font-size: 0.85rem;
}
.panel-footer {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-xs);
  margin-top: auto;
  padding: var(--space-sm) var(--space-md);
  border-top: var(--border-hairline);
  background: var(--color-bg);
}
.panel-footer .field-error {
  width: 100%;
}
</style>

<style>
.control-marker {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 3px solid #d95926;
  border-radius: 50%;
  background: #fff;
  cursor: grab;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
.control-marker.is-highlighted {
  width: 22px;
  height: 22px;
  box-shadow: 0 0 0 4px rgba(217, 89, 38, 0.35);
}
.control-marker.is-start {
  width: 20px;
  height: 20px;
  border-color: #fff;
  background: #2f9e44;
}
.control-marker.is-end {
  width: 20px;
  height: 20px;
  border-color: #fff;
  background: #1c2823;
}
.control-marker.is-ghost {
  border-style: dashed;
  opacity: 0.85;
  pointer-events: none;
}
.control-marker:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.track-editor-poi {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 2px solid #d95926;
  border-radius: 50%;
  background: #fff;
  font-size: 0.75rem;
  pointer-events: none;
}
.track-editor-cursor {
  width: 14px;
  height: 14px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: #1c2823;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
.control-menu {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-family: var(--font-body);
}
.control-menu button {
  padding: 0.35rem 0.5rem;
  border: none;
  border-radius: 6px;
  background: none;
  color: #1c2823;
  font: inherit;
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
}
.osm-add p {
  margin: 0.15rem 0 0.35rem;
  color: #4a5a52;
  font-size: 0.8rem;
}
.control-menu .osm-add-button {
  background: #1c2823;
  color: #fff;
  font-weight: 600;
  text-align: center;
}
.control-menu .osm-add-button:hover,
.control-menu .osm-add-button:focus-visible {
  background: #33463c;
}
.osm-add-check {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
  color: #1c2823;
  font-size: 0.8rem;
  cursor: pointer;
}
.control-menu button:hover,
.control-menu button:focus-visible {
  background: rgba(28, 40, 35, 0.1);
  outline: none;
}
</style>
