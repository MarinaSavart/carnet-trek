<script setup lang="ts">
// Mise en page plein écran des pages avec carte (accueil, trek, étape), façon Komoot /
// Strava : un panneau à gauche qui défile seul, la carte sur tout le reste de l'écran,
// et en option une bande sous la carte (stats + profil d'altitude, sur toute sa largeur).
//
// Sur mobile, tout s'empile et la page défile normalement : carte, bande, puis panneau.

defineProps<{
  /** Nom du panneau pour les lecteurs d'écran (ex. « Treks », « Étapes ») */
  panelLabel: string
  /** Tout l'écran (fenêtre plein écran, sans la barre du haut : éditeur de trace) */
  fullscreen?: boolean
  /** Panneau sans marge intérieure : le contenu gère ses propres sections */
  flush?: boolean
}>()
</script>

<template>
  <div
    class="map-layout"
    :class="{ 'has-dock': $slots.dock, 'is-fullscreen': fullscreen, 'is-flush': flush }"
  >
    <div class="panel" role="region" :aria-label="panelLabel">
      <slot name="panel" />
    </div>
    <div class="map">
      <slot name="map" />
    </div>
    <div v-if="$slots.dock" class="dock">
      <slot name="dock" />
    </div>
  </div>
</template>

<style scoped>
.map-layout {
  --panel-width: clamp(360px, 30vw, 600px);
  display: grid;
  grid-template-columns: var(--panel-width) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  grid-template-areas: 'panel map';
  height: calc(100dvh - var(--navbar-height));
}
.map-layout.has-dock {
  grid-template-rows: minmax(0, 1fr) auto;
  grid-template-areas:
    'panel map'
    'panel dock';
}
.map-layout.is-fullscreen {
  height: 100dvh;
}
.panel {
  grid-area: panel;
  min-height: 0;
  overflow-y: auto;
  /* Le défilement du panneau ne fait pas défiler la page derrière */
  overscroll-behavior: contain;
  padding: var(--space-md) var(--space-md) var(--space-lg);
  border-right: var(--border-hairline);
  background: var(--color-bg);
}
.is-flush .panel {
  padding: 0;
}
.map {
  grid-area: map;
  position: relative;
  min-width: 0;
  min-height: 0;
}
/* La carte remplit toute sa zone, quel que soit le composant */
.map > :deep(*) {
  position: absolute;
  inset: 0;
  height: 100%;
}
.dock {
  grid-area: dock;
  min-width: 0;
  padding: var(--space-sm) var(--space-md) var(--space-xs);
  border-top: var(--border-hairline);
  background: var(--color-bg-deep);
}

/* Mobile et petites tablettes : la page défile, carte en haut */
@media (max-width: 900px) {
  .map-layout,
  .map-layout.has-dock,
  .map-layout.is-fullscreen {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto;
    grid-template-areas: 'map' 'dock' 'panel';
    height: auto;
  }
  .map {
    height: 45vh;
    min-height: 280px;
  }
  .panel {
    overflow: visible;
    border-right: none;
    padding: var(--space-md);
  }
  .is-flush .panel {
    padding: 0;
  }
}
</style>
