<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTrek } from '../composables/useTrek'
import { useDecoupage } from '../composables/useDecoupage'
import DifficultyBadge from '../components/DifficultyBadge.vue'
import TrekOverviewMap from '../components/TrekOverviewMap.vue'
import PhotoGallery from '../components/PhotoGallery.vue'
import ActionsMenu from '../components/ActionsMenu.vue'
import { useAuthStore } from '../stores/auth'
import ElevationProfile, {
  type ProfileHover,
  type ProfileSegment,
} from '../components/ElevationProfile.vue'
import { formatDuration } from '../utils/format'
import { getEtapeColor } from '../utils/etapeColors'
import { POI_ICONS } from '../utils/poi'
import { buildMergedGpx } from '../utils/gpxExport'
import { describePieces } from '../utils/decoupage'

const route = useRoute()
const router = useRouter()
const { trek, error } = useTrek(() => route.params.trekId as string)
const sourceEtapes = computed(() =>
  [...(trek.value?.etapes ?? [])].sort((a, b) => a.order - b.order),
)

// Toutes les étapes du trek dans le découpage choisi (?decoupage=…), pour la carte et la
// navigation précédente / suivante
const { displayEtapes: etapes, query } = useDecoupage(sourceEtapes)

// Étape affichée : une étape fusionnée a pour identifiant ceux de ses étapes jointes par
// « + ». Un lien vers une étape d'origine absorbée par une fusion mène à l'étape fusionnée.
const etape = computed(() => {
  const id = route.params.etapeId
  return etapes.value.find((e) => e._id === id || e.sources?.some((s) => s._id === id))
})
const index = computed(() => etapes.value.findIndex((e) => e._id === etape.value?._id))
const previous = computed(() => etapes.value[index.value - 1])
const next = computed(() => etapes.value[index.value + 1])

// Départ de l'étape : début de son tracé (à défaut, son premier point d'intérêt)
const start = computed(
  () => etape.value?.gpxTrack?.coordinates[0] ?? etape.value?.pois[0]?.location.coordinates ?? null,
)
const auth = useAuthStore()

const gpxDownload = computed(() => {
  const current = etape.value
  if (current?.pieces) {
    const pieces = current.pieces
    return { name: `${current.name}.gpx`, build: () => buildMergedGpx(current.name, pieces) }
  }
  return current?.gpxFile ? { url: current.gpxFile.url, name: current.gpxFile.originalName } : null
})

const profileSegments = computed<ProfileSegment[]>(() =>
  etape.value?.elevationProfile?.length
    ? [
        {
          id: etape.value._id,
          label: etape.value.name,
          color: getEtapeColor(index.value),
          points: etape.value.elevationProfile,
        },
      ]
    : [],
)
// Position commune au profil et à la carte, quel que soit celui qu'on survole
const mapCursor = ref<[number, number] | null>(null)
const profileCursor = ref<ProfileHover | null>(null)

// Seul le tracé de l'étape affichée a un profil ici : on ignore les étapes voisines
function onTrackHover(value: ProfileHover | null) {
  const isCurrent = value?.segmentId === etape.value?._id
  profileCursor.value = isCurrent ? value : null
  mapCursor.value = isCurrent ? (value?.coordinates ?? null) : null
}

const highlightedEtapeId = ref<string | null>(null)
const highlightedPoiId = ref<string | null>(null)

function etapeLink(etapeId: string) {
  return { path: `/treks/${trek.value?._id}/etapes/${etapeId}`, query: query.value }
}

const trekLink = computed(() =>
  trek.value ? { path: `/treks/${trek.value._id}`, query: query.value } : '/',
)

function openEtape(etapeId: string) {
  router.push(etapeLink(etapeId))
}
</script>

<template>
  <div v-if="etape" class="page" :style="{ '--etape-color': getEtapeColor(index) }">
    <header class="header">
      <div class="title-bar">
        <div class="header-top">
          <RouterLink :to="trekLink" class="back-link"> ← {{ trek?.name ?? 'Treks' }} </RouterLink>
          <ActionsMenu
            :start="start"
            :gpx="gpxDownload"
            :gpx-label="
              etape.pieces ? 'Télécharger le GPX de la journée' : 'Télécharger le GPX de l\'étape'
            "
            :edit-to="trek && auth.canEdit(trek) ? `/treks/${trek._id}/modifier` : null"
            edit-label="Modifier le trek"
          />
        </div>

        <p class="eyebrow">
          <span class="etape-order" aria-hidden="true">{{ etape.order }}</span>
          Étape {{ index + 1 }} sur {{ etapes.length }}
          <span v-if="etape.pieces" class="eyebrow-merged">
            · {{ describePieces(etape.pieces) }}
          </span>
        </p>
        <div class="title-row">
          <h1>{{ etape.name }}</h1>
          <DifficultyBadge :difficulty="etape.difficulty" />
        </div>
      </div>
      <p v-if="etape.description" class="description">{{ etape.description }}</p>

      <PhotoGallery :photos="etape.photos ?? []" />

      <dl class="stats">
        <div class="stat">
          <dt>Distance</dt>
          <dd class="stat-number">{{ etape.distanceKm }}<span class="stat-unit">km</span></dd>
        </div>
        <div class="stat">
          <dt>Dénivelé +</dt>
          <dd class="stat-number">{{ etape.elevationGain }}<span class="stat-unit">m</span></dd>
        </div>
        <div class="stat">
          <dt>Dénivelé −</dt>
          <dd class="stat-number">{{ etape.elevationLoss }}<span class="stat-unit">m</span></dd>
        </div>
        <div class="stat">
          <dt>Durée</dt>
          <dd class="stat-number">{{ formatDuration(etape.durationMin) }}</dd>
        </div>
      </dl>

      <ElevationProfile
        :segments="profileSegments"
        :cursor="profileCursor"
        @hover="mapCursor = $event?.coordinates ?? null"
      />
    </header>

    <section class="content">
      <h2>Points d'intérêt</h2>
      <ul v-if="etape.pois.length" class="pois">
        <li
          v-for="poi in etape.pois"
          :key="poi._id"
          class="poi-item"
          :class="{ 'is-highlighted': highlightedPoiId === poi._id }"
          @mouseenter="highlightedPoiId = poi._id"
          @mouseleave="highlightedPoiId = null"
        >
          <span class="poi-icon">{{ POI_ICONS[poi.type] }}</span>
          <div>
            <strong>{{ poi.name }}</strong>
            <p v-if="poi.notes" class="poi-notes">{{ poi.notes }}</p>
          </div>
        </li>
      </ul>
      <p v-else class="empty">Aucun point d'intérêt pour cette étape.</p>

      <nav v-if="previous || next" class="etape-nav" aria-label="Étapes voisines">
        <RouterLink v-if="previous" :to="etapeLink(previous._id)" class="etape-nav-link">
          <span class="etape-nav-label">← Étape précédente</span>
          {{ previous.name }}
        </RouterLink>
        <RouterLink v-if="next" :to="etapeLink(next._id)" class="etape-nav-link is-next">
          <span class="etape-nav-label">Étape suivante →</span>
          {{ next.name }}
        </RouterLink>
      </nav>
    </section>

    <aside class="map-column">
      <TrekOverviewMap
        :etapes="etapes"
        :focused-id="etape._id"
        :highlighted-id="highlightedEtapeId"
        :pois="etape.pois"
        :highlighted-poi-id="highlightedPoiId"
        :cursor="mapCursor"
        osm-pois
        @hover="highlightedEtapeId = $event"
        @track-hover="onTrackHover"
        @select="openEtape"
        @poi-hover="highlightedPoiId = $event"
      />
    </aside>
  </div>
  <div v-else class="page-status">
    <RouterLink :to="trekLink" class="back-link">← Retour</RouterLink>
    <p :role="error || trek ? 'alert' : 'status'">
      {{ error ?? (trek ? 'Étape introuvable' : 'Chargement…') }}
    </p>
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
.page-status {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
  color: var(--color-text-muted);
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: var(--space-sm) 0 0.25rem;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.eyebrow-merged {
  color: var(--color-accent);
  text-transform: none;
  letter-spacing: 0;
}
.etape-order {
  display: inline-grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  background: var(--etape-color);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0;
}
.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
}
.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}
.description {
  color: var(--color-text-muted);
  max-width: 65ch;
  white-space: pre-line;
}
.title-row h1 {
  line-height: 1.15;
}
.title-row :deep(.badge) {
  margin-top: 0.75rem;
}
.stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-md) var(--space-lg);
  margin: var(--space-md) 0;
  padding: var(--space-md);
  border: var(--border-hairline);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}
.stat dt {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.stat dd {
  margin: 0.25rem 0 0;
}
.stat-unit {
  font-family: var(--font-body);
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin-left: 0.25rem;
}

/* Mobile : en-tête, carte, puis contenu */
.page {
  display: grid;
  /* minmax(0, 1fr) : la colonne ne s'élargit jamais au-delà de l'écran à cause d'un contenu */
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: 'header' 'map' 'content';
  gap: var(--space-md);
}
.header {
  grid-area: header;
}
.content {
  grid-area: content;
}
.map-column {
  grid-area: map;
  height: 360px;
  border: var(--border-hairline);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}

/* Desktop : en-tête et contenu à gauche (largeur réduite pour laisser la place à la carte) ;
   la carte est en position fixed, ancrée à l'écran — elle ne défile jamais, contrairement à
   un position: sticky qui se décroche dès que la colonne de gauche devient plus courte qu'elle */
@media (min-width: 960px) {
  .page {
    display: block;
  }
  .header,
  .content {
    margin-right: calc(var(--map-width) + var(--space-lg));
  }
  /* Bandeau titre collé sous la navbar, pendant que la description/photos/contenu défilent */
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

.pois {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  list-style: none;
  padding: 0;
  margin: var(--space-sm) 0 0;
}
.poi-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: 0.65rem var(--space-sm);
  border: var(--border-hairline);
  border-radius: var(--radius);
  background: var(--color-surface);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}
.poi-item.is-highlighted {
  border-color: var(--color-accent);
  background: var(--color-surface-raised);
}
.poi-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-bg-deep);
}
.poi-notes {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  margin: 0.15rem 0 0;
}
.empty {
  color: var(--color-text-muted);
}
.etape-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}
.etape-nav-link {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: var(--space-sm);
  border: var(--border-hairline);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: inherit;
  text-decoration: none;
  font-weight: 600;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}
.etape-nav-link:hover {
  border-color: var(--color-accent);
  background: var(--color-surface-raised);
}
.etape-nav-link.is-next {
  grid-column: 2;
  text-align: right;
}
.etape-nav-label {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  font-weight: 400;
}
</style>
