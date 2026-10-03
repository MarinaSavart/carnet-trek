import type { Etape, POI } from '../types/trek'
import { canCut, locateOnTrack, pieceStats, trackLengthKm } from './etapeGeometry'
import { defaultNights, normalizeCuts, type Cut, type Decoupage } from './decoupage'
import { loadedOsmPois } from './overpass'

// « Propose-moi un découpage en N jours » : choisit les N − 1 nuits qui équilibrent les
// journées, à part égale sur la durée de marche et sur la distance.
//
// Nuits possibles : la fin de chaque étape, les hébergements (refuges, cabanes,
// campings) le long de la trace, et — si on l'autorise — n'importe quel point.
// Le meilleur choix est trouvé par programmation dynamique : d'abord la journée la plus
// chargée la plus légère possible, puis les journées les plus régulières.

export interface ProposeOptions {
  days: number
  /** Dormir seulement en fin d'étape ou dans un hébergement */
  lodgingOnly: boolean
}

export type ProposeResult =
  { ok: true; decoupage: Decoupage } | { ok: false; message: string; maxDays: number }

interface Stop {
  /** Distance et durée cumulées depuis le départ du trek */
  distanceKm: number
  durationMin: number
  /** Fin d'étape (index de l'étape) ou coupe dans une étape */
  boundary?: number
  cut?: Cut
}

const LODGING_TYPES: POI['type'][] = ['refuge', 'camping']
// Un hébergement à plus de 300 m de la trace n'est pas sur le chemin
const MAX_LODGING_OFFSET_KM = 0.3
// Nuits libres : un point tous les ~ 500 m, 400 au plus (temps de calcul)
const MAX_FREE_STOPS = 400

function lodgingKms(etape: Etape): number[] {
  const coordinates = etape.gpxTrack?.coordinates ?? []
  // Rectangle de la trace, élargi : écarte vite les points utiles d'autres régions
  const lons = coordinates.map((c) => c[0])
  const lats = coordinates.map((c) => c[1])
  const margin = 0.01
  const [west, east] = [Math.min(...lons) - margin, Math.max(...lons) + margin]
  const [south, north] = [Math.min(...lats) - margin, Math.max(...lats) + margin]

  const candidates = [
    ...etape.pois
      .filter((poi) => LODGING_TYPES.includes(poi.type))
      .map((poi) => poi.location.coordinates),
    ...loadedOsmPois()
      .filter((poi) => LODGING_TYPES.includes(poi.type))
      .map((poi) => poi.coordinates)
      .filter(([lon, lat]) => lon >= west && lon <= east && lat >= south && lat <= north),
  ]
  return candidates.flatMap((point) => {
    const located = locateOnTrack(etape, point)
    return located && located.offsetKm <= MAX_LODGING_OFFSET_KM ? [located.km] : []
  })
}

function collectStops(etapes: Etape[], lodgingOnly: boolean) {
  const totalKm = etapes.reduce((sum, e) => sum + trackLengthKm(e), 0)
  const freeStepKm = Math.max(0.5, totalKm / MAX_FREE_STOPS)

  const stops: Stop[] = []
  let distanceKm = 0
  let durationMin = 0
  etapes.forEach((etape, index) => {
    if (canCut(etape)) {
      const length = trackLengthKm(etape)
      const kms = lodgingKms(etape)
      if (!lodgingOnly) {
        for (let km = freeStepKm; km < length; km += freeStepKm) kms.push(km)
      }
      const cuts = normalizeCuts(
        kms.map((km) => ({ etape: index, km })),
        etapes,
      )
      for (const cut of cuts) {
        const stats = pieceStats(etape, 0, cut.km)
        stops.push({
          distanceKm: distanceKm + stats.distanceKm,
          durationMin: durationMin + stats.durationMin,
          cut,
        })
      }
    }
    distanceKm += etape.distanceKm
    durationMin += etape.durationMin
    if (index < etapes.length - 1) stops.push({ distanceKm, durationMin, boundary: index })
  })
  return { stops, totalDistance: distanceKm, totalDuration: durationMin }
}

interface Best {
  /** Journée la plus chargée */
  max: number
  /** Somme des carrés : départage les solutions, en faveur des journées régulières */
  squares: number
  previous: number
}

const isBetter = (a: Best, b: Best | undefined) =>
  !b || a.max < b.max - 1e-9 || (Math.abs(a.max - b.max) <= 1e-9 && a.squares < b.squares)

export function proposeDecoupage(
  etapes: Etape[],
  { days, lodgingOnly }: ProposeOptions,
): ProposeResult {
  const { stops, totalDistance, totalDuration } = collectStops(etapes, lodgingOnly)
  const maxDays = stops.length + 1
  if (days > maxDays) {
    return {
      ok: false,
      maxDays,
      message: lodgingOnly
        ? `Pas assez de nuits possibles en fin d'étape ou en hébergement : ${maxDays} jours au plus. Autorise les nuits n'importe où pour aller au-delà.`
        : `Ce trek ne peut pas être découpé en plus de ${maxDays} jours.`,
    }
  }

  // Charge d'une journée : moitié durée, moitié distance, chacune rapportée à la moyenne
  const meanDuration = totalDuration / days || 1
  const meanDistance = totalDistance / days || 1
  const points: Stop[] = [
    { distanceKm: 0, durationMin: 0 },
    ...stops,
    { distanceKm: totalDistance, durationMin: totalDuration },
  ]
  const load = (from: Stop, to: Stop) =>
    0.5 * ((to.durationMin - from.durationMin) / meanDuration) +
    0.5 * ((to.distanceKm - from.distanceKm) / meanDistance)

  // best[d][j] : meilleure façon de couvrir le début du trek jusqu'au point j en d journées
  const last = points.length - 1
  const best: (Best | undefined)[][] = [[{ max: 0, squares: 0, previous: -1 }]]
  for (let d = 1; d <= days; d++) {
    best[d] = []
    // Il faut garder assez de points pour les journées restantes
    for (let j = d; j <= last - (days - d); j++) {
      for (let i = d - 1; i < j; i++) {
        const before = best[d - 1]![i]
        if (!before) continue
        const value = load(points[i]!, points[j]!)
        const candidate = {
          max: Math.max(before.max, value),
          squares: before.squares + value * value,
          previous: i,
        }
        if (isBetter(candidate, best[d]![j])) best[d]![j] = candidate
      }
    }
  }

  // Remonte les nuits choisies
  const nights = defaultNights(etapes.length).map(() => false)
  const cuts: Cut[] = []
  let j = last
  for (let d = days; d > 1; d--) {
    const i = best[d]![j]!.previous
    const stop = points[i]!
    if (stop.boundary !== undefined) nights[stop.boundary] = true
    if (stop.cut) cuts.push(stop.cut)
    j = i
  }
  return {
    ok: true,
    decoupage: { nights, cuts: cuts.sort((a, b) => a.etape - b.etape || a.km - b.km) },
  }
}
