<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import TreksMap from '../components/TreksMap.vue'
import { useTreksStore, type MapView } from '../stores/treks'
import type { TrekSummary } from '../types/trek'
import { getEtapeColor } from '../utils/etapeColors'
import { formatDuration } from '../utils/format'
import { bboxIntersects, distanceToTrackKm, trackBBox, type BBox } from '../utils/geo'

const router = useRouter()
const store = useTreksStore()
const { summaries, homeMapView } = storeToRefs(store)

// Au retour sur la liste, on affiche tout de suite l'ancienne version pendant le rechargement
const isLoading = ref(summaries.value.length === 0)
const error = ref<string | null>(null)
const highlightedId = ref<string | null>(null)
const map = ref<InstanceType<typeof TreksMap> | null>(null)
// Vue restaurée lue une seule fois : la carte gère ensuite sa propre position
const initialView = homeMapView.value
const visibleBounds = ref<BBox | null>(null)

async function load() {
  error.value = null
  try {
    await store.loadSummaries()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur de chargement'
  } finally {
    isLoading.value = false
  }
}

onMounted(load)

// Une couleur par trek, identique sur la carte et dans la liste
const colors = computed(() =>
  Object.fromEntries(summaries.value.map((trek, index) => [trek._id, getEtapeColor(index)])),
)

interface PlacedTrek {
  trek: TrekSummary
  /** Distance au centre de la carte ; null sans tracé */
  distanceKm: number | null
}

// Propositions façon appli de rando : les treks de la zone affichée d'abord (du plus proche
// du centre au plus éloigné), puis les autres, toujours par distance
const placed = computed(() => {
  const view = homeMapView.value
  const bounds = visibleBounds.value
  const nearby: PlacedTrek[] = []
  const elsewhere: PlacedTrek[] = []

  for (const trek of summaries.value) {
    if (!trek.track || !view || !bounds) {
      elsewhere.push({ trek, distanceKm: null })
      continue
    }
    const item = { trek, distanceKm: distanceToTrackKm(view.center, trek.track) }
    ;(bboxIntersects(trackBBox(trek.track), bounds) ? nearby : elsewhere).push(item)
  }
  const byDistance = (a: PlacedTrek, b: PlacedTrek) =>
    (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
  return { nearby: nearby.sort(byDistance), elsewhere: elsewhere.sort(byDistance) }
})

// En vue large (pays, continent), la distance au centre de la carte ne veut rien dire
const showDistance = computed(() => (homeMapView.value?.zoom ?? 0) >= 6)

// Tant que la carte n'a pas donné sa zone, pas de découpage : liste simple
const hasView = computed(() => visibleBounds.value !== null)

function onViewChange({ bounds, ...view }: MapView & { bounds: BBox }) {
  visibleBounds.value = bounds
  homeMapView.value = view
}

function formatDistance(km: number): string {
  if (km < 1) return 'sur place'
  return `à ${km < 10 ? km.toFixed(1) : Math.round(km)} km`
}
</script>

<template>
  <div class="page">
    <div class="heading">
      <h1>Mes treks</h1>
      <RouterLink to="/treks/new" class="btn btn-primary">+ Nouveau trek</RouterLink>
    </div>

    <div class="list-column">
      <p v-if="isLoading" class="status" role="status">Chargement…</p>

      <div v-else-if="error" class="status" role="alert">
        <p>{{ error }}</p>
        <button type="button" class="btn" @click="load">Réessayer</button>
      </div>

      <div v-else-if="!summaries.length" class="status">
        <p>Aucun trek pour l'instant.</p>
        <RouterLink to="/treks/new" class="btn">Créer mon premier trek</RouterLink>
      </div>

      <template v-else>
        <section v-if="hasView" class="group" aria-labelledby="nearby-title">
          <h2 id="nearby-title" class="group-title">
            Dans cette zone <span class="count">{{ placed.nearby.length }}</span>
          </h2>
          <div v-if="!placed.nearby.length" class="status">
            <p>Aucun trek dans la zone affichée.</p>
            <button type="button" class="btn" @click="map?.fitAll()">Voir tous les treks</button>
          </div>
        </section>

        <ul class="treks" :aria-labelledby="hasView ? 'nearby-title' : undefined">
          <li
            v-for="{ trek, distanceKm } in hasView ? placed.nearby : placed.elsewhere"
            :key="trek._id"
            class="trek-item"
            :class="{ 'is-highlighted': highlightedId === trek._id }"
            :style="{ '--trek-color': colors[trek._id] }"
            @mouseenter="highlightedId = trek._id"
            @mouseleave="highlightedId = null"
          >
            <RouterLink :to="`/treks/${trek._id}`" class="trek-link">
              <img
                v-if="trek.coverPhotoUrl"
                :src="trek.coverPhotoUrl"
                alt=""
                loading="lazy"
                class="cover"
              />
              <div v-else class="cover cover-empty" aria-hidden="true">⛰</div>
              <div class="trek-info">
                <h3>{{ trek.name }}</h3>
                <p v-if="trek.region || (showDistance && distanceKm !== null)" class="region">
                  {{ trek.region }}
                  <template v-if="showDistance && distanceKm !== null">
                    <span v-if="trek.region" aria-hidden="true"> · </span>
                    <span class="distance">{{ formatDistance(distanceKm) }}</span>
                  </template>
                </p>
                <p class="stat-number">
                  {{ trek.distanceKm.toFixed(1) }}
                  <span class="stat-unit">
                    km · {{ trek.etapeCount }} étape{{ trek.etapeCount > 1 ? 's' : '' }} ·
                    {{ formatDuration(trek.durationMin) }}
                  </span>
                </p>
              </div>
            </RouterLink>
          </li>
        </ul>

        <section
          v-if="hasView && placed.elsewhere.length"
          class="group"
          aria-labelledby="elsewhere-title"
        >
          <h2 id="elsewhere-title" class="group-title">
            Plus loin <span class="count">{{ placed.elsewhere.length }}</span>
          </h2>
          <ul class="treks treks-compact">
            <li
              v-for="{ trek, distanceKm } in placed.elsewhere"
              :key="trek._id"
              class="trek-item"
              :class="{ 'is-highlighted': highlightedId === trek._id }"
              :style="{ '--trek-color': colors[trek._id] }"
              @mouseenter="highlightedId = trek._id"
              @mouseleave="highlightedId = null"
            >
              <RouterLink :to="`/treks/${trek._id}`" class="trek-link">
                <span class="color-dot" aria-hidden="true" />
                <span class="compact-name">{{ trek.name }}</span>
                <span class="compact-meta">
                  {{ distanceKm === null ? 'sans tracé' : formatDistance(distanceKm) }}
                </span>
              </RouterLink>
            </li>
          </ul>
        </section>
      </template>
    </div>

    <aside class="map-column" aria-label="Carte des treks">
      <TreksMap
        ref="map"
        :treks="summaries"
        :colors="colors"
        :highlighted-id="highlightedId"
        :initial-view="initialView"
        @hover="highlightedId = $event"
        @select="router.push(`/treks/${$event}`)"
        @view-change="onViewChange"
      />
    </aside>
  </div>
</template>

<style scoped>
.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
  /* Même largeur de carte que sur la page d'un trek */
  --map-width: clamp(420px, 48vw, 640px);

  /* Mobile : carte en haut, liste en dessous */
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: 'heading' 'map' 'list';
  gap: var(--space-md);
}
.heading {
  grid-area: heading;
}
.list-column {
  grid-area: list;
}
/* L'écart entre la carte et la liste est déjà donné par la grille */
.list-column > :first-child {
  margin-top: 0;
}
.map-column {
  grid-area: map;
  height: 55vh;
  min-height: 320px;
  border: var(--border-hairline);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}

/* Desktop : liste à gauche, carte fixe à droite (voir TrekDetail.vue) */
@media (min-width: 960px) {
  .page {
    display: block;
  }
  .heading,
  .list-column {
    margin-right: calc(var(--map-width) + var(--space-lg));
  }
  .list-column {
    margin-top: var(--space-md);
  }
  .map-column {
    position: fixed;
    top: calc(var(--navbar-height) + var(--space-md));
    right: max(var(--space-md), calc((100vw - 1200px) / 2 + var(--space-md)));
    width: var(--map-width);
    height: calc(100vh - var(--navbar-height) - 2 * var(--space-md));
  }
}

.heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}
.status {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-sm);
  margin-top: var(--space-md);
  color: var(--color-text-muted);
}
.status p {
  margin: 0;
}
.group {
  margin-top: var(--space-lg);
}
.group-title {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  font-size: 1.5rem;
}
.count {
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 400;
}
.treks {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  list-style: none;
  padding: 0;
  margin: var(--space-sm) 0 0;
}
.trek-item {
  --trek-color: var(--color-accent);
  border: var(--border-hairline);
  /* Liseré à la couleur du tracé sur la carte */
  border-left: 4px solid var(--trek-color);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  transition:
    translate 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}
.trek-item:hover,
.trek-item:focus-within,
.trek-item.is-highlighted {
  translate: 0 -2px;
  border-color: color-mix(in srgb, var(--trek-color) 60%, transparent);
  border-left-color: var(--trek-color);
  box-shadow: var(--shadow-soft);
}
.trek-link {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm);
  border-radius: inherit;
  text-decoration: none;
  color: inherit;
}
.trek-link:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.cover {
  flex-shrink: 0;
  width: 120px;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius);
  object-fit: cover;
}
.cover-empty {
  display: grid;
  place-items: center;
  background: var(--color-bg-deep);
  color: var(--color-text-muted);
  font-size: 1.75rem;
}
.trek-info {
  min-width: 0;
}
.trek-info h3 {
  font-size: 1.5rem;
  line-height: 1.15;
}
.trek-info .stat-number {
  margin: var(--space-xs) 0 0;
  font-size: 1.8rem;
}
.region {
  color: var(--color-text-muted);
  margin: 0.2rem 0 0;
  font-size: 0.9rem;
}
.distance {
  color: var(--color-accent);
  white-space: nowrap;
}
.stat-unit {
  font-family: var(--font-body);
  font-size: 0.95rem;
  color: var(--color-text-muted);
  margin-left: var(--space-xs);
}

/* « Plus loin » : simple liste nom + distance */
.treks-compact {
  gap: var(--space-xs);
}
.treks-compact .trek-item {
  border-radius: var(--radius);
  box-shadow: none;
}
.treks-compact .trek-link {
  gap: var(--space-sm);
  padding: 0.6rem var(--space-sm);
}
.color-dot {
  flex-shrink: 0;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: var(--trek-color);
}
.compact-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.compact-meta {
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
@media (max-width: 480px) {
  .cover {
    width: 80px;
  }
}
</style>
