<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useTreksStore } from '../stores/treks'
import { useTreks } from '../composables/useTreks'

const store = useTreksStore()
const { treks, totalDistance } = storeToRefs(store)
const { addTrek, removeTrek } = store

const { isLoading, error, fetchTreks, createTrek, deleteTrek } = useTreks()

const name = ref('')

onMounted(async () => {
  try {
    treks.value = await fetchTreks()
  } catch {
    // message déjà affiché via `error`
  }
})

async function handleAdd() {
  if (!name.value.trim()) return
  error.value = null
  try {
    const newTrek = await createTrek({
      name: name.value,
      distanceKm: 10,
      elevationGain: 300,
    })
    addTrek(newTrek)
    name.value = ''
  } catch {
    error.value = "Erreur lors de l'ajout de la rando"
  }
}

async function handleDelete(id: string) {
  error.value = null
  try {
    await deleteTrek(id)
    removeTrek(id)
  } catch {
    error.value = 'Erreur lors de la suppression de la rando'
  }
}
</script>

<template>
  <div class="trek-list">
    <h1>Mes randos</h1>

    <p v-if="isLoading">Chargement...</p>
    <p v-else-if="error">{{ error }}</p>

    <p class="stat-number">{{ totalDistance }}<span class="stat-unit">km parcourus</span></p>

    <form class="add-form" @submit.prevent="handleAdd">
      <input v-model="name" placeholder="Nom de la rando" />
      <button type="submit">Ajouter</button>
    </form>

    <ul class="treks">
      <li v-for="trek in treks" :key="trek._id" class="trek-item">
        <span class="trek-name">{{ trek.name }}</span>
        <span class="trek-meta">{{ trek.distanceKm }} km · {{ trek.elevationGain }} m D+</span>
        <button class="delete-btn" @click="handleDelete(trek._id)">Supprimer</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.trek-list {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
}

.stat-number { color: var(--color-accent); margin: var(--space-sm) 0; }
.stat-unit { font-family: var(--font-body); font-size: 1rem; color: var(--color-text-muted); margin-left: var(--space-xs); }

.add-form { display: flex; gap: var(--space-xs); margin: var(--space-md) 0; }
.add-form input {
  background: var(--color-surface);
  border: var(--border-hairline);
  border-radius: var(--radius);
  color: var(--color-text);
  padding: var(--space-xs) var(--space-sm);
  flex: 1;
}
.add-form button {
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius);
  color: var(--color-bg);
  font-weight: 600;
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
}

.treks { list-style: none; padding: 0; margin: 0; }
.trek-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  border-bottom: var(--border-hairline);
}
.trek-name { font-weight: 600; }
.trek-meta { color: var(--color-text-muted); font-size: 0.9rem; margin-left: auto; }
.delete-btn {
  background: none;
  border: var(--border-hairline);
  border-radius: var(--radius);
  color: var(--color-text-muted);
  padding: 0.25rem var(--space-xs);
  cursor: pointer;
}
</style>