<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTrek } from '../composables/useTrek'
import DifficultyBadge from '../components/DifficultyBadge.vue'
import TrekOverviewMap from '../components/TrekOverviewMap.vue'
import PhotoGallery from '../components/PhotoGallery.vue'
import ElevationProfile, {
  type ProfileHover,
  type ProfileSegment,
} from '../components/ElevationProfile.vue'
import { formatDuration } from '../utils/format'
import { getEtapeColor } from '../utils/etapeColors'
import { POI_ICONS } from '../utils/poi'

const route = useRoute()
const router = useRouter()
const { trek, error } = useTrek(() => route.params.trekId as string)
const etape = computed(() => trek.value?.etapes.find((e) => e._id === route.params.etapeId))

// Toutes les étapes du trek, pour la carte et la navigation précédente / suivante
const etapes = computed(() => [...(trek.value?.etapes ?? [])].sort((a, b) => a.order - b.order))
const index = computed(() => etapes.value.findIndex((e) => e._id === etape.value?._id))
const previous = computed(() => etapes.value[index.value - 1])
const next = computed(() => etapes.value[index.value + 1])

const profileSegments = computed<ProfileSegment[]>(() =>
  etape.value?.elevationProfile?.length
    ? [
        {
          id: etape.value._id,
          label: etape.value.name,
          color: getEtapeColor(index.value),
          points: etape.value.elevationProfile,
        },
      ]
    : [],
)
// Position commune au profil et à la carte, quel que soit celui qu'on survole
const mapCursor = ref<[number, number] | null>(null)
const profileCursor = ref<ProfileHover | null>(null)

// Seul le tracé de l'étape affichée a un profil ici : on ignore les étapes voisines
function onTrackHover(value: ProfileHover | null) {
  const isCurrent = value?.segmentId === etape.value?._id
  profileCursor.value = isCurrent ? value : null
  mapCursor.value = isCurrent ? (value?.coordinates ?? null) : null
}

const highlightedEtapeId = ref<string | null>(null)
const highlightedPoiId = ref<string | null>(null)

function openEtape(etapeId: string) {
  router.push(`/treks/${trek.value?._id}/etapes/${etapeId}`)
}
</script>

<template>
  <div v-if="etape" class="page" :style="{ '--etape-color': getEtapeColor(index) }">
    <header class="header">
      <RouterLink :to="trek ? `/treks/${trek._id}` : '/'" class="back-link">
        ← {{ trek?.name ?? 'Treks' }}
      </RouterLink>

      <p class="eyebrow">
        <span class="etape-order" aria-hidden="true">{{ etape.order }}</span>
        Étape {{ index + 1 }} sur {{ etapes.length }}
      </p>
      <div class="title-row">
        <h1>{{ etape.name }}</h1>
        <DifficultyBadge :difficulty="etape.difficulty" />
      </div>
      <p v-if="etape.description" class="description">{{ etape.description }}</p>

      <PhotoGallery :photos="etape.photos ?? []" />

      <dl class="stats">
        <div class="stat">
          <dt>Distance</dt>
          <dd class="stat-number">{{ etape.distanceKm }}<span class="stat-unit">km</span></dd>
        </div>
        <div class="stat">
          <dt>Dénivelé +</dt>
          <dd class="stat-number">{{ etape.elevationGain }}<span class="stat-unit">m</span></dd>
        </div>
        <div class="stat">
          <dt>Dénivelé −</dt>
          <dd class="stat-number">{{ etape.elevationLoss }}<span class="stat-unit">m</span></dd>
        </div>
        <div class="stat">
          <dt>Durée</dt>
          <dd class="stat-number">{{ formatDuration(etape.durationMin) }}</dd>
        </div>
      </dl>

      <ElevationProfile
        :segments="profileSegments"
        :cursor="profileCursor"
        @hover="mapCursor = $event?.coordinates ?? null"
      />
    </header>

    <section class="content">
      <h2>Points d'intérêt</h2>
      <ul v-if="etape.pois.length" class="pois">
        <li
          v-for="poi in etape.pois"
          :key="poi._id"
          class="poi-item"
          :class="{ 'is-highlighted': highlightedPoiId === poi._id }"
          @mouseenter="highlightedPoiId = poi._id"
          @mouseleave="highlightedPoiId = null"
        >
          <span class="poi-icon">{{ POI_ICONS[poi.type] }}</span>
          <div>
            <strong>{{ poi.name }}</strong>
            <p v-if="poi.notes" class="poi-notes">{{ poi.notes }}</p>
          </div>
        </li>
      </ul>
      <p v-else class="empty">Aucun point d'intérêt pour cette étape.</p>

      <nav v-if="previous || next" class="etape-nav" aria-label="Étapes voisines">
        <RouterLink
          v-if="previous"
          :to="`/treks/${trek?._id}/etapes/${previous._id}`"
          class="etape-nav-link"
        >
          <span class="etape-nav-label">← Étape précédente</span>
          {{ previous.name }}
        </RouterLink>
        <RouterLink
          v-if="next"
          :to="`/treks/${trek?._id}/etapes/${next._id}`"
          class="etape-nav-link is-next"
        >
          <span class="etape-nav-label">Étape suivante →</span>
          {{ next.name }}
        </RouterLink>
      </nav>
    </section>

    <aside class="map-column">
      <TrekOverviewMap
        :etapes="etapes"
        :focused-id="etape._id"
        :highlighted-id="highlightedEtapeId"
        :pois="etape.pois"
        :highlighted-poi-id="highlightedPoiId"
        :cursor="mapCursor"
        @hover="highlightedEtapeId = $event"
        @track-hover="onTrackHover"
        @select="openEtape"
        @poi-hover="highlightedPoiId = $event"
      />
    </aside>
  </div>
  <div v-else class="page-status">
    <RouterLink :to="trek ? `/treks/${trek._id}` : '/'" class="back-link">← Retour</RouterLink>
    <p :role="error || trek ? 'alert' : 'status'">
      {{ error ?? (trek ? 'Étape introuvable' : 'Chargement…') }}
    </p>
  </div>
</template>

<style scoped>
.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
}
.page-status {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
  color: var(--color-text-muted);
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: var(--space-sm) 0 0.25rem;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.etape-order {
  display: inline-grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  background: var(--etape-color);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0;
}
.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
}
.description {
  color: var(--color-text-muted);
  max-width: 65ch;
  white-space: pre-line;
}
.title-row h1 {
  line-height: 1.15;
}
.title-row :deep(.badge) {
  margin-top: 0.75rem;
}
.stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-md) var(--space-lg);
  margin: var(--space-md) 0;
  padding: var(--space-md);
  border: var(--border-hairline);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}
.stat dt {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.stat dd {
  margin: 0.25rem 0 0;
}
.stat-unit {
  font-family: var(--font-body);
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin-left: 0.25rem;
}

/* Mobile : en-tête, carte, puis contenu */
.page {
  display: grid;
  /* minmax(0, 1fr) : la colonne ne s'élargit jamais au-delà de l'écran à cause d'un contenu */
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: 'header' 'map' 'content';
  gap: var(--space-md);
}
.header {
  grid-area: header;
}
.content {
  grid-area: content;
}
.map-column {
  grid-area: map;
  height: 360px;
  border: var(--border-hairline);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}

/* Desktop : en-tête et contenu à gauche, carte fixe à droite sur toute la hauteur */
@media (min-width: 960px) {
  .page {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    grid-template-rows: auto 1fr;
    grid-template-areas: 'header map' 'content map';
    gap: 0 var(--space-lg);
  }
  .map-column {
    align-self: start;
    position: sticky;
    top: var(--space-md);
    height: calc(100vh - 2 * var(--space-md));
  }
}

.pois {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  list-style: none;
  padding: 0;
  margin: var(--space-sm) 0 0;
}
.poi-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: 0.65rem var(--space-sm);
  border: var(--border-hairline);
  border-radius: var(--radius);
  background: var(--color-surface);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}
.poi-item.is-highlighted {
  border-color: var(--color-accent);
  background: var(--color-surface-raised);
}
.poi-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-bg-deep);
}
.poi-notes {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  margin: 0.15rem 0 0;
}
.empty {
  color: var(--color-text-muted);
}
.etape-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}
.etape-nav-link {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: var(--space-sm);
  border: var(--border-hairline);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: inherit;
  text-decoration: none;
  font-weight: 600;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}
.etape-nav-link:hover {
  border-color: var(--color-accent);
  background: var(--color-surface-raised);
}
.etape-nav-link.is-next {
  grid-column: 2;
  text-align: right;
}
.etape-nav-label {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  font-weight: 400;
}
</style>
