<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GalleryPhoto } from '../types/trek'
import PhotoLightbox from './PhotoLightbox.vue'

const props = defineProps<{
  photos: GalleryPhoto[]
}>()

// Mosaïque : une grande photo + 4 vignettes, la dernière indique le nombre restant
const MAX_TILES = 5

const tiles = computed(() => props.photos.slice(0, MAX_TILES))
const hiddenCount = computed(() => props.photos.length - tiles.value.length)

const openIndex = ref<number | null>(null)
</script>

<template>
  <section v-if="photos.length" class="gallery" aria-label="Photos">
    <ul class="mosaic" :class="`count-${tiles.length}`">
      <li v-for="(photo, i) in tiles" :key="photo._id" class="tile">
        <button type="button" class="tile-button" @click="openIndex = i">
          <img
            :src="photo.url"
            :alt="photo.caption ?? photo.label ?? `Photo ${i + 1}`"
            loading="lazy"
            class="tile-image"
          />
          <span v-if="i === tiles.length - 1 && hiddenCount > 0" class="more">
            +{{ hiddenCount }}
          </span>
        </button>
      </li>
    </ul>

    <button v-if="photos.length > 1" type="button" class="see-all" @click="openIndex = 0">
      Voir les {{ photos.length }} photos
    </button>

    <PhotoLightbox v-model:index="openIndex" :photos="photos" />
  </section>
</template>

<style scoped>
.gallery {
  margin: var(--space-md) 0;
}
.mosaic {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 90px;
  gap: 4px;
  list-style: none;
  padding: 0;
  margin: 0;
  border-radius: var(--radius);
  overflow: hidden;
}
/* La première photo occupe un bloc 2×2, les suivantes remplissent autour */
.tile:first-child {
  grid-column: span 2;
  grid-row: span 2;
}
.count-1 .tile:first-child {
  grid-column: span 4;
  grid-row: span 3;
}
.count-2 .tile {
  grid-column: span 2;
  grid-row: span 2;
}
.count-3 .tile:not(:first-child),
.count-4 .tile:nth-child(2) {
  grid-column: span 2;
}
.tile-button {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: var(--color-surface);
  cursor: zoom-in;
}
.tile-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: filter 0.15s ease;
}
.tile-button:hover .tile-image {
  filter: brightness(1.1);
}
.more {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(10, 14, 12, 0.55);
  color: #fff;
  font-family: var(--font-display);
  font-size: 1.75rem;
}
.see-all {
  margin-top: var(--space-xs);
  padding: 0;
  border: none;
  background: none;
  color: var(--color-accent);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}
.see-all:hover {
  color: var(--color-accent-hover);
  text-decoration: underline;
}
</style>
