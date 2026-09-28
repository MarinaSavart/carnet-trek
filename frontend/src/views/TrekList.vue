<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTreksStore } from '../stores/treks'

const store = useTreksStore()
const { treks, totalDistanceByTrek } = storeToRefs(store)
</script>

<template>
  <div class="page">
    <div class="heading">
      <h1>Mes treks</h1>
      <RouterLink to="/treks/new" class="btn btn-primary">+ Nouveau trek</RouterLink>
    </div>
    <ul class="treks">
      <li v-for="trek in treks" :key="trek._id" class="trek-item">
        <RouterLink :to="`/treks/${trek._id}`" class="trek-link">
          <h2>{{ trek.name }}</h2>
          <p class="region">{{ trek.region }}</p>
          <p class="stat-number">
            {{ totalDistanceByTrek.get(trek._id)?.toFixed(1) }}
            <span class="stat-unit">km · {{ trek.etapes.length }} étapes</span>
          </p>
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
.treks {
  list-style: none;
  padding: 0;
}
.trek-item {
  border-bottom: var(--border-hairline);
}
.trek-link {
  display: block;
  padding: var(--space-md) 0;
  text-decoration: none;
  color: inherit;
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
</style>
