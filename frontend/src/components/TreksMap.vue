<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { FeatureCollection, MultiLineString, Point } from 'geojson'
import maplibregl, { MAP_STYLE_URL } from '../lib/maplibre'
import type { MapView } from '../stores/treks'
import type { TrekSummary } from '../types/trek'
import type { BBox } from '../utils/geo'

const props = defineProps<{
  treks: TrekSummary[]
  /** Couleur de chaque trek, partagée avec la liste */
  colors: Record<string, string>
  /** Trek survolé (liste ou carte) */
  highlightedId?: string | null
  /** Vue à restaurer (retour sur la page) ; sinon la carte cadre tous les treks */
  initialView?: MapView | null
}>()

const emit = defineEmits<{
  hover: [trekId: string | null]
  select: [trekId: string]
  /** Après chaque déplacement : zone visible, pour proposer les treks alentour */
  viewChange: [view: MapView & { bounds: BBox }]
}>()

const TRACK_SOURCE_ID = 'treks'
const START_SOURCE_ID = 'treks-start'
const CASING_LAYER_ID = 'treks-casing'
const LINE_LAYER_ID = 'treks-line'
const HIT_LAYER_ID = 'treks-hit'
const START_LAYER_ID = 'treks-start'

const mapContainer = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null
let resizeObserver: ResizeObserver | null = null
// Cadrage automatique sur l'ensemble des treks, une seule fois (sauf vue à restaurer)
let hasFramed = !!props.initialView
// Nom du trek survolé, affiché près du curseur
const tooltip = new maplibregl.Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 12,
  className: 'trek-tooltip',
})

function trackFeatures(): FeatureCollection<MultiLineString> {
  return {
    type: 'FeatureCollection',
    features: props.treks.flatMap((trek) =>
      trek.track
        ? [
            {
              type: 'Feature',
              properties: { id: trek._id, name: trek.name, color: props.colors[trek._id] },
              geometry: trek.track,
            },
          ]
        : [],
    ),
  }
}

// Point de départ de chaque trek : reste visible quand le tracé devient minuscule (vue large)
function startFeatures(): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: props.treks.flatMap((trek) => {
      const start = trek.track?.coordinates[0]?.[0]
      return start
        ? [
            {
              type: 'Feature',
              properties: { id: trek._id, name: trek.name, color: props.colors[trek._id] },
              geometry: { type: 'Point', coordinates: start },
            },
          ]
        : []
    }),
  }
}

function renderTreks() {
  if (!map) return
  const tracks = trackFeatures()
  const starts = startFeatures()
  const trackSource = map.getSource(TRACK_SOURCE_ID) as maplibregl.GeoJSONSource | undefined

  if (trackSource) {
    trackSource.setData(tracks)
    ;(map.getSource(START_SOURCE_ID) as maplibregl.GeoJSONSource).setData(starts)
  } else {
    map.addSource(TRACK_SOURCE_ID, { type: 'geojson', data: tracks })
    map.addSource(START_SOURCE_ID, { type: 'geojson', data: starts })
    // Liseré blanc sous le tracé pour qu'il reste lisible sur tous les fonds
    map.addLayer({
      id: CASING_LAYER_ID,
      type: 'line',
      source: TRACK_SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#fff', 'line-width': 6 },
    })
    map.addLayer({
      id: LINE_LAYER_ID,
      type: 'line',
      source: TRACK_SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 3.5 },
    })
    // Couche invisible et large : zone de survol / clic plus confortable que le trait
    map.addLayer({
      id: HIT_LAYER_ID,
      type: 'line',
      source: TRACK_SOURCE_ID,
      paint: { 'line-color': '#000', 'line-width': 18, 'line-opacity': 0 },
    })
    map.addLayer({
      id: START_LAYER_ID,
      type: 'circle',
      source: START_SOURCE_ID,
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': 7,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
      },
    })
  }
  applyHighlight()
}

function fitAll(animate = true) {
  if (!map) return
  const coordinates = props.treks.flatMap((t) => t.track?.coordinates.flat() ?? [])
  const [first] = coordinates
  if (!first) return
  const bounds = coordinates.reduce(
    (b, coord) => b.extend(coord),
    new maplibregl.LngLatBounds(first, first),
  )
  map.fitBounds(bounds, { padding: 48, maxZoom: 12, duration: animate ? 800 : 0 })
}

function frameOnce() {
  if (hasFramed || !props.treks.some((t) => t.track)) return
  hasFramed = true
  fitAll(false)
}

function applyHighlight() {
  if (!map?.getLayer(LINE_LAYER_ID)) return
  const id = props.highlightedId
  const isHighlighted: maplibregl.ExpressionSpecification = ['==', ['get', 'id'], id ?? '']

  map.setPaintProperty(LINE_LAYER_ID, 'line-opacity', id ? ['case', isHighlighted, 1, 0.4] : 1)
  map.setPaintProperty(LINE_LAYER_ID, 'line-width', id ? ['case', isHighlighted, 6, 3.5] : 3.5)
  map.setPaintProperty(CASING_LAYER_ID, 'line-opacity', id ? ['case', isHighlighted, 1, 0.4] : 1)
  map.setPaintProperty(START_LAYER_ID, 'circle-radius', id ? ['case', isHighlighted, 10, 7] : 7)
  map.setPaintProperty(START_LAYER_ID, 'circle-opacity', id ? ['case', isHighlighted, 1, 0.5] : 1)
  // Le trek mis en avant passe au premier plan (sinon il peut être caché par un voisin)
  map.setLayoutProperty(LINE_LAYER_ID, 'line-sort-key', ['case', isHighlighted, 1, 0])
}

function emitView() {
  if (!map) return
  const bounds = map.getBounds()
  const { lng, lat } = map.getCenter()
  emit('viewChange', {
    center: [lng, lat],
    zoom: map.getZoom(),
    bounds: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
  })
}

function trekFromEvent(e: maplibregl.MapLayerMouseEvent) {
  const properties = e.features?.[0]?.properties
  return typeof properties?.id === 'string'
    ? { id: properties.id, name: String(properties.name) }
    : null
}

function onHover(e: maplibregl.MapLayerMouseEvent) {
  const trek = trekFromEvent(e)
  if (!map || !trek) return
  map.getCanvas().style.cursor = 'pointer'
  emit('hover', trek.id)
  tooltip.setLngLat(e.lngLat).setText(trek.name).addTo(map)
}

function onLeave() {
  if (!map) return
  map.getCanvas().style.cursor = ''
  emit('hover', null)
  tooltip.remove()
}

function onClick(e: maplibregl.MapLayerMouseEvent) {
  const trek = trekFromEvent(e)
  if (trek) emit('select', trek.id)
}

onMounted(() => {
  if (!mapContainer.value) return

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: MAP_STYLE_URL,
    center: props.initialView?.center ?? [2.5, 46.5],
    zoom: props.initialView?.zoom ?? 5,
    attributionControl: { compact: true },
  })

  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  // « Autour de moi » : centre la carte sur la position, la liste suit
  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: false },
      fitBoundsOptions: { maxZoom: 9 },
    }),
    'top-right',
  )
  map.addControl(new maplibregl.ScaleControl(), 'bottom-left')

  map.on('load', () => {
    renderTreks()
    frameOnce()
    emitView()
  })
  map.on('moveend', emitView)

  // Le conteneur peut changer de taille (mise en page, rotation) : maplibre ne suit que le
  // redimensionnement de la fenêtre, on le prévient donc explicitement
  resizeObserver = new ResizeObserver(() => map?.resize())
  resizeObserver.observe(mapContainer.value)

  for (const layer of [HIT_LAYER_ID, START_LAYER_ID]) {
    map.on('mousemove', layer, onHover)
    map.on('mouseleave', layer, onLeave)
    map.on('click', layer, onClick)
  }
})

watch(
  () => [props.treks, props.colors],
  () => {
    if (!map?.isStyleLoaded()) return
    renderTreks()
    // Treks arrivés après le chargement de la carte (premier affichage)
    frameOnce()
  },
)

watch(() => props.highlightedId, applyHighlight)

onUnmounted(() => {
  resizeObserver?.disconnect()
  tooltip.remove()
  map?.remove()
})

defineExpose({ fitAll })
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
.trek-tooltip {
  pointer-events: none;
}
.trek-tooltip .maplibregl-popup-tip {
  display: none;
}
.trek-tooltip .maplibregl-popup-content {
  color: var(--color-bg-deep);
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.3rem 0.6rem;
}
</style>
