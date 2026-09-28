<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { FeatureCollection, LineString } from 'geojson'
import maplibregl, { MAP_STYLE_URL } from '../lib/maplibre'
import type { Etape, POI } from '../types/trek'
import { getEtapeColor } from '../utils/etapeColors'
import { POI_ICONS } from '../utils/poi'
import type { ProfileHover } from './ElevationProfile.vue'

const props = defineProps<{
  etapes: Etape[]
  /** Étape survolée (liste ou carte) : mise en avant temporaire */
  highlightedId?: string | null
  /** Étape affichée (page étape) : mise en avant permanente et cadrage de la carte */
  focusedId?: string | null
  pois?: POI[]
  highlightedPoiId?: string | null
  /** Position survolée sur le profil d'altitude */
  cursor?: [number, number] | null
}>()

const emit = defineEmits<{
  hover: [etapeId: string | null]
  select: [etapeId: string]
  poiHover: [poiId: string | null]
  /** Point du tracé le plus proche de la souris, pour caler le curseur du profil */
  trackHover: [value: ProfileHover | null]
}>()

// Point du GPX le plus proche de la souris sur le tracé d'une étape.
// Les longitudes sont ramenées à l'échelle des latitudes (cos φ) : en Islande, un degré
// de longitude ne vaut que ~45 % d'un degré de latitude.
function nearestTrackPoint(etapeId: string, { lng, lat }: maplibregl.LngLat) {
  const coordinates = props.etapes.find((e) => e._id === etapeId)?.gpxTrack?.coordinates
  if (!coordinates?.length) return null
  const lonScale = Math.cos((lat * Math.PI) / 180)

  let best = coordinates[0]!
  let bestDistance = Infinity
  for (const coord of coordinates) {
    const distance = ((coord[0] - lng) * lonScale) ** 2 + (coord[1] - lat) ** 2
    if (distance < bestDistance) {
      best = coord
      bestDistance = distance
    }
  }
  return best
}

const SOURCE_ID = 'etapes'
const LINE_LAYER_ID = 'etapes-line'
const CASING_LAYER_ID = 'etapes-casing'
const HIT_LAYER_ID = 'etapes-hit'

const mapContainer = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null
let etapeMarkers = new Map<string, maplibregl.Marker>()
let poiMarkers = new Map<string, maplibregl.Marker>()
let cursorMarker: maplibregl.Marker | null = null
let resizeObserver: ResizeObserver | null = null
// Tant que l'utilisateur n'a pas déplacé la carte, on garde le cadrage automatique
let userHasMoved = false

function buildFeatureCollection(): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: props.etapes.flatMap((etape, index) =>
      etape.gpxTrack
        ? [
            {
              type: 'Feature',
              properties: { id: etape._id, color: getEtapeColor(index) },
              geometry: etape.gpxTrack,
            },
          ]
        : [],
    ),
  }
}

function renderEtapes() {
  if (!map) return

  const data = buildFeatureCollection()
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined

  if (source) {
    source.setData(data)
  } else {
    map.addSource(SOURCE_ID, { type: 'geojson', data })
    // Liseré blanc sous le tracé pour qu'il reste lisible sur tous les fonds
    map.addLayer({
      id: CASING_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#fff', 'line-width': 7 },
    })
    map.addLayer({
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 4 },
    })
    // Couche invisible et large : zone de survol / clic plus confortable que le trait
    map.addLayer({
      id: HIT_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: { 'line-color': '#000', 'line-width': 18, 'line-opacity': 0 },
    })
  }

  renderStartMarkers()
  renderPoiMarkers()
  fitToContent(false)
  applyHighlight()
}

// Pastille numérotée au départ de chaque étape
function renderStartMarkers() {
  etapeMarkers.forEach((m) => m.remove())
  etapeMarkers = new Map()

  props.etapes.forEach((etape, index) => {
    const start = etape.gpxTrack?.coordinates[0]
    if (!start) return

    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'etape-marker'
    el.textContent = String(etape.order)
    el.style.setProperty('--etape-color', getEtapeColor(index))
    el.setAttribute('aria-label', etape.name)
    el.addEventListener('mouseenter', () => emit('hover', etape._id))
    el.addEventListener('mouseleave', () => emit('hover', null))
    el.addEventListener('click', () => emit('select', etape._id))

    etapeMarkers.set(etape._id, new maplibregl.Marker({ element: el }).setLngLat(start).addTo(map!))
  })
}

function renderPoiMarkers() {
  poiMarkers.forEach((m) => m.remove())
  poiMarkers = new Map()

  props.pois?.forEach((poi) => {
    const el = document.createElement('div')
    el.className = 'poi-marker'
    el.textContent = POI_ICONS[poi.type]
    el.addEventListener('mouseenter', () => emit('poiHover', poi._id))
    el.addEventListener('mouseleave', () => emit('poiHover', null))

    const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setText(poi.name)
    poiMarkers.set(
      poi._id,
      new maplibregl.Marker({ element: el })
        .setLngLat(poi.location.coordinates)
        .setPopup(popup)
        .addTo(map!),
    )
  })
}

// Cadre l'étape affichée (et ses POI) si il y en a une, sinon l'ensemble des étapes
function fitToContent(animate: boolean) {
  if (!map) return
  const focused = props.etapes.find((e) => e._id === props.focusedId)
  const coordinates = focused
    ? [
        ...(focused.gpxTrack?.coordinates ?? []),
        ...(props.pois ?? []).map((p) => p.location.coordinates),
      ]
    : props.etapes.flatMap((e) => e.gpxTrack?.coordinates ?? [])
  const [first] = coordinates
  if (!first) return

  const bounds = coordinates.reduce(
    (b, coord) => b.extend(coord),
    new maplibregl.LngLatBounds(first, first),
  )
  map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: animate ? 800 : 0 })
}

function applyHighlight() {
  if (!map?.getLayer(LINE_LAYER_ID)) return
  // Le survol prime sur l'étape affichée ; sans l'un ni l'autre, tout est au même niveau
  const id = props.highlightedId ?? props.focusedId

  map.setPaintProperty(
    LINE_LAYER_ID,
    'line-opacity',
    id ? ['case', ['==', ['get', 'id'], id], 1, 0.35] : 1,
  )
  map.setPaintProperty(
    LINE_LAYER_ID,
    'line-width',
    id ? ['case', ['==', ['get', 'id'], id], 6, 4] : 4,
  )
  map.setPaintProperty(
    CASING_LAYER_ID,
    'line-opacity',
    id ? ['case', ['==', ['get', 'id'], id], 1, 0.35] : 1,
  )

  etapeMarkers.forEach((marker, etapeId) => {
    marker.getElement().classList.toggle('is-highlighted', etapeId === id)
  })
}

function applyPoiHighlight() {
  poiMarkers.forEach((marker, poiId) => {
    const isHighlighted = poiId === props.highlightedPoiId
    marker.getElement().classList.toggle('is-highlighted', isHighlighted)
    if (isHighlighted !== marker.getPopup()?.isOpen()) marker.togglePopup()
  })
}

function etapeIdFromEvent(e: maplibregl.MapLayerMouseEvent): string | null {
  const id = e.features?.[0]?.properties?.id
  return typeof id === 'string' ? id : null
}

onMounted(() => {
  if (!mapContainer.value) return

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: MAP_STYLE_URL,
    center: [2.5, 46.5],
    zoom: 5,
    attributionControl: { compact: true },
  })

  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  map.addControl(new maplibregl.ScaleControl(), 'bottom-left')
  map.on('load', renderEtapes)
  map.on('movestart', (e) => {
    if (e.originalEvent) userHasMoved = true
  })

  // Le conteneur peut changer de taille (mise en page, sticky, rotation) : maplibre ne
  // suit que le redimensionnement de la fenêtre, on le prévient donc explicitement.
  resizeObserver = new ResizeObserver(() => {
    map?.resize()
    if (!userHasMoved) fitToContent(false)
  })
  resizeObserver.observe(mapContainer.value)

  map.on('mousemove', HIT_LAYER_ID, (e) => {
    map!.getCanvas().style.cursor = 'pointer'
    const etapeId = etapeIdFromEvent(e)
    emit('hover', etapeId)
    const coordinates = etapeId ? nearestTrackPoint(etapeId, e.lngLat) : null
    emit('trackHover', etapeId && coordinates ? { segmentId: etapeId, coordinates } : null)
  })
  map.on('mouseleave', HIT_LAYER_ID, () => {
    map!.getCanvas().style.cursor = ''
    emit('hover', null)
    emit('trackHover', null)
  })
  map.on('click', HIT_LAYER_ID, (e) => {
    const id = etapeIdFromEvent(e)
    if (id) emit('select', id)
  })
})

watch(
  () => props.etapes,
  () => {
    if (map?.isStyleLoaded()) renderEtapes()
  },
)

// Passage à une autre étape sans démonter la carte (étape précédente / suivante)
watch(
  () => [props.focusedId, props.pois],
  () => {
    if (!map?.isStyleLoaded()) return
    renderPoiMarkers()
    userHasMoved = false
    fitToContent(true)
    applyHighlight()
  },
)

watch(() => props.highlightedId, applyHighlight)
watch(() => props.highlightedPoiId, applyPoiHighlight)

watch(
  () => props.cursor,
  (cursor) => {
    if (!map) return
    if (!cursor) {
      cursorMarker?.remove()
      return
    }
    if (!cursorMarker) {
      const el = document.createElement('div')
      el.className = 'profile-cursor'
      cursorMarker = new maplibregl.Marker({ element: el })
    }
    cursorMarker.setLngLat(cursor).addTo(map)
  },
)

onUnmounted(() => {
  resizeObserver?.disconnect()
  map?.remove()
})
</script>

<template>
  <div ref="mapContainer" class="map-container" />
</template>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  min-height: 320px;
}
</style>

<style>
.etape-marker {
  --etape-color: var(--color-bg);
  width: 26px;
  height: 26px;
  padding: 0;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--etape-color);
  color: #fff;
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  z-index: 2;
  /* maplibre positionne les marqueurs via transform : on anime la taille, pas un scale */
  transition:
    opacity 0.2s,
    width 0.15s ease,
    height 0.15s ease;
}
.poi-marker {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 2px solid var(--color-bg);
  border-radius: 50%;
  background: #fff;
  font-size: 0.8rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  /* maplibre positionne les marqueurs via transform : on anime la taille, pas un scale */
  transition:
    opacity 0.2s,
    width 0.15s ease,
    height 0.15s ease;
}
.etape-marker.is-highlighted,
.poi-marker.is-highlighted {
  width: 32px;
  height: 32px;
  z-index: 3;
}
.profile-cursor {
  width: 14px;
  height: 14px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: #1a1a1a;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  z-index: 4;
}
.maplibregl-popup-content {
  color: #1a1a1a;
  font-family: var(--font-body);
  font-size: 0.85rem;
  padding: 0.35rem 0.6rem;
}
</style>
