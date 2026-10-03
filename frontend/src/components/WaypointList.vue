<script setup lang="ts">
import { ref } from 'vue'

// Liste des points de passage de l'éditeur de trace (A, 1, 2…, B), comme Komoot ou
// Strava : glisser-déposer (ou ↑ ↓ au clavier) pour réordonner, × pour supprimer

const props = defineProps<{
  names: string[]
  highlightedIndex: number | null
  disabled: boolean
}>()

const emit = defineEmits<{
  reorder: [from: number, to: number]
  remove: [index: number]
  focus: [index: number]
  hover: [index: number | null]
  add: []
}>()

function badge(index: number): string {
  if (index === 0) return 'A'
  if (index === props.names.length - 1) return 'B'
  return String(index)
}

const dragIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)

function onDragStart(e: DragEvent, index: number) {
  dragIndex.value = index
  e.dataTransfer?.setData('text/plain', String(index))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDrop(index: number) {
  const from = dragIndex.value
  dragIndex.value = null
  dropIndex.value = null
  if (from !== null && from !== index) emit('reorder', from, index)
}
</script>

<template>
  <section class="waypoints" aria-label="Points de passage">
    <p class="title">Points de passage</p>
    <ol>
      <li
        v-for="(name, index) in names"
        :key="index"
        class="row"
        :class="{
          'is-highlighted': highlightedIndex === index,
          'is-dragging': dragIndex === index,
          'is-drop-target': dropIndex === index && dragIndex !== index,
        }"
        :draggable="!disabled"
        @dragstart="onDragStart($event, index)"
        @dragover.prevent="dropIndex = index"
        @dragleave="dropIndex = dropIndex === index ? null : dropIndex"
        @drop.prevent="onDrop(index)"
        @dragend="dragIndex = dropIndex = null"
        @mouseenter="emit('hover', index)"
        @mouseleave="emit('hover', null)"
      >
        <span class="handle" aria-hidden="true">⋮⋮</span>
        <span
          class="badge"
          :class="{ 'is-start': index === 0, 'is-end': index === names.length - 1 && index > 0 }"
          aria-hidden="true"
        >
          {{ badge(index) }}
        </span>
        <button type="button" class="name" @click="emit('focus', index)">{{ name }}</button>
        <span class="actions">
          <button
            type="button"
            class="icon-btn"
            :disabled="disabled || index === 0"
            :aria-label="`Monter ${name}`"
            @click="emit('reorder', index, index - 1)"
          >
            ↑
          </button>
          <button
            type="button"
            class="icon-btn"
            :disabled="disabled || index === names.length - 1"
            :aria-label="`Descendre ${name}`"
            @click="emit('reorder', index, index + 1)"
          >
            ↓
          </button>
          <button
            type="button"
            class="icon-btn is-remove"
            :disabled="disabled"
            :aria-label="`Supprimer ${name}`"
            @click="emit('remove', index)"
          >
            ×
          </button>
        </span>
      </li>
    </ol>
    <button type="button" class="add" :disabled="disabled" @click="emit('add')">
      + Ajouter un point de passage
    </button>
  </section>
</template>

<style scoped>
.title {
  margin: 0 0 0.4rem;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
ol {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.4rem 0.3rem 0.3rem;
  border: var(--border-hairline);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}
.row.is-highlighted {
  border-color: var(--color-accent);
}
.row.is-dragging {
  opacity: 0.4;
}
.row.is-drop-target {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}
.handle {
  color: var(--color-text-faint);
  font-size: 0.8rem;
  letter-spacing: -0.15em;
  cursor: grab;
}
.badge {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #d95926;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
}
.badge.is-start {
  background: #2f9e44;
}
.badge.is-end {
  background: #1c2823;
  box-shadow: 0 0 0 1.5px var(--color-text-muted);
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 0.9rem;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.actions {
  display: flex;
  flex-shrink: 0;
}
.icon-btn {
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}
.icon-btn:hover:not(:disabled) {
  background: var(--color-surface-raised);
  color: var(--color-text);
}
.icon-btn.is-remove:hover:not(:disabled) {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
.icon-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
/* Flèches discrètes : visibles au survol ou au clavier */
.row:not(:hover, :focus-within) .icon-btn:not(.is-remove) {
  opacity: 0;
}
.name:focus-visible,
.icon-btn:focus-visible,
.add:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.add {
  width: 100%;
  margin-top: 0.4rem;
  padding: 0.45rem 0.8rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-pill);
  background: none;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.9rem;
  text-align: left;
  cursor: pointer;
}
.add:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-text);
}
</style>
