<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { FeatureCollection, LineString } from 'geojson'
import maplibregl, { MAP_STYLE_URL } from '../lib/maplibre'
import type { Etape } from '../types/trek'
import { getEtapeColor } from '../utils/etapeColors'

const props = defineProps<{
  etapes: Etape[]
  highlightedId?: string | null
}>()

const emit = defineEmits<{
  hover: [etapeId: string | null]
  select: [etapeId: string]
}>()

const SOURCE_ID = 'etapes'
const LINE_LAYER_ID = 'etapes-line'
const CASING_LAYER_ID = 'etapes-casing'
const HIT_LAYER_ID = 'etapes-hit'

const mapContainer = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null
let markers = new Map<string, maplibregl.Marker>()
let resizeObserver: ResizeObserver | null = null
// Tant que l'utilisateur n'a pas déplacé la carte, on garde toutes les étapes cadrées
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
  fitToEtapes()
  applyHighlight()
}

// Pastille numérotée au départ de chaque étape
function renderStartMarkers() {
  markers.forEach((m) => m.remove())
  markers = new Map()

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

    markers.set(etape._id, new maplibregl.Marker({ element: el }).setLngLat(start).addTo(map!))
  })
}

function fitToEtapes() {
  if (!map) return
  const coordinates = props.etapes.flatMap((e) => e.gpxTrack?.coordinates ?? [])
  const [first] = coordinates
  if (!first) return

  const bounds = coordinates.reduce(
    (b, coord) => b.extend(coord),
    new maplibregl.LngLatBounds(first, first),
  )
  map.fitBounds(bounds, { padding: 48, duration: 0 })
}

function applyHighlight() {
  if (!map?.getLayer(LINE_LAYER_ID)) return
  const id = props.highlightedId

  // Sans étape survolée, tous les tracés sont au même niveau ; sinon on estompe les autres
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

  markers.forEach((marker, etapeId) => {
    marker.getElement().classList.toggle('is-highlighted', etapeId === id)
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
    if (!userHasMoved) fitToEtapes()
  })
  resizeObserver.observe(mapContainer.value)

  map.on('mousemove', HIT_LAYER_ID, (e) => {
    map!.getCanvas().style.cursor = 'pointer'
    emit('hover', etapeIdFromEvent(e))
  })
  map.on('mouseleave', HIT_LAYER_ID, () => {
    map!.getCanvas().style.cursor = ''
    emit('hover', null)
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

watch(() => props.highlightedId, applyHighlight)

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
  transition: transform 0.15s ease;
}
.etape-marker.is-highlighted {
  transform: scale(1.25);
  z-index: 1;
}
</style>
