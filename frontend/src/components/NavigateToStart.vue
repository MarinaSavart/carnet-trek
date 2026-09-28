<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  /** Point de départ, convention GeoJSON [longitude, latitude] */
  start: [number, number]
  /** Trace GPX téléchargeable (page étape) */
  gpx?: { url: string; name: string } | null
}>()

const isOpen = ref(false)
const root = ref<HTMLElement | null>(null)
const copied = ref(false)

// Attention à l'ordre : les services de cartographie attendent « latitude,longitude »
const latLon = computed(() => {
  const [lon, lat] = props.start
  return `${lat.toFixed(6)},${lon.toFixed(6)}`
})

const links = computed(() => [
  {
    label: 'Google Maps',
    href: `https://www.google.com/maps/dir/?api=1&destination=${latLon.value}`,
  },
  { label: 'Waze', href: `https://waze.com/ul?ll=${latLon.value}&navigate=yes` },
  { label: "Plans d'Apple", href: `https://maps.apple.com/?daddr=${latLon.value}` },
])

async function copyCoordinates() {
  try {
    await navigator.clipboard.writeText(latLon.value.replace(',', ', '))
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Presse-papiers indisponible (contexte non sécurisé…) : les coordonnées restent affichées
  }
}

// Fermeture au clic en dehors du menu ou avec Échap
function onDocumentClick(e: MouseEvent) {
  if (!root.value?.contains(e.target as Node)) isOpen.value = false
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    isOpen.value = false
    root.value?.querySelector<HTMLButtonElement>('.trigger')?.focus()
  }
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('click', onDocumentClick)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="navigate">
    <button
      type="button"
      class="btn btn-primary trigger"
      :aria-expanded="isOpen"
      aria-controls="navigate-menu"
      @click="isOpen = !isOpen"
    >
      <span aria-hidden="true">➜</span> Rejoindre le départ
    </button>

    <div v-if="isOpen" id="navigate-menu" class="menu">
      <p class="menu-title">Itinéraire jusqu'au point de départ</p>
      <ul class="menu-list">
        <li v-for="link in links" :key="link.label">
          <a :href="link.href" target="_blank" rel="noopener noreferrer" class="menu-item">
            {{ link.label }}
            <span class="external" aria-hidden="true">↗</span>
          </a>
        </li>
        <li>
          <button type="button" class="menu-item" @click="copyCoordinates">
            {{ copied ? 'Coordonnées copiées ✓' : 'Copier les coordonnées' }}
          </button>
        </li>
        <li v-if="gpx">
          <a :href="gpx.url" :download="gpx.name" class="menu-item">
            Télécharger la trace GPX
            <span class="external" aria-hidden="true">↓</span>
          </a>
        </li>
      </ul>
      <p class="coordinates">{{ latLon.replace(',', ', ') }}</p>
    </div>
  </div>
</template>

<style scoped>
.navigate {
  position: relative;
  display: inline-block;
}
.menu {
  position: absolute;
  z-index: 10;
  top: calc(100% + 0.5rem);
  left: 0;
  min-width: 260px;
  padding: var(--space-xs);
  border: var(--border-hairline);
  border-radius: var(--radius);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-soft);
}
.menu-title {
  margin: 0.25rem 0.5rem 0.5rem;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}
.menu-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  box-sizing: border-box;
  padding: 0.55rem 0.6rem;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-text);
  font: inherit;
  font-size: 0.95rem;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.menu-item:hover,
.menu-item:focus-visible {
  background: var(--color-accent-soft);
  outline: none;
}
.external {
  color: var(--color-text-muted);
}
.coordinates {
  margin: 0.5rem 0.5rem 0.25rem;
  color: var(--color-text-faint);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
</style>
