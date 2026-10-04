<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import maplibregl, { MAP_STYLE_URL } from '../lib/maplibre'
import { setupOutdoorMap } from '../lib/outdoorMap'
import { OsmPoiLayer, osmPoiStatusLabel, type OsmPoiStatus } from '../lib/osmPoiLayer'
import type { GeoJSONLineString, POI, POIType } from '../types/trek'
import type { OsmPoi } from '../utils/overpass'
import { POI_ICONS } from '../utils/poi'
import { newId } from '../utils/id'

// Éditeur plein écran des points d'intérêt d'une étape : ajout depuis OpenStreetMap ou
// par clic sur la carte, modification, déplacement (glisser le marqueur), suppression.
// Rien n'est enregistré ici : « Terminer » renvoie la liste au formulaire du trek.

const props = defineProps<{
  title: string
  track: GeoJSONLineString | null
  pois: POI[]
}>()

const emit = defineEmits<{
  save: [pois: POI[]]
  close: []
}>()

const POI_LABELS: Record<POIType, string> = {
  point_eau: "Point d'eau",
  refuge: 'Refuge / abri',
  camping: 'Camping / bivouac',
  sommet: 'Sommet',
  ravitaillement: 'Ravitaillement',
  autre: 'Autre',
}
const POI_TYPES = Object.keys(POI_LABELS) as POIType[]

const pois = ref<POI[]>(props.pois.map((poi) => ({ ...poi, location: { ...poi.location } })))
const isDirty = ref(false)

// --- Formulaire : modification d'un point existant, ou nouveau point (id null) ---

interface PoiForm {
  id: string | null
  type: POIType
  name: string
  notes: string
  coordinates: [number, number]
}
const form = ref<PoiForm | null>(null)
const formError = ref<string | null>(null)

async function openForm(value: PoiForm) {
  form.value = reactive(value)
  formError.value = null
  await nextTick()
  document.getElementById('poi-form-name')?.focus()
}

function editPoi(poi: POI) {
  openForm({
    id: poi._id,
    type: poi.type,
    name: poi.name,
    notes: poi.notes ?? '',
    coordinates: poi.location.coordinates,
  })
  map?.easeTo({ center: poi.location.coordinates, zoom: Math.max(map.getZoom(), 14) })
}

function submitForm() {
  const current = form.value
  if (!current) return
  if (!current.name.trim()) {
    formError.value = 'Donne un nom à ce point'
    return
  }
  const poi: POI = {
    _id: current.id ?? `new-${newId()}`,
    type: current.type,
    name: current.name.trim(),
    notes: current.notes.trim() || undefined,
    location: { type: 'Point', coordinates: current.coordinates },
  }
  pois.value = current.id
    ? pois.value.map((p) => (p._id === current.id ? poi : p))
    : [...pois.value, poi]
  isDirty.value = true
  form.value = null
}

function removePoi(poi: POI) {
  pois.value = pois.value.filter((p) => p._id !== poi._id)
  isDirty.value = true
  if (form.value?.id === poi._id) form.value = null
}

function addFromOsm(osm: OsmPoi) {
  pois.value = [
    ...pois.value,
    {
      _id: `new-${newId()}`,
      type: osm.type,
      name: osm.name,
      notes: osm.notes,
      location: { type: 'Point', coordinates: osm.coordinates },
    },
  ]
  isDirty.value = true
}

function finish() {
  emit('save', pois.value)
}

function cancel() {
  if (isDirty.value && !window.confirm('Abandonner les modifications des points d’intérêt ?')) {
    return
  }
  emit('close')
}

// --- Carte ---

const mapContainer = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null
let osmLayer: OsmPoiLayer | null = null
let poiMarkers: maplibregl.Marker[] = []
let draftMarker: maplibregl.Marker | null = null
let osmPopup: maplibregl.Popup | null = null

const showOsm = ref(true)
const osmStatus = ref<OsmPoiStatus>({ state: 'off' })

// Un point OSM déjà ajouté à l'étape (à ~15 m près) n'est plus proposé
function isAlreadyAdded(osm: OsmPoi): boolean {
  const [lon, lat] = osm.coordinates
  return pois.value.some(
    ({
      location: {
        coordinates: [pLon, pLat],
      },
    }) => Math.abs(pLat - lat) < 0.00015 && Math.abs(pLon - lon) < 0.0002,
  )
}

function showOsmPopup(osm: OsmPoi) {
  if (!map) return
  osmPopup?.remove()

  const content = document.createElement('div')
  content.className = 'osm-popup'
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
  button.className = 'osm-popup-add'
  button.textContent = "Ajouter à l'étape"
  button.addEventListener('click', () => {
    addFromOsm(osm)
    osmPopup?.remove()
  })
  content.append(button)

  // closeOnClick désactivé : le clic sur la carte qui ferme la bulle est géré plus bas,
  // pour qu'il ne crée pas en même temps un nouveau point
  osmPopup = new maplibregl.Popup({ offset: 14, maxWidth: '260px', closeOnClick: false })
    .setLngLat(osm.coordinates)
    .setDOMContent(content)
    .addTo(map)
  button.focus()
}

// MapLibre place marqueurs et bulles dans le conteneur de la carte : un clic dessus
// remonte aussi comme un clic sur la carte, à ignorer
function isOnOverlay(event: Event): boolean {
  return (
    event.target instanceof Element &&
    !!event.target.closest('.maplibregl-marker, .maplibregl-popup')
  )
}

function renderTrack() {
  if (!map || !props.track) return
  map.addSource('etape-track', {
    type: 'geojson',
    data: { type: 'Feature', properties: {}, geometry: props.track },
  })
  map.addLayer({
    id: 'etape-track-casing',
    type: 'line',
    source: 'etape-track',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#fff', 'line-width': 7 },
  })
  map.addLayer({
    id: 'etape-track-line',
    type: 'line',
    source: 'etape-track',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#d95926', 'line-width': 4 },
  })
}

function renderPoiMarkers() {
  if (!map) return
  poiMarkers.forEach((m) => m.remove())
  poiMarkers = pois.value.map((poi) => {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'etape-poi-marker'
    el.classList.toggle('is-selected', form.value?.id === poi._id)
    el.textContent = POI_ICONS[poi.type]
    el.setAttribute('aria-label', `Modifier ${poi.name}`)
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      editPoi(poi)
    })

    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat(poi.location.coordinates)
      .addTo(map!)
    // Glisser un marqueur déplace le point
    marker.on('dragend', () => {
      const { lng, lat } = marker.getLngLat()
      const coordinates: [number, number] = [lng, lat]
      pois.value = pois.value.map((p) =>
        p._id === poi._id ? { ...p, location: { type: 'Point', coordinates } } : p,
      )
      if (form.value?.id === poi._id) form.value.coordinates = coordinates
      isDirty.value = true
    })
    return marker
  })
}

// Nouveau point en cours de saisie : marqueur provisoire, déplaçable lui aussi
function renderDraftMarker() {
  draftMarker?.remove()
  draftMarker = null
  const current = form.value
  if (!map || !current || current.id) return
  const el = document.createElement('div')
  el.className = 'etape-poi-marker is-draft'
  el.textContent = POI_ICONS[current.type]
  draftMarker = new maplibregl.Marker({ element: el, draggable: true })
    .setLngLat(current.coordinates)
    .addTo(map)
  draftMarker.on('dragend', () => {
    const { lng, lat } = draftMarker!.getLngLat()
    if (form.value) form.value.coordinates = [lng, lat]
  })
}

function fitToContent() {
  if (!map) return
  const coordinates = [
    ...(props.track?.coordinates ?? []),
    ...pois.value.map((p) => p.location.coordinates),
  ]
  const [first] = coordinates
  if (!first) return
  const bounds = coordinates.reduce(
    (b, coord) => b.extend(coord),
    new maplibregl.LngLatBounds(first, first),
  )
  map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 })
}

onMounted(() => {
  // La page derrière ne défile plus pendant l'édition
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeydown)
  document.getElementById('poi-editor-title')?.focus()

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

  map.on('load', () => {
    renderTrack()
    renderPoiMarkers()
    fitToContent()
    osmLayer = new OsmPoiLayer(map!, {
      onSelect: showOsmPopup,
      onStatus: (status) => (osmStatus.value = status),
      isHidden: isAlreadyAdded,
    })
    osmLayer.setEnabled(showOsm.value)
  })

  // Clic sur la carte (hors marqueur) : nouveau point à cet endroit
  map.on('click', (e) => {
    if (isOnOverlay(e.originalEvent)) return
    if (osmPopup?.isOpen()) {
      osmPopup.remove()
      return
    }
    openForm({
      id: null,
      type: 'autre',
      name: '',
      notes: '',
      coordinates: [e.lngLat.lng, e.lngLat.lat],
    })
  })
})

watch(
  pois,
  () => {
    renderPoiMarkers()
    osmLayer?.refresh()
  },
  { deep: true },
)
watch(
  () => [form.value?.id, form.value?.type, form.value?.coordinates],
  () => {
    renderDraftMarker()
    renderPoiMarkers()
  },
)
watch(showOsm, (enabled) => osmLayer?.setEnabled(enabled))

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (osmPopup?.isOpen()) osmPopup.remove()
  else if (form.value) form.value = null
  else cancel()
}

onUnmounted(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKeydown)
  osmLayer?.destroy()
  map?.remove()
})

const sortedPois = computed(() =>
  [...pois.value].sort((a, b) => POI_TYPES.indexOf(a.type) - POI_TYPES.indexOf(b.type)),
)
</script>

<template>
  <Teleport to="body">
    <div class="editor" role="dialog" aria-modal="true" aria-labelledby="poi-editor-title">
      <aside class="panel">
        <header class="panel-header">
          <p class="eyebrow">Points d'intérêt</p>
          <h2 id="poi-editor-title" tabindex="-1">{{ title }}</h2>
          <p class="hint">
            Clique sur la carte pour ajouter un point, ou sur un point utile OpenStreetMap. Glisse
            un marqueur pour le déplacer.
          </p>
        </header>

        <div class="osm-toggle">
          <label class="switch">
            <input v-model="showOsm" type="checkbox" />
            <span>Points utiles OpenStreetMap</span>
          </label>
          <p
            v-if="showOsm && osmStatus.state !== 'off'"
            class="osm-status"
            :class="{ 'is-error': osmStatus.state === 'error' }"
            aria-live="polite"
          >
            {{ osmPoiStatusLabel(osmStatus) }}
          </p>
        </div>

        <form v-if="form" class="poi-form" @submit.prevent="submitForm">
          <p class="form-title">{{ form.id ? 'Modifier le point' : 'Nouveau point' }}</p>
          <label class="field">
            <span class="field-label">Type</span>
            <select v-model="form.type" class="select">
              <option v-for="type in POI_TYPES" :key="type" :value="type">
                {{ POI_ICONS[type] }} {{ POI_LABELS[type] }}
              </option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Nom</span>
            <input
              id="poi-form-name"
              v-model="form.name"
              class="input"
              maxlength="200"
              placeholder="Ex. Source de la Coma"
              :aria-invalid="formError ? 'true' : undefined"
            />
          </label>
          <label class="field">
            <span class="field-label">Notes <span class="field-hint">(facultatif)</span></span>
            <textarea
              v-model="form.notes"
              class="textarea"
              maxlength="2000"
              placeholder="Débit, saison, horaires…"
            />
          </label>
          <p v-if="formError" class="field-error" role="alert">{{ formError }}</p>
          <div class="form-actions">
            <button type="button" class="btn" @click="form = null">Annuler</button>
            <button type="submit" class="btn btn-primary">
              {{ form.id ? 'Valider' : 'Ajouter' }}
            </button>
          </div>
        </form>

        <section class="poi-list" aria-label="Points de l'étape">
          <p class="list-title">
            Points de l'étape <span class="count">{{ pois.length }}</span>
          </p>
          <p v-if="!pois.length" class="empty">Aucun point pour l'instant.</p>
          <ul v-else>
            <li
              v-for="poi in sortedPois"
              :key="poi._id"
              class="poi-row"
              :class="{ 'is-selected': form?.id === poi._id }"
            >
              <button type="button" class="poi-main" @click="editPoi(poi)">
                <span class="poi-icon" aria-hidden="true">{{ POI_ICONS[poi.type] }}</span>
                <span class="poi-text">
                  <strong>{{ poi.name }}</strong>
                  <span v-if="poi.notes" class="poi-notes">{{ poi.notes }}</span>
                </span>
              </button>
              <button
                type="button"
                class="poi-remove"
                :aria-label="`Supprimer ${poi.name}`"
                @click="removePoi(poi)"
              >
                ×
              </button>
            </li>
          </ul>
        </section>

        <footer class="panel-footer">
          <button type="button" class="btn" @click="cancel">Annuler</button>
          <button type="button" class="btn btn-primary" @click="finish">Terminer</button>
        </footer>
      </aside>

      <div ref="mapContainer" class="map" />
    </div>
  </Teleport>
</template>

<style scoped>
.editor {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  grid-template-columns: minmax(300px, 380px) 1fr;
  background: var(--color-bg);
}
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: var(--border-hairline);
  background: var(--color-bg-deep);
}
.panel-header,
.osm-toggle,
.poi-form,
.poi-list {
  padding: var(--space-sm) var(--space-md);
}
.panel-header {
  padding-top: var(--space-md);
}
.panel-header h2 {
  margin: 0.2rem 0 0;
  font-size: 1.6rem;
  line-height: 1.15;
}
.panel-header h2:focus {
  outline: none;
}
.eyebrow,
.list-title,
.form-title {
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
.osm-toggle {
  border-top: var(--border-hairline);
}
.switch {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 600;
  cursor: pointer;
}
.switch input {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--color-accent);
}
.osm-status {
  margin: 0.35rem 0 0 1.7rem;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
.osm-status.is-error {
  color: var(--color-danger);
}
.poi-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin: 0 var(--space-sm);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius);
  background: var(--color-surface);
}
.form-actions,
.panel-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
}
.poi-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.poi-list ul {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  list-style: none;
  padding: 0;
  margin: var(--space-xs) 0 0;
}
.count {
  font-family: var(--font-body);
  text-transform: none;
}
.empty {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
.poi-row {
  display: flex;
  align-items: stretch;
  border: var(--border-hairline);
  border-radius: var(--radius);
  background: var(--color-surface);
}
.poi-row.is-selected {
  border-color: var(--color-accent);
}
.poi-main {
  display: flex;
  flex: 1;
  align-items: flex-start;
  gap: var(--space-xs);
  min-width: 0;
  padding: 0.55rem var(--space-xs);
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.poi-icon {
  flex-shrink: 0;
}
.poi-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.poi-notes {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.poi-remove {
  padding: 0 0.75rem;
  border: none;
  border-left: var(--border-hairline);
  border-radius: 0 var(--radius) var(--radius) 0;
  background: none;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 1.1rem;
  cursor: pointer;
}
.poi-remove:hover {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}
.poi-main:focus-visible,
.poi-remove:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}
.panel-footer {
  padding: var(--space-sm) var(--space-md);
  border-top: var(--border-hairline);
}
.map {
  min-width: 0;
  min-height: 0;
}

/* Mobile : carte en haut, panneau en dessous */
@media (max-width: 760px) {
  .editor {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 50vh minmax(0, 1fr);
  }
  .map {
    grid-row: 1;
  }
  .panel {
    grid-row: 2;
    border-right: none;
    border-top: var(--border-hairline);
  }
}
</style>

<style>
.etape-poi-marker {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 2px solid #d95926;
  border-radius: 50%;
  background: #fff;
  font-size: 0.9rem;
  line-height: 1;
  cursor: grab;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}
.etape-poi-marker.is-selected,
.etape-poi-marker.is-draft {
  width: 36px;
  height: 36px;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 4px var(--color-accent-soft);
  z-index: 4;
}
.etape-poi-marker.is-draft {
  border-style: dashed;
}
.osm-popup {
  color: var(--color-bg-deep);
  font-family: var(--font-body);
}
.osm-popup p {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
}
.osm-popup-add {
  margin-top: 0.5rem;
  padding: 0.3rem 0.8rem;
  border: none;
  border-radius: 999px;
  background: var(--color-bg-deep);
  color: #fff;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
</style>
