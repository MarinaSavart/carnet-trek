<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import maplibregl, { MAP_STYLE_URL } from '../lib/maplibre'
import type { Feature } from 'geojson'
import type { GeoJSONLineString, POI } from '../types/trek'

const props = defineProps<{
  track?: GeoJSONLineString
  pois: POI[]
}>()

const mapContainer = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null
let markers: maplibregl.Marker[] = []

function clearMarkers() {
  markers.forEach((m) => m.remove())
  markers = []
}

function renderTrackAndPois() {
  if (!map) return

  // Tracé GPX
  if (props.track) {
    const source = map.getSource('track') as maplibregl.GeoJSONSource | undefined
    const geojson: Feature = {
      type: 'Feature',
      properties: {},
      geometry: props.track,
    }

    if (source) {
      source.setData(geojson)
    } else {
      map.addSource('track', { type: 'geojson', data: geojson })
      map.addLayer({
        id: 'track-line',
        type: 'line',
        source: 'track',
        paint: {
          'line-color': '#6FCFC0',
          'line-width': 3,
        },
      })
    }

    const bounds = props.track.coordinates.reduce(
      (b, coord) => b.extend(coord as [number, number]),
      new maplibregl.LngLatBounds(props.track.coordinates[0], props.track.coordinates[0]),
    )
    map.fitBounds(bounds, { padding: 40 })
  }

  // POI
  clearMarkers()
  props.pois.forEach((poi) => {
    const el = document.createElement('div')
    el.className = 'poi-marker'

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(poi.location.coordinates)
      .setPopup(new maplibregl.Popup({ offset: 20 }).setText(poi.name))
      .addTo(map!)

    markers.push(marker)
  })
}

onMounted(() => {
  if (!mapContainer.value) return

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: MAP_STYLE_URL,
    center: [2.5, 46.5],
    zoom: 5,
  })

  map.addControl(new maplibregl.NavigationControl(), 'top-right')
  map.on('load', renderTrackAndPois)
})

watch(
  () => [props.track, props.pois],
  () => {
    if (map?.isStyleLoaded()) renderTrackAndPois()
  },
)

onUnmounted(() => {
  map?.remove()
})
</script>

<template>
  <div ref="mapContainer" class="map-container" />
</template>

<style scoped>
.map-container {
  height: 400px;
  width: 100%;
}
</style>

<style>
.poi-marker {
  width: 14px;
  height: 14px;
  background: var(--color-accent);
  border: 2px solid var(--color-bg);
  border-radius: 50%;
  cursor: pointer;
}
</style>
