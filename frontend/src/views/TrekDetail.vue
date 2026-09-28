<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTreksStore } from '../stores/treks'
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

const trek = computed(() => store.getTrekById(route.params.id as string))

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
const mapCursor = ref<[number, number] | null>(null)

function onProfileHover(value: ProfileHover | null) {
  highlightedId.value = value?.segmentId ?? null
  mapCursor.value = value?.coordinates ?? null
}

function openEtape(etapeId: string) {
  router.push(`/etapes/${etapeId}`)
}
</script>

<template>
  <div v-if="trek" class="page">
    <header class="header">
      <RouterLink to="/" class="back-link">← Treks</RouterLink>
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
          <RouterLink :to="`/etapes/${etape._id}`" class="etape-link">
            <div class="etape-heading">
              <h2 class="etape-title">
                <span class="etape-order">#{{ etape.order }}</span>
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
        @select="openEtape"
      />
    </aside>
  </div>
  <p v-else>Trek introuvable</p>
</template>

<style scoped>
.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
}
.back-link {
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.9rem;
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
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md) var(--space-lg);
  margin: var(--space-md) 0 var(--space-lg);
}
.total dt {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.total dd {
  margin: 0.25rem 0 0;
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
  border-radius: var(--radius);
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
  list-style: none;
  padding: 0;
  margin: 0;
}
.etape-item {
  border-bottom: var(--border-hairline);
  border-left: 3px solid var(--etape-color);
  transition: background-color 0.15s ease;
}
.etape-item.is-highlighted {
  background: var(--color-surface);
}
.etape-link {
  display: block;
  padding: var(--space-sm) var(--space-sm);
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
  font-size: 1.4rem;
  line-height: 1.2;
}
.etape-order {
  color: var(--etape-color);
  filter: brightness(1.4);
  margin-right: 0.25rem;
}
.etape-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem var(--space-sm);
  margin: var(--space-xs) 0 0;
  font-size: 0.9rem;
}
.etape-pois {
  display: flex;
  gap: var(--space-sm);
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin: 0.25rem 0 0;
}
</style>
