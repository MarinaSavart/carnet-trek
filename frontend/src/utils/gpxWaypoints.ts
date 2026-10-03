import type { POI, POIType } from '../types/trek'

// Écriture GPX commune à l'export (trek, journée) et à l'éditeur de trace.
//
// Type d'un point d'intérêt, écrit de trois façons pour être compris partout :
// - en préfixe du nom (« EAU · Source de la Coma ») : beaucoup de montres (Coros, testé)
//   ignorent le type et n'affichent que le nom ;
// - `<sym>` : noms de symboles Garmin, la convention la plus répandue (Garmin, Komoot,
//   OsmAnd…) ;
// - `<type>` : en clair, pour les applis qui l'affichent.
// À l'import (gpx.ts, front et serveur), le préfixe est retiré et sert à retrouver le type
// si `<sym>` manque : un point exporté puis réimporté garde son nom et son type.
const POI_GPX: Record<POIType, { sym: string; type: string; prefix: string | null }> = {
  point_eau: { sym: 'Drinking Water', type: 'Eau', prefix: 'EAU' },
  refuge: { sym: 'Lodging', type: 'Refuge', prefix: 'REFUGE' },
  camping: { sym: 'Campground', type: 'Camping', prefix: 'CAMPING' },
  sommet: { sym: 'Summit', type: 'Sommet', prefix: 'SOMMET' },
  ravitaillement: { sym: 'Shopping Center', type: 'Ravitaillement', prefix: 'RAVITO' },
  autre: { sym: 'Flag, Blue', type: 'Autre', prefix: null },
}

const PREFIX_SEPARATOR = ' · '

/**
 * Seuls &, < et > (et " dans un attribut) doivent être échappés. Les entités numériques
 * (&#39;) sont valides mais certaines montres (Coros) les affichent telles quelles.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function poiWaypointXml(poi: POI, indent = '  '): string {
  const [lon, lat] = poi.location.coordinates
  const { sym, type, prefix } = POI_GPX[poi.type]
  const alreadyPrefixed = prefix && poi.name.startsWith(prefix + PREFIX_SEPARATOR)
  const name = prefix && !alreadyPrefixed ? `${prefix}${PREFIX_SEPARATOR}${poi.name}` : poi.name
  return [
    `${indent}<wpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">`,
    `<name>${escapeXml(name)}</name>`,
    poi.notes ? `<desc>${escapeXml(poi.notes)}</desc>` : '',
    `<sym>${sym}</sym>`,
    `<type>${type}</type>`,
    '</wpt>',
  ].join('')
}
