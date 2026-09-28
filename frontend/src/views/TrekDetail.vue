<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTreksStore } from '../stores/treks'
import { useAuthStore } from '../stores/auth'
import { useTrek } from '../composables/useTrek'
import DifficultyBadge from '../components/DifficultyBadge.vue'
import TrekOverviewMap from '../components/TrekOverviewMap.vue'
import PhotoGallery from '../components/PhotoGallery.vue'
import ElevationProfile, {
  type ProfileHover,
  type ProfileSegment,
} from '../components/ElevationProfile.vue'
import type { GalleryPhoto } from '../types/trek'
import { formatDuration } from '../utils/format'
import { getEtapeColor } from '../utils/etapeColors'

const route = useRoute()
const router = useRouter()
const store = useTreksStore()
const auth = useAuthStore()

const { trek, error } = useTrek(() => route.params.id as string)

const etapes = computed(() => [...(trek.value?.etapes ?? [])].sort((a, b) => a.order - b.order))

const totals = computed(() =>
  etapes.value.reduce(
    (acc, e) => ({
      distanceKm: acc.distanceKm + e.distanceKm,
      elevationGain: acc.elevationGain + e.elevationGain,
      elevationLoss: acc.elevationLoss + e.elevationLoss,
      durationMin: acc.durationMin + e.durationMin,
    }),
    { distanceKm: 0, elevationGain: 0, elevationLoss: 0, durationMin: 0 },
  ),
)

// Toutes les photos du trek, dans l'ordre des étapes, avec le nom de l'étape en légende
const photos = computed<GalleryPhoto[]>(() =>
  etapes.value.flatMap((etape) =>
    (etape.photos ?? []).map((photo) => ({ ...photo, label: etape.name })),
  ),
)

// Profil d'altitude du trek : les étapes à la suite, chacune dans sa couleur
const profileSegments = computed<ProfileSegment[]>(() =>
  etapes.value.flatMap((etape, index) =>
    etape.elevationProfile?.length
      ? [
          {
            id: etape._id,
            label: `Étape ${etape.order}`,
            color: getEtapeColor(index),
            points: etape.elevationProfile,
          },
        ]
      : [],
  ),
)

// Étape survolée, dans la liste, sur la carte ou sur le profil : mise en avant partout
const highlightedId = ref<string | null>(null)
// Position commune au profil et à la carte, quel que soit celui qu'on survole
const mapCursor = ref<[number, number] | null>(null)
const profileCursor = ref<ProfileHover | null>(null)

function onProfileHover(value: ProfileHover | null) {
  highlightedId.value = value?.segmentId ?? null
  mapCursor.value = value?.coordinates ?? null
}

function onTrackHover(value: ProfileHover | null) {
  profileCursor.value = value
  mapCursor.value = value?.coordinates ?? null
}

const isDeleting = ref(false)

async function removeTrek() {
  if (!trek.value) return
  const message = `Supprimer « ${trek.value.name} », ses étapes, traces et photos ? C'est définitif.`
  if (!window.confirm(message)) return
  isDeleting.value = true
  try {
    await store.deleteTrek(trek.value._id)
    router.push('/')
  } catch (e) {
    window.alert(e instanceof Error ? e.message : 'Suppression impossible')
    isDeleting.value = false
  }
}

function openEtape(etapeId: string) {
  router.push(`/treks/${trek.value?._id}/etapes/${etapeId}`)
}
</script>

<template>
  <div v-if="trek" class="page">
    <header class="header">
      <div class="header-top">
        <RouterLink to="/" class="back-link">← Treks</RouterLink>
        <button
          v-if="auth.canEdit(trek)"
          type="button"
          class="btn"
          :disabled="isDeleting"
          @click="removeTrek"
        >
          {{ isDeleting ? 'Suppression…' : 'Supprimer' }}
        </button>
      </div>
      <h1>{{ trek.name }}</h1>
      <p class="region">{{ trek.region }}</p>
      <p class="description">{{ trek.description }}</p>

      <PhotoGallery :photos="photos" />

      <dl class="totals">
        <div class="total">
          <dt>Distance</dt>
          <dd class="stat-number">
            {{ totals.distanceKm.toFixed(1) }}<span class="stat-unit">km</span>
          </dd>
        </div>
        <div class="total">
          <dt>Dénivelé +</dt>
          <dd class="stat-number">{{ totals.elevationGain }}<span class="stat-unit">m</span></dd>
        </div>
        <div class="total">
          <dt>Dénivelé −</dt>
          <dd class="stat-number">{{ totals.elevationLoss }}<span class="stat-unit">m</span></dd>
        </div>
        <div class="total">
          <dt>Durée</dt>
          <dd class="stat-number">{{ formatDuration(totals.durationMin) }}</dd>
        </div>
        <div class="total">
          <dt>Étapes</dt>
          <dd class="stat-number">{{ etapes.length }}</dd>
        </div>
      </dl>

      <ElevationProfile
        :segments="profileSegments"
        :highlighted-id="highlightedId"
        :cursor="profileCursor"
        @hover="onProfileHover"
      />
    </header>

    <section class="etapes-column" aria-label="Étapes">
      <ol class="etapes">
        <li
          v-for="(etape, index) in etapes"
          :key="etape._id"
          class="etape-item"
          :class="{ 'is-highlighted': highlightedId === etape._id }"
          :style="{ '--etape-color': getEtapeColor(index) }"
          @mouseenter="highlightedId = etape._id"
          @mouseleave="highlightedId = null"
        >
          <RouterLink :to="`/treks/${trek._id}/etapes/${etape._id}`" class="etape-link">
            <div class="etape-heading">
              <h2 class="etape-title">
                <span class="etape-order" aria-hidden="true">{{ etape.order }}</span>
                <span class="visually-hidden">Étape {{ etape.order }} :</span>
                {{ etape.name }}
              </h2>
              <DifficultyBadge :difficulty="etape.difficulty" />
            </div>
            <p class="etape-meta">
              <span title="Distance">↔ {{ etape.distanceKm }} km</span>
              <span title="Durée">⏱︎ {{ formatDuration(etape.durationMin) }}</span>
              <span title="Dénivelé positif">↗ {{ etape.elevationGain }} m</span>
              <span title="Dénivelé négatif">↘ {{ etape.elevationLoss }} m</span>
            </p>
            <p v-if="etape.pois.length || etape.photos?.length" class="etape-pois">
              <span v-if="etape.pois.length">
                {{ etape.pois.length }} point{{ etape.pois.length > 1 ? 's' : '' }} d'intérêt
              </span>
              <span v-if="etape.photos?.length">
                {{ etape.photos.length }} photo{{ etape.photos.length > 1 ? 's' : '' }}
              </span>
            </p>
          </RouterLink>
        </li>
      </ol>
    </section>

    <aside class="map-column">
      <TrekOverviewMap
        :etapes="etapes"
        :highlighted-id="highlightedId"
        :cursor="mapCursor"
        @hover="highlightedId = $event"
        @track-hover="onTrackHover"
        @select="openEtape"
      />
    </aside>
  </div>
  <div v-else class="page-status">
    <RouterLink to="/" class="back-link">← Treks</RouterLink>
    <p :role="error ? 'alert' : 'status'">{{ error ?? 'Chargement…' }}</p>
  </div>
</template>

<style scoped>
.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
}
.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}
.page-status {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
  color: var(--color-text-muted);
}
.header h1 {
  margin-top: var(--space-xs);
}
.region {
  color: var(--color-accent);
  margin: 0.25rem 0 0;
}
.description {
  color: var(--color-text-muted);
  max-width: 65ch;
}
.totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  gap: var(--space-md);
  margin: var(--space-md) 0 var(--space-md);
  padding: var(--space-md);
  border: var(--border-hairline);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}
.total dt {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.total dd {
  margin: 0.25rem 0 0;
  font-size: 2.1rem;
  white-space: nowrap;
}
.stat-unit {
  font-family: var(--font-body);
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin-left: 0.25rem;
}

/* Mobile : en-tête, carte, puis liste des étapes */
.page {
  display: grid;
  /* minmax(0, 1fr) : la colonne ne s'élargit jamais au-delà de l'écran à cause d'un contenu */
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: 'header' 'map' 'etapes';
  gap: var(--space-md);
}
.header {
  grid-area: header;
}
.etapes-column {
  grid-area: etapes;
}
.map-column {
  grid-area: map;
  height: 360px;
  border: var(--border-hairline);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}

/* Desktop : en-tête et étapes à gauche, carte fixe à droite sur toute la hauteur */
@media (min-width: 960px) {
  .page {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    grid-template-rows: auto 1fr;
    grid-template-areas: 'header map' 'etapes map';
    gap: 0 var(--space-lg);
  }
  .map-column {
    align-self: start;
    position: sticky;
    top: var(--space-md);
    height: calc(100vh - 2 * var(--space-md));
  }
}

.etapes {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  list-style: none;
  padding: 0;
  margin: 0;
}
.etape-item {
  border: var(--border-hairline);
  border-radius: var(--radius);
  background: var(--color-surface);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    translate 0.2s ease;
}
.etape-item.is-highlighted {
  border-color: color-mix(in srgb, var(--etape-color) 60%, transparent);
  background: var(--color-surface-raised);
  translate: 3px 0;
}
.etape-link {
  display: block;
  padding: var(--space-sm);
  text-decoration: none;
  color: inherit;
}
.etape-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
}
.etape-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.4rem;
  line-height: 1.2;
}
/* Pastille numérotée, identique aux marqueurs de la carte */
.etape-order {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: var(--etape-color);
  box-shadow: 0 0 0 2px var(--color-surface);
  color: #fff;
  font-family: var(--font-body);
  font-size: 0.85rem;
}
.etape-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem var(--space-sm);
  margin: var(--space-xs) 0 0;
  padding-left: 2.35rem;
  font-size: 0.9rem;
}
.etape-pois {
  display: flex;
  gap: var(--space-sm);
  padding-left: 2.35rem;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin: 0.25rem 0 0;
}
</style>
