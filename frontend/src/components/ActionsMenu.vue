<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

// Menu « ⋯ » d'un trek ou d'une étape : rejoindre le départ (GPS, Waze…), télécharger la
// trace GPX, et pour l'auteur modifier / supprimer.

const props = defineProps<{
  /** Point de départ, convention GeoJSON [longitude, latitude] */
  start: [number, number] | null
  /** Trace GPX : un fichier existant (`url`), ou généré à la demande (`build`) */
  gpx: { url: string; name: string } | { name: string; build: () => Promise<string> } | null
  gpxLabel: string
  /** Page de modification ; absent si l'utilisateur ne peut pas modifier */
  editTo?: RouteLocationRaw | null
  editLabel?: string
  /** Affiche « Supprimer » (l'action est gérée par la page, via l'événement) */
  canDelete?: boolean
  isDeleting?: boolean
}>()

const emit = defineEmits<{
  delete: []
}>()

const isOpen = ref(false)
const root = ref<HTMLElement | null>(null)
const copied = ref(false)

// Attention à l'ordre : les services de cartographie attendent « latitude,longitude »
const latLon = computed(() => {
  if (!props.start) return null
  const [lon, lat] = props.start
  return `${lat.toFixed(6)},${lon.toFixed(6)}`
})

const navigationLinks = computed(() =>
  latLon.value
    ? [
        {
          label: 'Google Maps',
          href: `https://www.google.com/maps/dir/?api=1&destination=${latLon.value}`,
        },
        { label: 'Waze', href: `https://waze.com/ul?ll=${latLon.value}&navigate=yes` },
        { label: "Plans d'Apple", href: `https://maps.apple.com/?daddr=${latLon.value}` },
      ]
    : [],
)

async function copyCoordinates() {
  if (!latLon.value) return
  try {
    await navigator.clipboard.writeText(latLon.value.replace(',', ', '))
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Presse-papiers indisponible (contexte non sécurisé…) : les coordonnées restent affichées
  }
}

const isBuildingGpx = ref(false)
const gpxError = ref<string | null>(null)

async function downloadGpx() {
  const gpx = props.gpx
  if (!gpx) return
  gpxError.value = null
  if ('url' in gpx) {
    triggerDownload(gpx.url, gpx.name)
    return
  }
  isBuildingGpx.value = true
  try {
    const blob = new Blob([await gpx.build()], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    triggerDownload(url, gpx.name)
    URL.revokeObjectURL(url)
  } catch {
    gpxError.value = 'Trace indisponible pour le moment'
  } finally {
    isBuildingGpx.value = false
  }
}

function triggerDownload(href: string, name: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = name
  link.click()
}

function onDelete() {
  isOpen.value = false
  emit('delete')
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
  <div ref="root" class="actions-menu">
    <button
      type="button"
      class="btn btn-icon trigger"
      aria-label="Actions"
      title="Actions"
      :aria-expanded="isOpen"
      aria-controls="actions-menu"
      @click="isOpen = !isOpen"
    >
      <span aria-hidden="true">⋯</span>
    </button>

    <div v-if="isOpen" id="actions-menu" class="menu">
      <template v-if="latLon">
        <p class="menu-title">Rejoindre le départ</p>
        <ul class="menu-list">
          <li v-for="link in navigationLinks" :key="link.label">
            <a :href="link.href" target="_blank" rel="noopener noreferrer" class="menu-item">
              {{ link.label }}
              <span class="hint" aria-hidden="true">↗</span>
            </a>
          </li>
          <li>
            <button type="button" class="menu-item" @click="copyCoordinates">
              {{ copied ? 'Coordonnées copiées ✓' : 'Copier les coordonnées' }}
              <span class="hint coordinates">{{ latLon.replace(',', ', ') }}</span>
            </button>
          </li>
        </ul>
      </template>

      <ul v-if="gpx" class="menu-list">
        <li>
          <button type="button" class="menu-item" :disabled="isBuildingGpx" @click="downloadGpx">
            {{ isBuildingGpx ? 'Préparation de la trace…' : gpxLabel }}
            <span class="hint" aria-hidden="true">↓</span>
          </button>
        </li>
        <li v-if="gpxError" class="menu-error" role="alert">{{ gpxError }}</li>
      </ul>

      <ul v-if="editTo || canDelete" class="menu-list">
        <li v-if="editTo">
          <RouterLink :to="editTo" class="menu-item">{{ editLabel ?? 'Modifier' }}</RouterLink>
        </li>
        <li v-if="canDelete">
          <button
            type="button"
            class="menu-item is-danger"
            :disabled="isDeleting"
            @click="onDelete"
          >
            {{ isDeleting ? 'Suppression…' : 'Supprimer' }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.actions-menu {
  position: relative;
  display: inline-block;
}
.trigger {
  margin-bottom: 0;
  font-size: 1.3rem;
  line-height: 1;
}
.menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.5rem);
  right: 0;
  min-width: 270px;
  padding: var(--space-xs);
  border: var(--border-hairline);
  border-radius: var(--radius);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-soft);
}
.menu-title {
  margin: 0.25rem 0.6rem 0.35rem;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.menu-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
/* Groupes séparés par un filet */
.menu-list + .menu-list {
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: var(--border-hairline);
}
.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
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
.menu-item:disabled {
  opacity: 0.6;
  cursor: wait;
}
.menu-item.is-danger {
  color: var(--color-danger);
}
.menu-item.is-danger:hover,
.menu-item.is-danger:focus-visible {
  background: var(--color-danger-soft);
}
.hint {
  color: var(--color-text-muted);
}
.coordinates {
  color: var(--color-text-faint);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
.menu-error {
  padding: 0.25rem 0.6rem;
  color: var(--color-danger);
  font-size: 0.85rem;
}
</style>
