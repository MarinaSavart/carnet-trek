<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { GalleryPhoto } from '../types/trek'

const props = defineProps<{
  photos: GalleryPhoto[]
}>()

// Index de la photo affichée, null quand la visionneuse est fermée
const index = defineModel<number | null>('index', { required: true })

const dialog = ref<HTMLDialogElement | null>(null)
const current = computed(() => (index.value === null ? undefined : props.photos[index.value]))

// <dialog> natif : gère le focus, la touche Échap et l'arrière-plan inerte
watch(index, async (value) => {
  await nextTick()
  if (value !== null && !dialog.value?.open) dialog.value?.showModal()
  if (value === null && dialog.value?.open) dialog.value.close()
})

function go(step: number) {
  if (index.value === null) return
  const count = props.photos.length
  index.value = (index.value + step + count) % count
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') go(1)
  if (e.key === 'ArrowLeft') go(-1)
}

// Un clic sur le fond (et non sur la photo ou les boutons) ferme la visionneuse
function onBackdropClick(e: MouseEvent) {
  if (e.target === dialog.value) index.value = null
}
</script>

<template>
  <dialog
    ref="dialog"
    class="lightbox"
    aria-label="Visionneuse de photos"
    @close="index = null"
    @keydown="onKeydown"
    @click="onBackdropClick"
  >
    <template v-if="current && index !== null">
      <button type="button" class="close" aria-label="Fermer" @click="index = null">✕</button>

      <figure class="figure">
        <img :src="current.url" :alt="current.caption ?? current.label ?? ''" class="image" />
        <figcaption class="caption">
          <span>{{ index + 1 }} / {{ photos.length }}</span>
          <span v-if="current.label">{{ current.label }}</span>
          <span v-if="current.caption">{{ current.caption }}</span>
        </figcaption>
      </figure>

      <template v-if="photos.length > 1">
        <button type="button" class="nav prev" aria-label="Photo précédente" @click="go(-1)">
          ‹
        </button>
        <button type="button" class="nav next" aria-label="Photo suivante" @click="go(1)">›</button>
      </template>
    </template>
  </dialog>
</template>

<style scoped>
.lightbox {
  width: 100vw;
  height: 100vh;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: var(--space-md);
  border: none;
  background: transparent;
  box-sizing: border-box;
}
.lightbox::backdrop {
  background: rgba(20, 29, 25, 0.94);
  backdrop-filter: blur(4px);
}
.lightbox[open] {
  display: flex;
  align-items: center;
  justify-content: center;
}
.figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  margin: 0;
  max-width: 100%;
  max-height: 100%;
}
.image {
  max-width: 100%;
  max-height: calc(100vh - 6rem);
  object-fit: contain;
  border-radius: var(--radius);
}
.caption {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem var(--space-sm);
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
.close,
.nav {
  position: fixed;
  display: grid;
  place-items: center;
  border: var(--border-hairline);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}
.close {
  top: var(--space-sm);
  right: var(--space-sm);
  width: 2.5rem;
  height: 2.5rem;
  font-size: 1rem;
}
.nav {
  top: 50%;
  width: 3rem;
  height: 3rem;
  font-size: 2rem;
  line-height: 1;
  translate: 0 -50%;
}
.prev {
  left: var(--space-sm);
}
.next {
  right: var(--space-sm);
}
.close:hover,
.nav:hover {
  background: var(--color-surface-raised);
}
</style>
