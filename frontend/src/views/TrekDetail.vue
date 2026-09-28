<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useTreksStore } from '../stores/treks'
import DifficultyBadge from '../components/DifficultyBadge.vue'
import { formatDuration } from '../utils/format'

const route = useRoute()
const store = useTreksStore()

const trek = computed(() => store.getTrekById(route.params.id as string))
</script>

<template>
  <div v-if="trek" class="page">
    <RouterLink to="/" class="back-link">← Treks</RouterLink>
    <h1>{{ trek.name }}</h1>
    <p class="description">{{ trek.description }}</p>

    <ul class="etapes">
      <li v-for="etape in trek.etapes" :key="etape._id" class="etape-item">
        <RouterLink :to="`/etapes/${etape._id}`" class="etape-link">
          <span class="etape-order stat-number">{{ etape.order }}</span>
          <div class="etape-info">
            <h3>{{ etape.name }}</h3>
            <p class="etape-meta">
              {{ etape.distanceKm }} km · {{ etape.elevationGain }} m D+ ·
              {{ formatDuration(etape.durationMin) }}
            </p>
          </div>
          <DifficultyBadge :difficulty="etape.difficulty" />
        </RouterLink>
      </li>
    </ul>
  </div>
  <p v-else>Trek introuvable</p>
</template>

<style scoped>
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
}
.back-link {
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.9rem;
}
.description {
  color: var(--color-text-muted);
}
.etapes {
  list-style: none;
  padding: 0;
  margin-top: var(--space-md);
}
.etape-item {
  border-bottom: var(--border-hairline);
}
.etape-link {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  text-decoration: none;
  color: inherit;
}
.etape-order {
  font-size: 1.5rem;
  color: var(--color-accent);
  min-width: 2ch;
}
.etape-info {
  flex: 1;
}
.etape-meta {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  margin: 0.15rem 0 0;
}
</style>
