<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTreksStore } from '../stores/treks'
import { formatDuration } from '../utils/format'

const store = useTreksStore()
const { summaries } = storeToRefs(store)

// Au retour sur la liste, on affiche tout de suite l'ancienne version pendant le rechargement
const isLoading = ref(summaries.value.length === 0)
const error = ref<string | null>(null)

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
</script>

<template>
  <div class="page">
    <div class="heading">
      <h1>Mes treks</h1>
      <RouterLink to="/treks/new" class="btn btn-primary">+ Nouveau trek</RouterLink>
    </div>

    <p v-if="isLoading" class="status" role="status">Chargement…</p>

    <div v-else-if="error" class="status" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="btn" @click="load">Réessayer</button>
    </div>

    <div v-else-if="!summaries.length" class="status">
      <p>Aucun trek pour l'instant.</p>
      <RouterLink to="/treks/new" class="btn">Créer mon premier trek</RouterLink>
    </div>

    <ul v-else class="treks">
      <li v-for="trek in summaries" :key="trek._id" class="trek-item">
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
            <h2>{{ trek.name }}</h2>
            <p v-if="trek.region" class="region">{{ trek.region }}</p>
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
  </div>
</template>

<style scoped>
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
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
  margin-top: var(--space-lg);
  color: var(--color-text-muted);
}
.status p {
  margin: 0;
}
.treks {
  list-style: none;
  padding: 0;
}
.trek-item {
  border-bottom: var(--border-hairline);
}
.trek-link {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) 0;
  text-decoration: none;
  color: inherit;
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
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 1.75rem;
}
.trek-info {
  min-width: 0;
}
.region {
  color: var(--color-text-muted);
  margin: 0.25rem 0;
}
.stat-unit {
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--color-text-muted);
  margin-left: var(--space-xs);
}
@media (max-width: 480px) {
  .cover {
    width: 80px;
  }
}
</style>
