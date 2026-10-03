<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { Etape, POI } from '../types/trek'
import { MIN_CUT_GAP_KM, cutName, formatKm } from '../utils/decoupage'
import { locateOnTrack, pointAt, trackLengthKm } from '../utils/etapeGeometry'
import { fetchOsmPois } from '../utils/overpass'
import { POI_ICONS } from '../utils/poi'

// Ajouter une nuit au milieu d'une étape : hébergements le long de la trace (ceux de
// l'étape, et sur demande ceux d'OpenStreetMap), ou n'importe quel point au curseur.

const props = defineProps<{
  etape: Etape
  /** Nuits déjà placées dans cette étape (km) */
  existingKms: number[]
}>()

const emit = defineEmits<{
  add: [km: number]
  /** Aperçu sur la carte du point visé ; null pour l'effacer */
  preview: [point: [number, number] | null]
  close: []
}>()

interface Suggestion {
  key: string
  type: POI['type']
  name: string
  km: number
  source: 'etape' | 'osm'
}

const LODGING_TYPES: POI['type'][] = ['refuge', 'camping']
const MAX_OFFSET_KM = 0.3
// Deux hébergements à moins de 200 m sur la trace : on n'en garde qu'un
const SAME_PLACE_KM = 0.2

const lengthKm = computed(() => trackLengthKm(props.etape))

// Une nuit trop près d'un bout d'étape ou d'une nuit existante n'a pas de sens
function isPlaceable(km: number): boolean {
  return (
    km >= MIN_CUT_GAP_KM &&
    km <= lengthKm.value - MIN_CUT_GAP_KM &&
    props.existingKms.every((existing) => Math.abs(existing - km) >= MIN_CUT_GAP_KM)
  )
}

function locate(
  type: POI['type'],
  name: string,
  point: [number, number],
  source: Suggestion['source'],
  key: string,
): Suggestion[] {
  const located = locateOnTrack(props.etape, point)
  if (!located || located.offsetKm > MAX_OFFSET_KM || !isPlaceable(located.km)) return []
  return [{ key, type, name, km: located.km, source }]
}

const osmSuggestions = ref<Suggestion[]>([])

const suggestions = computed(() => {
  const all = [
    ...props.etape.pois
      .filter((poi) => LODGING_TYPES.includes(poi.type))
      .flatMap((poi) => locate(poi.type, poi.name, poi.location.coordinates, 'etape', poi._id)),
    ...osmSuggestions.value.filter((s) => isPlaceable(s.km)),
  ].sort((a, b) => a.km - b.km)
  return all.filter(
    (s, i) => !all.slice(0, i).some((other) => Math.abs(other.km - s.km) < SAME_PLACE_KM),
  )
})

// --- Hébergements OpenStreetMap autour de la trace (à la demande : Overpass est lent) ---

const osmState = ref<'idle' | 'loading' | 'done' | 'error'>('idle')
const osmError = ref<string | null>(null)
let controller: AbortController | null = null

async function searchOsm() {
  const coordinates = props.etape.gpxTrack?.coordinates ?? []
  if (!coordinates.length) return
  const lons = coordinates.map((c) => c[0])
  const lats = coordinates.map((c) => c[1])
  const margin = 0.005 // ~ 400 m autour de la trace
  controller?.abort()
  controller = new AbortController()
  osmState.value = 'loading'
  osmError.value = null
  try {
    const pois = await fetchOsmPois(
      [
        Math.min(...lons) - margin,
        Math.min(...lats) - margin,
        Math.max(...lons) + margin,
        Math.max(...lats) + margin,
      ],
      controller.signal,
    )
    osmSuggestions.value = pois
      .filter((poi) => LODGING_TYPES.includes(poi.type))
      .flatMap((poi) =>
        locate(
          poi.type,
          poi.name === poi.kind ? poi.kind : `${poi.name} (${poi.kind.toLowerCase()})`,
          poi.coordinates,
          'osm',
          poi.id,
        ),
      )
    osmState.value = 'done'
  } catch (e) {
    if (controller.signal.aborted) return
    osmState.value = 'error'
    osmError.value = e instanceof Error ? e.message : 'Recherche impossible'
  }
}

onUnmounted(() => {
  controller?.abort()
  emit('preview', null)
})

// --- Nuit n'importe où (curseur) ---

const customKm = ref(Math.round((lengthKm.value / 2) * 10) / 10)
const customName = computed(() => cutName(props.etape, customKm.value))

function previewKm(km: number | null) {
  emit('preview', km === null ? null : pointAt(props.etape, km))
}

function add(km: number) {
  emit('preview', null)
  emit('add', km)
}
</script>

<template>
  <div class="cut-picker" role="group" :aria-label="`Ajouter une nuit dans « ${etape.name} »`">
    <p class="title">Où dormir dans cette étape ?</p>

    <ul v-if="suggestions.length" class="suggestions">
      <li v-for="s in suggestions" :key="s.key">
        <button
          type="button"
          class="suggestion"
          @click="add(s.km)"
          @mouseenter="previewKm(s.km)"
          @mouseleave="previewKm(null)"
          @focus="previewKm(s.km)"
          @blur="previewKm(null)"
        >
          <span aria-hidden="true">{{ POI_ICONS[s.type] }}</span>
          <span class="suggestion-name">{{ s.name }}</span>
          <span class="suggestion-km">km {{ formatKm(s.km) }}</span>
        </button>
      </li>
    </ul>
    <p v-else class="empty">Aucun hébergement connu le long de cette étape.</p>

    <button
      v-if="osmState !== 'done'"
      type="button"
      class="link-btn"
      :disabled="osmState === 'loading'"
      @click="searchOsm"
    >
      {{
        osmState === 'loading'
          ? 'Recherche dans OpenStreetMap… (quelques secondes)'
          : 'Chercher refuges, cabanes et campings dans OpenStreetMap'
      }}
    </button>
    <p v-else-if="!osmSuggestions.length" class="empty">Rien de plus dans OpenStreetMap.</p>
    <p v-if="osmError" class="field-error" role="alert">{{ osmError }}</p>

    <div class="custom">
      <label class="custom-label" :for="`cut-km-${etape._id}`">
        Ou n'importe où :
        <strong>km {{ formatKm(customKm) }}</strong>
        <span class="custom-name">{{ customName }}</span>
      </label>
      <input
        :id="`cut-km-${etape._id}`"
        v-model.number="customKm"
        type="range"
        :min="MIN_CUT_GAP_KM"
        :max="Math.max(MIN_CUT_GAP_KM, lengthKm - MIN_CUT_GAP_KM)"
        step="0.1"
        class="slider"
        @input="previewKm(customKm)"
        @pointerup="previewKm(null)"
      />
      <div class="actions">
        <button type="button" class="btn" @click="emit('close')">Annuler</button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!isPlaceable(customKm)"
          @click="add(customKm)"
        >
          Dormir ici
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cut-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-top: var(--space-xs);
  padding: var(--space-sm);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius);
  background: var(--color-bg-deep);
}
.title {
  margin: 0;
  font-weight: 600;
}
.suggestions {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.suggestion {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.7rem;
  border: var(--border-hairline);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: inherit;
  font: inherit;
  font-size: 0.9rem;
  text-align: left;
  cursor: pointer;
}
.suggestion:hover,
.suggestion:focus-visible {
  border-color: var(--color-accent);
  outline: none;
}
.suggestion-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.suggestion-km {
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}
.empty {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
.link-btn {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-accent);
  font: inherit;
  font-size: 0.85rem;
  text-decoration: underline;
  cursor: pointer;
}
.link-btn:disabled {
  color: var(--color-text-muted);
  text-decoration: none;
  cursor: wait;
}
.custom {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.25rem;
  padding-top: var(--space-xs);
  border-top: var(--border-hairline);
}
.custom-label {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
  font-size: 0.9rem;
}
.custom-name {
  color: var(--color-text-muted);
}
.slider {
  width: 100%;
  accent-color: var(--color-accent);
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
}
.actions .btn {
  margin-bottom: 0;
}
</style>
