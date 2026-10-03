import maplibregl from './maplibre'
import { fetchOsmPois, type OsmPoi } from '../utils/overpass'
import { POI_ICONS } from '../utils/poi'
import './osmPoiLayer.css'

// Calque « Points utiles » (eau, refuges, sommets… d'OpenStreetMap) à poser sur n'importe
// quelle carte. Chargé seulement à partir d'un zoom suffisant, une fois la carte immobile.

export type OsmPoiStatus =
  | { state: 'off' }
  | { state: 'zoom' }
  | { state: 'loading' }
  | { state: 'ready'; count: number }
  | { state: 'error'; message: string }

interface Options {
  /** Clic sur un point : sans callback, une simple bulle avec le nom s'affiche */
  onSelect?: (poi: OsmPoi, marker: maplibregl.Marker) => void
  onStatus?: (status: OsmPoiStatus) => void
  /** Points à ne pas afficher (ex. déjà ajoutés à l'étape) */
  isHidden?: (poi: OsmPoi) => boolean
}

export const OSM_POI_MIN_ZOOM = 12
// Laisse la carte se poser avant d'interroger Overpass (pas de requête pendant un glissé)
const LOAD_DELAY_MS = 500

export class OsmPoiLayer {
  private enabled = false
  private markers = new Map<string, maplibregl.Marker>()
  private pois: OsmPoi[] = []
  private timer: ReturnType<typeof setTimeout> | undefined
  private controller: AbortController | null = null

  private readonly map: maplibregl.Map
  private readonly options: Options

  constructor(map: maplibregl.Map, options: Options = {}) {
    this.map = map
    this.options = options
    map.on('moveend', this.schedule)
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (enabled) {
      this.load()
    } else {
      this.cancel()
      this.clearMarkers()
      this.options.onStatus?.({ state: 'off' })
    }
  }

  /** Réaffiche les points (ex. après un changement de `isHidden`) */
  refresh() {
    if (this.enabled) this.render()
  }

  destroy() {
    this.cancel()
    this.clearMarkers()
    this.map.off('moveend', this.schedule)
  }

  private schedule = () => {
    if (!this.enabled) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.load(), LOAD_DELAY_MS)
  }

  private cancel() {
    clearTimeout(this.timer)
    this.controller?.abort()
    this.controller = null
  }

  private async load() {
    this.cancel()
    if (this.map.getZoom() < OSM_POI_MIN_ZOOM) {
      this.clearMarkers()
      this.options.onStatus?.({ state: 'zoom' })
      return
    }

    const bounds = this.map.getBounds()
    const controller = new AbortController()
    this.controller = controller
    this.options.onStatus?.({ state: 'loading' })
    try {
      this.pois = await fetchOsmPois(
        [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        controller.signal,
      )
      if (controller.signal.aborted || !this.enabled) return
      this.render()
    } catch (e) {
      if (controller.signal.aborted) return
      this.options.onStatus?.({
        state: 'error',
        message: e instanceof Error ? e.message : 'Points utiles indisponibles',
      })
    }
  }

  private render() {
    const visible = this.pois.filter((poi) => !this.options.isHidden?.(poi))
    const visibleIds = new Set(visible.map((poi) => poi.id))

    for (const [id, marker] of this.markers) {
      if (!visibleIds.has(id)) {
        marker.remove()
        this.markers.delete(id)
      }
    }
    for (const poi of visible) {
      if (!this.markers.has(poi.id)) this.markers.set(poi.id, this.createMarker(poi))
    }
    this.options.onStatus?.({ state: 'ready', count: visible.length })
  }

  private createMarker(poi: OsmPoi): maplibregl.Marker {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'osm-poi-marker'
    el.textContent = POI_ICONS[poi.type]
    el.title = poi.name === poi.kind ? poi.kind : `${poi.name} (${poi.kind})`
    el.setAttribute('aria-label', el.title)

    const marker = new maplibregl.Marker({ element: el }).setLngLat(poi.coordinates).addTo(this.map)
    const onSelect = this.options.onSelect
    if (onSelect) {
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelect(poi, marker)
      })
    } else {
      const lines = [poi.name, poi.name === poi.kind ? '' : poi.kind, poi.notes ?? '']
      marker.setPopup(
        new maplibregl.Popup({ offset: 14, closeButton: false }).setText(
          lines.filter(Boolean).join(' · '),
        ),
      )
    }
    return marker
  }

  private clearMarkers() {
    this.markers.forEach((marker) => marker.remove())
    this.markers.clear()
  }
}

/** Texte court décrivant l'état du calque, pour un bouton ou une légende */
export function osmPoiStatusLabel(status: OsmPoiStatus): string {
  switch (status.state) {
    case 'off':
      return ''
    case 'zoom':
      return 'Zoome pour voir les points utiles'
    case 'loading':
      return 'Chargement des points utiles…'
    case 'ready':
      return status.count
        ? `${status.count} point${status.count > 1 ? 's' : ''} utile${status.count > 1 ? 's' : ''}`
        : 'Aucun point utile ici'
    case 'error':
      return status.message
  }
}
