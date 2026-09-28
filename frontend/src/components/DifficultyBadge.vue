<script setup lang="ts">
import { computed } from 'vue'
import type { Difficulty } from '../types/trek'
import { DIFFICULTY_LABELS } from '../utils/difficulty'

const props = defineProps<{ difficulty: Difficulty }>()

const color = computed(() => `var(--color-diff-${props.difficulty.replace('_', '-')})`)
</script>

<template>
  <span class="badge" :style="{ background: color }">{{ DIFFICULTY_LABELS[difficulty] }}</span>
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
