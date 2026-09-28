<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTreksStore } from '../stores/treks'
import DifficultyBadge from '../components/DifficultyBadge.vue'
import TrekOverviewMap from '../components/TrekOverviewMap.vue'
import { formatDuration } from '../utils/format'
import { getEtapeColor } from '../utils/etapeColors'
import { POI_ICONS } from '../utils/poi'

const route = useRoute()
const router = useRouter()
const store = useTreksStore()

const etape = computed(() => store.getEtapeById(route.params.id as string))
const trek = computed(() => store.getTrekByEtapeId(route.params.id as string))

// Toutes les étapes du trek, pour la carte et la navigation précédente / suivante
const etapes = computed(() => {
  if (trek.value) return [...trek.value.etapes].sort((a, b) => a.order - b.order)
  return etape.value ? [etape.value] : []
})
const index = computed(() => etapes.value.findIndex((e) => e._id === etape.value?._id))
const previous = computed(() => etapes.value[index.value - 1])
const next = computed(() => etapes.value[index.value + 1])

const highlightedEtapeId = ref<string | null>(null)
const highlightedPoiId = ref<string | null>(null)

function openEtape(etapeId: string) {
  router.push(`/etapes/${etapeId}`)
}
</script>

<template>
  <div v-if="etape" class="page" :style="{ '--etape-color': getEtapeColor(index) }">
    <header class="header">
      <RouterLink :to="trek ? `/treks/${trek._id}` : '/'" class="back-link">
        ← {{ trek?.name ?? 'Treks' }}
      </RouterLink>

      <p class="eyebrow">
        <span class="etape-order">#{{ etape.order }}</span>
        Étape {{ index + 1 }} sur {{ etapes.length }}
      </p>
      <div class="title-row">
        <h1>{{ etape.name }}</h1>
        <DifficultyBadge :difficulty="etape.difficulty" />
      </div>

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
        <RouterLink v-if="previous" :to="`/etapes/${previous._id}`" class="etape-nav-link">
          <span class="etape-nav-label">← Étape précédente</span>
          {{ previous.name }}
        </RouterLink>
        <RouterLink v-if="next" :to="`/etapes/${next._id}`" class="etape-nav-link is-next">
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
        @hover="highlightedEtapeId = $event"
        @select="openEtape"
        @poi-hover="highlightedPoiId = $event"
      />
    </aside>
  </div>
  <p v-else>Étape introuvable</p>
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
.eyebrow {
  margin: var(--space-sm) 0 0;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.etape-order {
  color: var(--etape-color);
  filter: brightness(1.4);
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  margin-right: 0.25rem;
}
.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
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
  gap: var(--space-md) var(--space-lg);
  margin: var(--space-md) 0;
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
  border-radius: var(--radius);
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
  list-style: none;
  padding: 0;
  margin: var(--space-xs) 0 0;
}
.poi-item {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-xs);
  border-bottom: var(--border-hairline);
  transition: background-color 0.15s ease;
}
.poi-item.is-highlighted {
  background: var(--color-surface);
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
  color: inherit;
  text-decoration: none;
  font-weight: 600;
  transition: background-color 0.15s ease;
}
.etape-nav-link:hover {
  background: var(--color-surface);
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
