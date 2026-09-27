<script setup lang="ts">
import { computed } from 'vue'
import type { Difficulty } from '../types/trek'

const props = defineProps<{ difficulty: Difficulty }>()

const labels: Record<Difficulty, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
  tres_difficile: 'Très difficile',
}

const color = computed(() => `var(--color-diff-${props.difficulty.replace('_', '-')})`)
</script>

<template>
  <span class="badge" :style="{ background: color }">{{ labels[difficulty] }}</span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: var(--radius);
  border: var(--border-hairline);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}
</style>
