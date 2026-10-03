<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { searchPlaces, type Place } from '../utils/geocoding'
import type { LonLat } from '../utils/trackEdit'

// Champ de recherche de lieux (villes, refuges, sommets…) avec suggestions au clavier
// (motif « combobox » : flèches, Entrée, Échap)

const props = defineProps<{
  /** Les résultats proches de ce point passent en premier */
  near: LonLat | null
}>()

const emit = defineEmits<{
  select: [place: Place]
}>()

const MIN_LENGTH = 3
const DEBOUNCE_MS = 300

const query = ref('')
const results = ref<Place[]>([])
const activeIndex = ref(-1)
const isOpen = ref(false)
const status = ref<string | null>(null)
const input = ref<HTMLInputElement | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | null = null

watch(query, (value) => {
  clearTimeout(timer)
  controller?.abort()
  const text = value.trim()
  if (text.length < MIN_LENGTH) {
    results.value = []
    status.value = null
    isOpen.value = false
    return
  }
  timer = setTimeout(async () => {
    controller = new AbortController()
    status.value = 'Recherche…'
    isOpen.value = true
    try {
      results.value = await searchPlaces(text, props.near, controller.signal)
      activeIndex.value = results.value.length ? 0 : -1
      status.value = results.value.length ? null : 'Aucun lieu trouvé'
    } catch (e) {
      if (controller.signal.aborted) return
      results.value = []
      status.value = e instanceof Error ? e.message : 'Recherche impossible'
    }
  }, DEBOUNCE_MS)
})

function choose(place: Place) {
  emit('select', place)
  query.value = ''
  isOpen.value = false
  input.value?.blur()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isOpen.value || query.value) {
      e.stopPropagation() // ne ferme pas l'éditeur
      query.value = ''
      isOpen.value = false
    }
    return
  }
  if (!isOpen.value || !results.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % results.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + results.value.length) % results.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const place = results.value[activeIndex.value]
    if (place) choose(place)
  }
}

onUnmounted(() => {
  clearTimeout(timer)
  controller?.abort()
})

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div class="place-search">
    <span class="icon" aria-hidden="true">⌕</span>
    <input
      ref="input"
      v-model="query"
      type="search"
      class="input"
      placeholder="Rechercher un lieu…"
      autocomplete="off"
      role="combobox"
      aria-label="Rechercher un lieu"
      aria-autocomplete="list"
      aria-controls="place-search-results"
      :aria-expanded="isOpen"
      :aria-activedescendant="activeIndex >= 0 ? `place-${activeIndex}` : undefined"
      @keydown="onKeydown"
      @focus="isOpen = results.length > 0"
      @blur="isOpen = false"
    />
    <div v-if="isOpen" class="dropdown">
      <p v-if="status" class="status" role="status">{{ status }}</p>
      <ul v-else id="place-search-results" role="listbox">
        <li
          v-for="(place, index) in results"
          :id="`place-${index}`"
          :key="place.id"
          role="option"
          :aria-selected="index === activeIndex"
          :class="{ 'is-active': index === activeIndex }"
          @mousedown.prevent="choose(place)"
          @mouseenter="activeIndex = index"
        >
          <strong>{{ place.name }}</strong>
          <span v-if="place.detail" class="detail">{{ place.detail }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.place-search {
  position: relative;
  width: min(360px, calc(100% - 80px));
}
.icon {
  position: absolute;
  top: 50%;
  left: 0.85rem;
  translate: 0 -50%;
  color: var(--color-text-muted);
  font-size: 1.15rem;
  pointer-events: none;
}
.input {
  padding-left: 2.3rem;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-soft);
}
.dropdown {
  position: absolute;
  top: calc(100% + 0.4rem);
  left: 0;
  right: 0;
  overflow: hidden;
  border: var(--border-hairline);
  border-radius: var(--radius);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-soft);
}
.status {
  margin: 0;
  padding: 0.7rem 0.9rem;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
ul {
  max-height: 320px;
  overflow-y: auto;
  list-style: none;
  padding: 0.25rem;
  margin: 0;
}
li {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.65rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
li.is-active {
  background: var(--color-accent-soft);
}
.detail {
  color: var(--color-text-muted);
  font-size: 0.8rem;
}
</style>
