import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

// maplibre calcule l'URL de son worker dynamiquement, ce que Vite ne sait pas suivre :
// on laisse Vite bundler le worker et on fournit son URL explicitement.
maplibregl.setWorkerUrl(workerUrl)

export default maplibregl

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
