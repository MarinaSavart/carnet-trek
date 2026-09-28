import type { Difficulty, Trek } from '../types/trek'
import type { ParsedGpx } from './gpx'

export interface PhotoDraft {
  id: string
  file: File
  /** URL locale (object URL) pour l'aperçu, à libérer quand la photo est retirée */
  url: string
}

export interface EtapeDraft {
  key: string
  name: string
  description: string
  difficulty: Difficulty
  gpxFileName: string | null
  gpx: ParsedGpx | null
  distanceKm: number | null
  elevationGain: number | null
  elevationLoss: number | null
  durationMin: number | null
  photos: PhotoDraft[]
}

export interface TrekDraft {
  name: string
  region: string
  description: string
  etapes: EtapeDraft[]
}

export type EtapeErrors = Partial<Record<'name' | 'distanceKm' | 'durationMin', string>>

export interface TrekDraftErrors {
  name?: string
  etapes?: string
  byEtape: Record<string, EtapeErrors>
}

export function createEtapeDraft(): EtapeDraft {
  return {
    key: crypto.randomUUID(),
    name: '',
    description: '',
    difficulty: 'moyen',
    gpxFileName: null,
    gpx: null,
    distanceKm: null,
    elevationGain: null,
    elevationLoss: null,
    durationMin: null,
    photos: [],
  }
}

export function createTrekDraft(): TrekDraft {
  return { name: '', region: '', description: '', etapes: [createEtapeDraft()] }
}

export function validateTrekDraft(draft: TrekDraft): TrekDraftErrors {
  const errors: TrekDraftErrors = { byEtape: {} }

  if (!draft.name.trim()) errors.name = 'Le nom du trek est obligatoire'
  if (!draft.etapes.length) errors.etapes = 'Ajoute au moins une étape'

  for (const etape of draft.etapes) {
    const etapeErrors: EtapeErrors = {}
    if (!etape.name.trim()) etapeErrors.name = "Le nom de l'étape est obligatoire"
    // Sans GPX, les stats sont saisies à la main : la distance et la durée sont le minimum
    if (!etape.distanceKm || etape.distanceKm <= 0) {
      etapeErrors.distanceKm = 'Distance requise (ou ajoute un fichier GPX)'
    }
    if (!etape.durationMin || etape.durationMin <= 0) {
      etapeErrors.durationMin = 'Durée requise (ou ajoute un fichier GPX)'
    }
    if (Object.keys(etapeErrors).length) errors.byEtape[etape.key] = etapeErrors
  }

  return errors
}

export function hasErrors(errors: TrekDraftErrors): boolean {
  return Boolean(errors.name || errors.etapes || Object.keys(errors.byEtape).length)
}

export function draftToTrek(draft: TrekDraft): Trek {
  const trekId = crypto.randomUUID()
  return {
    _id: trekId,
    name: draft.name.trim(),
    region: draft.region.trim(),
    description: draft.description.trim(),
    etapes: draft.etapes.map((etape, index) => ({
      _id: crypto.randomUUID(),
      order: index + 1,
      name: etape.name.trim(),
      description: etape.description.trim() || undefined,
      difficulty: etape.difficulty,
      distanceKm: etape.distanceKm ?? 0,
      elevationGain: etape.elevationGain ?? 0,
      elevationLoss: etape.elevationLoss ?? 0,
      durationMin: etape.durationMin ?? 0,
      gpxTrack: etape.gpx?.track,
      elevationProfile: etape.gpx?.elevationProfile,
      pois: etape.gpx?.waypoints ?? [],
      photos: etape.photos.map((photo) => ({ _id: photo.id, url: photo.url })),
    })),
  }
}
