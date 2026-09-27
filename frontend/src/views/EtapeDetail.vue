<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useTreksStore } from '../stores/treks'
import DifficultyBadge from '../components/DifficultyBadge.vue'
import { formatDuration } from '../utils/format'
import type { POIType } from '../types/trek'

const route = useRoute()
const store = useTreksStore()

const etape = computed(() => store.getEtapeById(route.params.id as string))
const trek = computed(() => store.getTrekByEtapeId(route.params.id as string))

const poiIcons: Record<POIType, string> = {
  refuge: '🏠',
  camping: '⛺',
  point_eau: '💧',
  sommet: '🏔️',
  ravitaillement: '🛒',
  autre: '📍',
}
</script>

<template>
  <div v-if="etape" class="page">
    <RouterLink :to="trek ? `/treks/${trek._id}` : '/'" class="back-link">
      ← {{ trek?.name ?? 'Treks' }}
    </RouterLink>

    <div class="header">
      <h1>{{ etape.name }}</h1>
      <DifficultyBadge :difficulty="etape.difficulty" />
    </div>

    <div class="stats">
      <div class="stat">
        <p class="stat-number">{{ etape.distanceKm }}<span class="stat-unit">km</span></p>
      </div>
      <div class="stat">
        <p class="stat-number">{{ etape.elevationGain }}<span class="stat-unit">m D+</span></p>
      </div>
      <div class="stat">
        <p class="stat-number">{{ etape.elevationLoss }}<span class="stat-unit">m D-</span></p>
      </div>
      <div class="stat">
        <p class="stat-number">{{ formatDuration(etape.durationMin) }}</p>
      </div>
    </div>

    <div class="map-placeholder">Carte à venir (MapLibre)</div>

    <h2>Points d'intérêt</h2>
    <ul class="pois">
      <li v-for="poi in etape.pois" :key="poi._id" class="poi-item">
        <span class="poi-icon">{{ poiIcons[poi.type] }}</span>
        <div>
          <strong>{{ poi.name }}</strong>
          <p v-if="poi.notes" class="poi-notes">{{ poi.notes }}</p>
        </div>
      </li>
    </ul>
  </div>
  <p v-else>Étape introuvable</p>
</template>

<style scoped>
.page { max-width: 720px; margin: 0 auto; padding: var(--space-lg) var(--space-md); }
.back-link { color: var(--color-text-muted); text-decoration: none; font-size: 0.9rem; }
.header { display: flex; align-items: center; gap: var(--space-sm); margin: var(--space-sm) 0 var(--space-md); }
.stats { display: flex; gap: var(--space-lg); flex-wrap: wrap; margin-bottom: var(--space-md); }
.stat-unit { font-family: var(--font-body); font-size: 0.9rem; color: var(--color-text-muted); margin-left: 0.25rem; }
.map-placeholder {
  height: 240px;
  background: var(--color-surface);
  border: var(--border-hairline);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  margin-bottom: var(--space-md);
}
.pois { list-style: none; padding: 0; }
.poi-item { display: flex; gap: var(--space-sm); padding: var(--space-xs) 0; border-bottom: var(--border-hairline); }
.poi-notes { color: var(--color-text-muted); font-size: 0.9rem; margin: 0.15rem 0 0; }
</style>