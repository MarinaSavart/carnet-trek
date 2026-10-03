<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTreksStore } from '../stores/treks'
import { useAuthStore } from '../stores/auth'
import { useTrek } from '../composables/useTrek'
import { useDecoupage } from '../composables/useDecoupage'
import DifficultyBadge from '../components/DifficultyBadge.vue'
import TrekOverviewMap from '../components/TrekOverviewMap.vue'
import PhotoGallery from '../components/PhotoGallery.vue'
import NavigateToStart from '../components/NavigateToStart.vue'
import DecoupageBar from '../components/DecoupageBar.vue'
import ElevationProfile, {
  type ProfileHover,
  type ProfileSegment,
} from '../components/ElevationProfile.vue'
import type { GalleryPhoto } from '../types/trek'
import { formatDuration } from '../utils/format'
import { getEtapeColor } from '../utils/etapeColors'
import { groupIndexes } from '../utils/decoupage'

const route = useRoute()
const router = useRouter()
const store = useTreksStore()
const auth = useAuthStore()

const { trek, error } = useTrek(() => route.params.id as string)

const sourceEtapes = computed(() =>
  [...(trek.value?.etapes ?? [])].sort((a, b) => a.order - b.order),
)

// Découpage choisi par le visiteur (étapes fusionnées) : la liste, la carte et le profil
// affichent ces étapes ; le trek lui-même n'est jamais modifié
const { nights, displayEtapes, query, setNights, toggleNight, reset } = useDecoupage(sourceEtapes)
const etapes = displayEtapes
const isEditingDecoupage = ref(false)

// Mode découpage : groupe (= étape affichée) de chaque étape d'origine, pour la couleur
const groupOfEtape = computed(() =>
  groupIndexes(nights.value).flatMap((group, groupIndex) => group.map(() => groupIndex)),
)

// « Hendaye → Olhette » → « Olhette » ; sans flèche, le nom complet
function arrivalName(name: string): string {
  return name.split(/\s*(?:→|->)\s*/).pop() || name
}

const totals = computed(() =>
  etapes.value.reduce(
    (acc, e) => ({
      distanceKm: acc.distanceKm + e.distanceKm,
      elevationGain: acc.elevationGain + e.elevationGain,
      elevationLoss: acc.elevationLoss + e.elevationLoss,
      durationMin: acc.durationMin + e.durationMin,
    }),
    { distanceKm: 0, elevationGain: 0, elevationLoss: 0, durationMin: 0 },
  ),
)

// Départ du trek : début du tracé de la première étape (à défaut, son premier point d'intérêt)
const start = computed(() => {
  const first = etapes.value[0]
  return first?.gpxTrack?.coordinates[0] ?? first?.pois[0]?.location.coordinates ?? null
})

// Toutes les photos du trek, dans l'ordre des étapes, avec le nom de l'étape en légende
const photos = computed<GalleryPhoto[]>(() =>
  etapes.value.flatMap((etape) =>
    (etape.photos ?? []).map((photo) => ({ ...photo, label: etape.name })),
  ),
)

// Profil d'altitude du trek : les étapes à la suite, chacune dans sa couleur
const profileSegments = computed<ProfileSegment[]>(() =>
  etapes.value.flatMap((etape, index) =>
    etape.elevationProfile?.length
      ? [
          {
            id: etape._id,
            label: `Étape ${etape.order}`,
            title: etape.name,
            color: getEtapeColor(index),
            points: etape.elevationProfile,
          },
        ]
      : [],
  ),
)

// Étape survolée, dans la liste, sur la carte ou sur le profil : mise en avant partout
const highlightedId = ref<string | null>(null)
// Position commune au profil et à la carte, quel que soit celui qu'on survole
const mapCursor = ref<[number, number] | null>(null)
const profileCursor = ref<ProfileHover | null>(null)

function onProfileHover(value: ProfileHover | null) {
  highlightedId.value = value?.segmentId ?? null
  mapCursor.value = value?.coordinates ?? null
}

function onTrackHover(value: ProfileHover | null) {
  profileCursor.value = value
  mapCursor.value = value?.coordinates ?? null
}

const isDeleting = ref(false)

async function removeTrek() {
  if (!trek.value) return
  const message = `Supprimer « ${trek.value.name} », ses étapes, traces et photos ? C'est définitif.`
  if (!window.confirm(message)) return
  isDeleting.value = true
  try {
    await store.deleteTrek(trek.value._id)
    router.push('/')
  } catch (e) {
    window.alert(e instanceof Error ? e.message : 'Suppression impossible')
    isDeleting.value = false
  }
}

function etapeLink(etapeId: string) {
  return { path: `/treks/${trek.value?._id}/etapes/${etapeId}`, query: query.value }
}

function openEtape(etapeId: string) {
  router.push(etapeLink(etapeId))
}
</script>

<template>
  <div v-if="trek" class="page">
    <header class="header">
      <div class="title-bar">
        <div class="header-top">
          <RouterLink to="/" class="back-link">← Treks</RouterLink>
          <div v-if="auth.canEdit(trek)" class="owner-actions">
            <RouterLink :to="`/treks/${trek._id}/modifier`" class="btn">Modifier</RouterLink>
            <button type="button" class="btn" :disabled="isDeleting" @click="removeTrek">
              {{ isDeleting ? 'Suppression…' : 'Supprimer' }}
            </button>
          </div>
        </div>
        <h1>{{ trek.name }}</h1>
        <p class="region">{{ trek.region }}</p>
      </div>
      <p class="description">{{ trek.description }}</p>
      <NavigateToStart v-if="start" :start="start" class="navigate" />

      <PhotoGallery :photos="photos" />

      <dl class="totals">
        <div class="total">
          <dt>Distance</dt>
          <dd class="stat-number">
            {{ totals.distanceKm.toFixed(1) }}<span class="stat-unit">km</span>
          </dd>
        </div>
        <div class="total">
          <dt>Dénivelé +</dt>
          <dd class="stat-number">{{ totals.elevationGain }}<span class="stat-unit">m</span></dd>
        </div>
        <div class="total">
          <dt>Dénivelé −</dt>
          <dd class="stat-number">{{ totals.elevationLoss }}<span class="stat-unit">m</span></dd>
        </div>
        <div class="total">
          <dt>Durée</dt>
          <dd class="stat-number">{{ formatDuration(totals.durationMin) }}</dd>
        </div>
        <div class="total">
          <dt>Étapes</dt>
          <dd class="stat-number">{{ etapes.length }}</dd>
        </div>
      </dl>

      <ElevationProfile
        :segments="profileSegments"
        :highlighted-id="highlightedId"
        :cursor="profileCursor"
        @hover="onProfileHover"
      />

      <DecoupageBar
        v-model:editing="isEditingDecoupage"
        :trek-id="trek._id"
        :etapes="sourceEtapes"
        :nights="nights"
        @apply="setNights"
        @reset="reset"
      />
    </header>

    <section class="etapes-column" aria-label="Étapes">
      <!-- Mode découpage : étapes d'origine, séparées par les nuits que l'on peut retirer -->
      <ol v-if="isEditingDecoupage" class="etapes">
        <template v-for="(etape, index) in sourceEtapes" :key="etape._id">
          <li
            class="etape-item is-compact"
            :style="{ '--etape-color': getEtapeColor(groupOfEtape[index] ?? 0) }"
          >
            <div class="etape-heading">
              <h2 class="etape-title">
                <span class="etape-order" aria-hidden="true">{{
                  (groupOfEtape[index] ?? 0) + 1
                }}</span>
                <span class="visually-hidden">Étape d'origine {{ etape.order }} :</span>
                {{ etape.name }}
              </h2>
            </div>
            <p class="etape-meta">
              <span title="Distance">↔ {{ etape.distanceKm }} km</span>
              <span title="Durée">⏱︎ {{ formatDuration(etape.durationMin) }}</span>
              <span title="Dénivelé positif">↗ {{ etape.elevationGain }} m</span>
            </p>
          </li>
          <li v-if="index < sourceEtapes.length - 1" class="night">
            <button
              type="button"
              class="night-toggle"
              :class="{ 'is-off': !nights[index] }"
              :aria-pressed="nights[index]"
              @click="toggleNight(index)"
            >
              <template v-if="nights[index]">🌙 Nuit à {{ arrivalName(etape.name) }}</template>
              <template v-else>Pas d'arrêt à {{ arrivalName(etape.name) }} : on continue</template>
            </button>
          </li>
        </template>
      </ol>

      <ol v-else class="etapes">
        <li
          v-for="(etape, index) in etapes"
          :key="etape._id"
          class="etape-item"
          :class="{ 'is-highlighted': highlightedId === etape._id }"
          :style="{ '--etape-color': getEtapeColor(index) }"
          @mouseenter="highlightedId = etape._id"
          @mouseleave="highlightedId = null"
        >
          <RouterLink :to="etapeLink(etape._id)" class="etape-link">
            <div class="etape-heading">
              <h2 class="etape-title">
                <span class="etape-order" aria-hidden="true">{{ etape.order }}</span>
                <span class="visually-hidden">Étape {{ etape.order }} :</span>
                {{ etape.name }}
              </h2>
              <DifficultyBadge :difficulty="etape.difficulty" />
            </div>
            <p class="etape-meta">
              <span title="Distance">↔ {{ etape.distanceKm }} km</span>
              <span title="Durée">⏱︎ {{ formatDuration(etape.durationMin) }}</span>
              <span title="Dénivelé positif">↗ {{ etape.elevationGain }} m</span>
              <span title="Dénivelé négatif">↘ {{ etape.elevationLoss }} m</span>
            </p>
            <p v-if="etape.sources" class="etape-sources">
              Fusion des étapes {{ etape.sources.map((s) => s.order).join(', ') }}
            </p>
            <p v-if="etape.pois.length || etape.photos?.length" class="etape-pois">
              <span v-if="etape.pois.length">
                {{ etape.pois.length }} point{{ etape.pois.length > 1 ? 's' : '' }} d'intérêt
              </span>
              <span v-if="etape.photos?.length">
                {{ etape.photos.length }} photo{{ etape.photos.length > 1 ? 's' : '' }}
              </span>
            </p>
          </RouterLink>
        </li>
      </ol>
    </section>

    <aside class="map-column">
      <TrekOverviewMap
        :etapes="etapes"
        :highlighted-id="highlightedId"
        :cursor="mapCursor"
        @hover="highlightedId = $event"
        @track-hover="onTrackHover"
        @select="openEtape"
      />
    </aside>
  </div>
  <div v-else class="page-status">
    <RouterLink to="/" class="back-link">← Treks</RouterLink>
    <p :role="error ? 'alert' : 'status'">{{ error ?? 'Chargement…' }}</p>
  </div>
</template>

<style scoped>
.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
  /* Largeur de la carte sur desktop : proche de ce que donnait l'ancienne grille (1fr / 1.1fr) */
  --map-width: clamp(420px, 40vw, 583px);
}
.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}
.owner-actions {
  display: flex;
  gap: var(--space-xs);
}
.page-status {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
  color: var(--color-text-muted);
}
.header h1 {
  margin-top: var(--space-xs);
}
.region {
  color: var(--color-accent);
  margin: 0.25rem 0 0;
}
.description {
  color: var(--color-text-muted);
  max-width: 65ch;
}
.navigate {
  margin-top: var(--space-xs);
}
.totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  gap: var(--space-md);
  margin: var(--space-md) 0 var(--space-md);
  padding: var(--space-md);
  border: var(--border-hairline);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}
.total dt {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.total dd {
  margin: 0.25rem 0 0;
  font-size: 2.1rem;
  white-space: nowrap;
}
.stat-unit {
  font-family: var(--font-body);
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin-left: 0.25rem;
}

/* Mobile : en-tête, carte, puis liste des étapes */
.page {
  display: grid;
  /* minmax(0, 1fr) : la colonne ne s'élargit jamais au-delà de l'écran à cause d'un contenu */
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: 'header' 'map' 'etapes';
  gap: var(--space-md);
}
.header {
  grid-area: header;
}
.etapes-column {
  grid-area: etapes;
}
.map-column {
  grid-area: map;
  height: 360px;
  border: var(--border-hairline);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}

/* Desktop : en-tête et étapes à gauche (largeur réduite pour laisser la place à la carte) ;
   la carte est en position fixed, ancrée à l'écran — elle ne défile jamais, contrairement à
   un position: sticky qui se décroche dès que la colonne de gauche devient plus courte qu'elle */
@media (min-width: 960px) {
  .page {
    display: block;
  }
  .header,
  .etapes-column {
    margin-right: calc(var(--map-width) + var(--space-lg));
  }
  /* Bandeau titre collé sous la navbar, pendant que la description/photos/étapes défilent */
  .title-bar {
    position: sticky;
    top: var(--navbar-height);
    z-index: 10;
    /* Même dégradé que le fond de page, figé par rapport à l'écran : se fond avec le contenu
       qui défile dessous au lieu de trancher par une couleur plate */
    background: var(--page-gradient), var(--color-bg);
    background-attachment: fixed;
    padding: var(--space-sm) 0;
    margin: calc(-1 * var(--space-sm)) 0 0;
  }
  .map-column {
    position: fixed;
    top: calc(var(--navbar-height) + var(--space-md));
    /* Aligne le bord droit de la carte sur celui du conteneur centré (max-width: 1200px) */
    right: max(var(--space-md), calc((100vw - 1200px) / 2 + var(--space-md)));
    width: var(--map-width);
    height: calc(100vh - var(--navbar-height) - 2 * var(--space-md));
  }
}

.etapes {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  list-style: none;
  padding: 0;
  margin: 0;
}
.etape-item {
  border: var(--border-hairline);
  border-radius: var(--radius);
  background: var(--color-surface);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    translate 0.2s ease;
}
.etape-item.is-highlighted {
  border-color: color-mix(in srgb, var(--etape-color) 60%, transparent);
  background: var(--color-surface-raised);
  translate: 3px 0;
}
.etape-link {
  display: block;
  padding: var(--space-sm);
  text-decoration: none;
  color: inherit;
}
.etape-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
}
.etape-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.4rem;
  line-height: 1.2;
}
/* Pastille numérotée, identique aux marqueurs de la carte */
.etape-order {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: var(--etape-color);
  box-shadow: 0 0 0 2px var(--color-surface);
  color: #fff;
  font-family: var(--font-body);
  font-size: 0.85rem;
}
.etape-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem var(--space-sm);
  margin: var(--space-xs) 0 0;
  padding-left: 2.35rem;
  font-size: 0.9rem;
}
.etape-sources {
  padding-left: 2.35rem;
  color: var(--color-accent);
  font-size: 0.85rem;
  margin: 0.25rem 0 0;
}
.etape-item.is-compact {
  padding: 0.6rem var(--space-sm);
}
.etape-item.is-compact .etape-title {
  font-size: 1.1rem;
}
.night {
  display: flex;
  justify-content: center;
}
.night-toggle {
  padding: 0.3rem 0.9rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-pill);
  background: var(--color-bg-deep);
  color: var(--color-text);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}
.night-toggle:hover {
  border-color: var(--color-accent);
}
.night-toggle:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.night-toggle.is-off {
  border-style: solid;
  border-color: transparent;
  background: none;
  color: var(--color-text-faint);
  text-decoration: line-through;
}
.etape-pois {
  display: flex;
  gap: var(--space-sm);
  padding-left: 2.35rem;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin: 0.25rem 0 0;
}
</style>
