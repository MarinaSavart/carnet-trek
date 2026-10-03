<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Difficulty } from '../types/trek'
import type { EtapeDraft, EtapeErrors } from '../utils/trekForm'
import { parseGpx } from '../utils/gpx'
import { DIFFICULTY_LABELS } from '../utils/difficulty'
import { getEtapeColor } from '../utils/etapeColors'
import { POI_ICONS } from '../utils/poi'
import PoiEditor from './PoiEditor.vue'
import TrackEditor from './TrackEditor.vue'
import type { GeoJSONLineString, POI } from '../types/trek'

defineProps<{
  index: number
  count: number
  errors?: EtapeErrors
  /** Traces des étapes voisines, affichées dans l'éditeur de trace */
  previousTrack?: GeoJSONLineString | null
  nextTrack?: GeoJSONLineString | null
}>()

const emit = defineEmits<{
  move: [direction: -1 | 1]
  remove: []
}>()

const etape = defineModel<EtapeDraft>({ required: true })

const DIFFICULTIES = Object.keys(DIFFICULTY_LABELS) as Difficulty[]

// Identifiants uniques pour relier chaque <label> à son champ
const fieldId = (name: string) => `etape-${etape.value.key}-${name}`

// --- Durée : saisie en heures + minutes, stockée en minutes ---

const durationHours = computed({
  get: () => (etape.value.durationMin === null ? null : Math.floor(etape.value.durationMin / 60)),
  set: (hours) => setDuration(hours, durationMinutes.value),
})
const durationMinutes = computed({
  get: () => (etape.value.durationMin === null ? null : etape.value.durationMin % 60),
  set: (minutes) => setDuration(durationHours.value, minutes),
})

function setDuration(hours: number | null | '', minutes: number | null | '') {
  const h = Number(hours) || 0
  const m = Number(minutes) || 0
  etape.value.durationMin = h === 0 && m === 0 ? null : h * 60 + m
}

// --- Trace GPX : lue dans le navigateur, elle pré-remplit les stats ---

const gpxError = ref<string | null>(null)
const isDraggingGpx = ref(false)

async function loadGpx(file: File | undefined) {
  if (!file) return
  gpxError.value = null
  if (!file.name.toLowerCase().endsWith('.gpx')) {
    gpxError.value = 'Le fichier doit être au format .gpx'
    return
  }
  await applyGpx(file)
}

async function applyGpx(file: File) {
  try {
    const gpx = parseGpx(await file.text(), etape.value.key)
    if (gpx.track.coordinates.length < 2) {
      gpxError.value = 'Ce fichier ne contient pas de tracé'
      return
    }
    Object.assign(etape.value, {
      gpxFile: file,
      gpx,
      // Une nouvelle trace remplace l'éventuelle trace actuelle
      existingGpxName: null,
      existingGpxUrl: null,
      track: gpx.track,
      // Les points du nouveau GPX remplacent les précédents (modifiables ensuite)
      pois: gpx.waypoints,
      poisEdited: false,
      distanceKm: gpx.distanceKm,
      elevationGain: gpx.elevationGain,
      elevationLoss: gpx.elevationLoss,
      durationMin: gpx.durationMin ?? etape.value.durationMin,
    })
    // Le nom du tracé sert de proposition si l'étape n'a pas encore de nom
    if (!etape.value.name.trim() && gpx.name) etape.value.name = gpx.name
  } catch {
    gpxError.value = 'Fichier GPX illisible'
  }
}

function removeGpx() {
  Object.assign(etape.value, {
    gpxFile: null,
    gpx: null,
    existingGpxName: null,
    existingGpxUrl: null,
    track: null,
    // Sans trace, le serveur effacerait les points : on les envoie pour les garder
    poisEdited: etape.value.pois.length > 0,
  })
}

// --- Trace : éditeur sur carte (création ou modification) ---

const isEditingTrack = ref(false)

// La trace éditée revient comme un nouveau fichier GPX : même traitement qu'un import
async function saveTrack({ file, durationMin }: { file: File; durationMin: number }) {
  isEditingTrack.value = false
  await applyGpx(file)
  // Plus d'horaires dans la trace modifiée : la durée devient l'estimation (modifiable)
  etape.value.durationMin = durationMin
}

// --- Points d'intérêt : éditeur sur carte ---

const isEditingPois = ref(false)

function savePois(pois: POI[]) {
  Object.assign(etape.value, { pois, poisEdited: true })
  isEditingPois.value = false
}

// Résumé par type : « 💧 3 · 🏠 1 »
const poiSummary = computed(() => {
  const counts = new Map<POI['type'], number>()
  for (const poi of etape.value.pois) counts.set(poi.type, (counts.get(poi.type) ?? 0) + 1)
  return [...counts].map(([type, count]) => `${POI_ICONS[type]} ${count}`).join(' · ')
})

function onGpxDrop(e: DragEvent) {
  isDraggingGpx.value = false
  loadGpx(e.dataTransfer?.files[0])
}

// --- Photos : aperçus locaux, en attendant l'envoi au serveur ---

const isDraggingPhotos = ref(false)

function addPhotos(files: FileList | null | undefined) {
  const images = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'))
  etape.value.photos.push(
    ...images.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) })),
  )
}

function removePhoto(id: string) {
  const photo = etape.value.photos.find((p) => p.id === id)
  if (photo) URL.revokeObjectURL(photo.url)
  etape.value.photos = etape.value.photos.filter((p) => p.id !== id)
}

// Modification : retire une photo déjà en ligne (supprimée à l'enregistrement)
function removeExistingPhoto(id: string) {
  etape.value.existingPhotos = etape.value.existingPhotos.filter((p) => p.id !== id)
}

function onPhotosDrop(e: DragEvent) {
  isDraggingPhotos.value = false
  addPhotos(e.dataTransfer?.files)
}
</script>

<template>
  <fieldset class="etape-card" :style="{ '--etape-color': getEtapeColor(index) }">
    <legend class="etape-legend">
      <span class="etape-number">{{ index + 1 }}</span>
      <span>{{ etape.name.trim() || `Étape ${index + 1}` }}</span>
    </legend>

    <div class="card-actions">
      <button
        type="button"
        class="btn btn-icon"
        :disabled="index === 0"
        :aria-label="`Monter l'étape ${index + 1}`"
        @click="emit('move', -1)"
      >
        ↑
      </button>
      <button
        type="button"
        class="btn btn-icon"
        :disabled="index === count - 1"
        :aria-label="`Descendre l'étape ${index + 1}`"
        @click="emit('move', 1)"
      >
        ↓
      </button>
      <button
        type="button"
        class="btn btn-icon"
        :disabled="count === 1"
        :aria-label="`Supprimer l'étape ${index + 1}`"
        @click="emit('remove')"
      >
        ✕
      </button>
    </div>

    <div class="grid">
      <div class="field span-2">
        <label :for="fieldId('name')" class="field-label">Nom de l'étape *</label>
        <input
          :id="fieldId('name')"
          v-model="etape.name"
          class="input"
          placeholder="Ex. Landmannalaugar → Hrafntinnusker"
          :aria-invalid="Boolean(errors?.name)"
        />
        <p v-if="errors?.name" class="field-error">{{ errors.name }}</p>
      </div>

      <div class="field span-2">
        <label :for="fieldId('description')" class="field-label">
          Description <span class="field-hint">(facultatif)</span>
        </label>
        <textarea
          :id="fieldId('description')"
          v-model="etape.description"
          class="textarea"
          placeholder="Terrain, points forts, conseils…"
        />
      </div>

      <div class="field">
        <label :for="fieldId('difficulty')" class="field-label">Difficulté</label>
        <select :id="fieldId('difficulty')" v-model="etape.difficulty" class="select">
          <option v-for="d in DIFFICULTIES" :key="d" :value="d">{{ DIFFICULTY_LABELS[d] }}</option>
        </select>
      </div>

      <!-- Trace GPX -->
      <div class="field span-2">
        <span class="field-label">
          Trace GPX
          <span class="field-hint"
            >— remplit automatiquement les stats et les points d'intérêt</span
          >
        </span>
        <div v-if="etape.gpx" class="gpx-loaded">
          <span class="gpx-name">✓ {{ etape.gpxFile?.name }}</span>
          <span class="field-hint">
            {{ etape.gpx.waypoints.length }} point{{ etape.gpx.waypoints.length > 1 ? 's' : '' }}
            d'intérêt
          </span>
          <button type="button" class="btn" @click="removeGpx">Retirer</button>
        </div>
        <!-- Modification : trace déjà enregistrée -->
        <div v-else-if="etape.existingGpxName" class="gpx-loaded">
          <span class="gpx-name">✓ {{ etape.existingGpxName }}</span>
          <span class="field-hint">trace actuelle</span>
          <div class="gpx-actions">
            <label class="btn">
              Remplacer
              <input
                type="file"
                accept=".gpx,application/gpx+xml"
                class="visually-hidden"
                @change="loadGpx(($event.target as HTMLInputElement).files?.[0])"
              />
            </label>
            <button type="button" class="btn" @click="removeGpx">Retirer</button>
          </div>
        </div>
        <label
          v-else
          class="dropzone"
          :class="{ 'is-dragging': isDraggingGpx }"
          @dragover.prevent="isDraggingGpx = true"
          @dragleave="isDraggingGpx = false"
          @drop.prevent="onGpxDrop"
        >
          <input
            type="file"
            accept=".gpx,application/gpx+xml"
            class="visually-hidden"
            @change="loadGpx(($event.target as HTMLInputElement).files?.[0])"
          />
          <span><strong>Choisir un fichier .gpx</strong> ou le glisser ici</span>
        </label>
        <p v-if="gpxError" class="field-error">{{ gpxError }}</p>
        <button type="button" class="btn track-edit-btn" @click="isEditingTrack = true">
          {{ etape.track ? 'Éditer la trace sur la carte' : 'Tracer sur la carte' }}
        </button>
      </div>
      <TrackEditor
        v-if="isEditingTrack"
        :title="etape.name.trim() || `Étape ${index + 1}`"
        :gpx-file="etape.gpxFile"
        :gpx-url="etape.gpxFile ? null : etape.existingGpxUrl"
        :fallback-track="etape.track"
        :pois="etape.pois"
        :previous-track="previousTrack ?? null"
        :next-track="nextTrack ?? null"
        @save="saveTrack"
        @close="isEditingTrack = false"
      />

      <!-- Points d'intérêt -->
      <div class="field span-2">
        <span class="field-label">
          Points d'intérêt
          <span class="field-hint">— eau, refuges, sommets, ravitaillement…</span>
        </span>
        <div class="pois-summary">
          <span v-if="etape.pois.length">
            {{ etape.pois.length }} point{{ etape.pois.length > 1 ? 's' : '' }}
            <span class="field-hint">{{ poiSummary }}</span>
          </span>
          <span v-else class="field-hint">Aucun point</span>
          <span v-if="etape.poisEdited" class="field-hint">· modifiés</span>
          <button type="button" class="btn" @click="isEditingPois = true">
            Éditer sur la carte
          </button>
        </div>
      </div>
      <PoiEditor
        v-if="isEditingPois"
        :title="etape.name.trim() || `Étape ${index + 1}`"
        :track="etape.track"
        :pois="etape.pois"
        @save="savePois"
        @close="isEditingPois = false"
      />

      <!-- Stats : pré-remplies par le GPX, modifiables -->
      <div class="field">
        <label :for="fieldId('distance')" class="field-label">Distance (km) *</label>
        <input
          :id="fieldId('distance')"
          v-model.number="etape.distanceKm"
          type="number"
          min="0"
          step="0.1"
          inputmode="decimal"
          class="input"
          :aria-invalid="Boolean(errors?.distanceKm)"
        />
        <p v-if="errors?.distanceKm" class="field-error">{{ errors.distanceKm }}</p>
      </div>

      <div class="field">
        <span :id="fieldId('duration-label')" class="field-label">Durée *</span>
        <div class="duration" role="group" :aria-labelledby="fieldId('duration-label')">
          <input
            v-model.number="durationHours"
            type="number"
            min="0"
            inputmode="numeric"
            class="input"
            aria-label="Heures"
            :aria-invalid="Boolean(errors?.durationMin)"
          />
          <span>h</span>
          <input
            v-model.number="durationMinutes"
            type="number"
            min="0"
            max="59"
            inputmode="numeric"
            class="input"
            aria-label="Minutes"
            :aria-invalid="Boolean(errors?.durationMin)"
          />
          <span>min</span>
        </div>
        <p v-if="errors?.durationMin" class="field-error">{{ errors.durationMin }}</p>
      </div>

      <div class="field">
        <label :for="fieldId('gain')" class="field-label">Dénivelé + (m)</label>
        <input
          :id="fieldId('gain')"
          v-model.number="etape.elevationGain"
          type="number"
          min="0"
          inputmode="numeric"
          class="input"
        />
      </div>

      <div class="field">
        <label :for="fieldId('loss')" class="field-label">Dénivelé − (m)</label>
        <input
          :id="fieldId('loss')"
          v-model.number="etape.elevationLoss"
          type="number"
          min="0"
          inputmode="numeric"
          class="input"
        />
      </div>

      <!-- Photos -->
      <div class="field span-2">
        <span class="field-label"> Photos <span class="field-hint">(facultatif)</span> </span>
        <ul v-if="etape.existingPhotos.length || etape.photos.length" class="photos">
          <li v-for="photo in etape.existingPhotos" :key="photo.id" class="photo">
            <img :src="photo.url" :alt="photo.name" class="photo-image" />
            <button
              type="button"
              class="photo-remove"
              :aria-label="`Retirer ${photo.name}`"
              @click="removeExistingPhoto(photo.id)"
            >
              ✕
            </button>
          </li>
          <li v-for="photo in etape.photos" :key="photo.id" class="photo is-new">
            <img :src="photo.url" :alt="photo.file.name" class="photo-image" />
            <button
              type="button"
              class="photo-remove"
              :aria-label="`Retirer ${photo.file.name}`"
              @click="removePhoto(photo.id)"
            >
              ✕
            </button>
          </li>
        </ul>
        <label
          class="dropzone"
          :class="{ 'is-dragging': isDraggingPhotos }"
          @dragover.prevent="isDraggingPhotos = true"
          @dragleave="isDraggingPhotos = false"
          @drop.prevent="onPhotosDrop"
        >
          <input
            type="file"
            accept="image/*"
            multiple
            class="visually-hidden"
            @change="addPhotos(($event.target as HTMLInputElement).files)"
          />
          <span><strong>Ajouter des photos</strong> ou les glisser ici</span>
        </label>
      </div>
    </div>
  </fieldset>
</template>

<style scoped>
.etape-card {
  position: relative;
  margin: 0;
  padding: var(--space-md) var(--space-md) var(--space-md);
  border: var(--border-hairline);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.etape-legend {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 0 var(--space-xs);
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 700;
}
.etape-number {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: var(--etape-color);
  color: #fff;
  font-family: var(--font-body);
  font-size: 0.85rem;
}
.card-actions {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-sm);
  display: flex;
  gap: 0.25rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
  margin-top: var(--space-xs);
}
.span-2 {
  grid-column: span 2;
}
@media (max-width: 520px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .span-2 {
    grid-column: auto;
  }
}
.duration {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--color-text-muted);
}
.duration .input {
  min-width: 0;
}
.gpx-loaded {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs) var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border: var(--border-hairline);
  border-radius: var(--radius);
}
.track-edit-btn {
  align-self: flex-start;
  margin-top: var(--space-xs);
}
.pois-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs) var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border: var(--border-hairline);
  border-radius: var(--radius);
}
.pois-summary > .btn {
  margin-left: auto;
}
.gpx-name {
  font-weight: 600;
  word-break: break-all;
}
.gpx-loaded > .btn,
.gpx-actions {
  margin-left: auto;
}
.gpx-actions {
  display: flex;
  gap: var(--space-xs);
}
.gpx-actions label.btn:focus-within {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.photos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: var(--space-xs);
  list-style: none;
  padding: 0;
  margin: 0;
}
.photo {
  position: relative;
  aspect-ratio: 4 / 3;
}
/* Photo ajoutée, pas encore envoyée : la distingue de celles déjà en ligne */
.photo.is-new::after {
  content: 'Nouvelle';
  position: absolute;
  left: 4px;
  bottom: 4px;
  padding: 0.05rem 0.4rem;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: 0.65rem;
  font-weight: 700;
}
.photo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius);
  display: block;
}
.photo-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(28, 40, 35, 0.8);
  color: #fff;
  font-size: 0.7rem;
  cursor: pointer;
}
.photo-remove:hover,
.photo-remove:focus-visible {
  background: var(--color-danger);
  color: var(--color-on-accent);
}
</style>
