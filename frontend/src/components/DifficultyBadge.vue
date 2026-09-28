<script setup lang="ts">
import { computed } from 'vue'
import type { Difficulty } from '../types/trek'
import { DIFFICULTY_LABELS } from '../utils/difficulty'

const props = defineProps<{ difficulty: Difficulty }>()

const color = computed(() => `var(--color-diff-${props.difficulty.replace('_', '-')})`)
</script>

<template>
  <!-- Pastille teintée + point de couleur : la couleur signale, le libellé porte le sens -->
  <span class="badge" :style="{ '--badge-color': color }">
    <span class="dot" aria-hidden="true" />
    {{ DIFFICULTY_LABELS[difficulty] }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.7rem 0.2rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--badge-color) 45%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--badge-color) 16%, transparent);
  color: var(--color-text);
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}
.dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--badge-color);
  /* Liseré clair : garde le point « noir » (très difficile) visible sur le fond sombre */
  box-shadow: 0 0 0 1px rgba(239, 232, 218, 0.4);
}
</style>
