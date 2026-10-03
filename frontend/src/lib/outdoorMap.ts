import type maplibregl from './maplibre'
import './outdoorMap.css'

// Fond de carte « randonnée », commun à toutes les cartes de l'appli :
// - sentiers, chemins et pistes bien visibles (le style de base les trace fins et pâles) ;
// - itinéraires balisés (GR, PR…) de Waymarked Trails, en surimpression, dès les zooms
//   larges ;
// - au choix, fond « Plan » (vectoriel, OpenFreeMap) ou « Topo » (OpenTopoMap : courbes de
//   niveau, relief), mémorisé pour les visites suivantes.
//
// À appeler juste après la création de la carte : ces couches passent ainsi sous celles que
// la page ajoute ensuite (tracés d'étapes, points…).

export type Basemap = 'plan' | 'topo'

const STORAGE_KEY = 'carnet-trek.basemap'
const BASE_SOURCE = 'openmaptiles'

const TRAILS_LAYER = 'outdoor-trails'
const TOPO_SOURCE = 'outdoor-topo'
const TOPO_LAYER = 'outdoor-topo'
const WAYMARKED_SOURCE = 'outdoor-waymarked'
const WAYMARKED_LAYER = 'outdoor-waymarked'

function readBasemap(): Basemap {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'topo' ? 'topo' : 'plan'
  } catch {
    return 'plan' // stockage indisponible (navigation privée…) : fond par défaut
  }
}

function saveBasemap(basemap: Basemap) {
  try {
    localStorage.setItem(STORAGE_KEY, basemap)
  } catch {
    // Pas grave : le choix vaut pour cette carte seulement
  }
}

function addLayers(map: maplibregl.Map) {
  // Couches de base au-dessus desquelles on s'insère : sous les libellés et symboles
  const baseLayers = map.getStyle().layers
  const firstSymbol = baseLayers.find((layer) => layer.type === 'symbol')?.id
  const baseSymbols = baseLayers.filter((layer) => layer.type === 'symbol').map((l) => l.id)

  // 1. Sentiers (path) et pistes (track) : pointillés marron, épaissis avec le zoom
  map.addLayer(
    {
      id: TRAILS_LAYER,
      type: 'line',
      source: BASE_SOURCE,
      'source-layer': 'transportation',
      minzoom: 12,
      filter: ['match', ['get', 'class'], ['path', 'track'], true, false],
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'class'], 'track', '#a0703c', '#8b4a1f'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 14, 1.6, 17, 2.6],
        'line-dasharray': [2.5, 1.5],
        'line-opacity': 0.9,
      },
    },
    firstSymbol,
  )

  // 3. Fond topo (images) : par-dessus le fond vectoriel, sous les libellés
  map.addSource(TOPO_SOURCE, {
    type: 'raster',
    tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
    tileSize: 256,
    maxzoom: 17,
    attribution: 'Fond topo © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  })
  map.addLayer(
    { id: TOPO_LAYER, type: 'raster', source: TOPO_SOURCE, layout: { visibility: 'none' } },
    firstSymbol,
  )

  // 2. Itinéraires balisés, sur les deux fonds. Discrets : seulement à l'échelle d'un massif
  // (en vue large, le réseau couvre toute la carte et noie les treks), semi-transparents et
  // désaturés pour rester un repère sous les tracés de l'appli
  map.addSource(WAYMARKED_SOURCE, {
    type: 'raster',
    tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 17,
    attribution:
      'Sentiers balisés © <a href="https://hiking.waymarkedtrails.org">Waymarked Trails</a>',
  })
  map.addLayer(
    {
      id: WAYMARKED_LAYER,
      type: 'raster',
      source: WAYMARKED_SOURCE,
      minzoom: 11,
      paint: {
        // Apparition progressive entre les zooms 11 et 13
        'raster-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 13, 0.55],
        'raster-saturation': -0.45,
      },
    },
    firstSymbol,
  )

  return baseSymbols
}

function applyBasemap(map: maplibregl.Map, basemap: Basemap, baseSymbols: string[]) {
  const topo = basemap === 'topo'
  map.setLayoutProperty(TOPO_LAYER, 'visibility', topo ? 'visible' : 'none')
  // Le fond topo a ses propres sentiers et libellés : on masque ceux du fond vectoriel
  map.setLayoutProperty(TRAILS_LAYER, 'visibility', topo ? 'none' : 'visible')
  for (const id of baseSymbols) map.setLayoutProperty(id, 'visibility', topo ? 'none' : 'visible')
}

/** Sélecteur « Plan / Topo », posé avec les autres contrôles de la carte */
function basemapControl(
  onChange: (basemap: Basemap) => void,
  initial: Basemap,
): maplibregl.IControl {
  const container = document.createElement('div')
  container.className = 'maplibregl-ctrl maplibregl-ctrl-group basemap-switch'
  container.setAttribute('role', 'group')
  container.setAttribute('aria-label', 'Fond de carte')

  const buttons = (['plan', 'topo'] as const).map((value) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = value === 'plan' ? 'Plan' : 'Topo'
    button.addEventListener('click', () => select(value))
    container.append(button)
    return { value, button }
  })

  function select(value: Basemap) {
    for (const { value: v, button } of buttons)
      button.setAttribute('aria-pressed', String(v === value))
    onChange(value)
  }
  for (const { value, button } of buttons)
    button.setAttribute('aria-pressed', String(value === initial))

  return { onAdd: () => container, onRemove: () => container.remove() }
}

export function setupOutdoorMap(
  map: maplibregl.Map,
  position: maplibregl.ControlPosition = 'top-right',
) {
  let current = readBasemap()
  let baseSymbols: string[] = []
  let ready = false

  map.addControl(
    basemapControl((basemap) => {
      current = basemap
      saveBasemap(basemap)
      if (ready) applyBasemap(map, basemap, baseSymbols)
    }, current),
    position,
  )

  map.once('load', () => {
    baseSymbols = addLayers(map)
    ready = true
    applyBasemap(map, current, baseSymbols)
  })
}
