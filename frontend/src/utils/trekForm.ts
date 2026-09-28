import type { Difficulty, Trek } from '../types/trek'
import type { ParsedGpx } from './gpx'

export interface PhotoDraft {
  id: string
  file: File
  /** URL locale (object URL) pour l'aperçu, à libérer quand la photo est retirée */
  url: string
}

/** Photo déjà enregistrée sur le serveur (modification d'un trek) */
export interface ExistingPhoto {
  id: string
  url: string
  name: string
}

export interface EtapeDraft {
  key: string
  /** Identifiant de l'étape en base ; null pour une nouvelle étape */
  id: string | null
  name: string
  description: string
  difficulty: Difficulty
  /** Fichier d'origine, envoyé tel quel au serveur */
  gpxFile: File | null
  /** Analyse locale, pour pré-remplir les stats et afficher un résumé */
  gpx: ParsedGpx | null
  distanceKm: number | null
  elevationGain: number | null
  elevationLoss: number | null
  durationMin: number | null
  /** Nouvelles photos, pas encore envoyées */
  photos: PhotoDraft[]
  /** Modification : photos déjà en ligne, conservées tant qu'elles restent dans la liste */
  existingPhotos: ExistingPhoto[]
  /** Modification : l'étape avait une trace GPX au chargement du formulaire */
  hadGpx: boolean
  /** Modification : nom de la trace GPX actuelle, null si retirée (ou remplacée) */
  existingGpxName: string | null
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
    id: null,
    name: '',
    description: '',
    difficulty: 'moyen',
    gpxFile: null,
    gpx: null,
    distanceKm: null,
    elevationGain: null,
    elevationLoss: null,
    durationMin: null,
    photos: [],
    existingPhotos: [],
    hadGpx: false,
    existingGpxName: null,
  }
}

/** Pré-remplit le formulaire avec un trek existant (modification) */
export function trekToDraft(trek: Trek): TrekDraft {
  return {
    name: trek.name,
    region: trek.region ?? '',
    description: trek.description ?? '',
    etapes: [...trek.etapes]
      .sort((a, b) => a.order - b.order)
      .map((etape) => ({
        ...createEtapeDraft(),
        id: etape._id,
        name: etape.name,
        description: etape.description ?? '',
        difficulty: etape.difficulty,
        distanceKm: etape.distanceKm,
        elevationGain: etape.elevationGain,
        elevationLoss: etape.elevationLoss,
        durationMin: etape.durationMin,
        existingPhotos: (etape.photos ?? []).map((photo) => ({
          id: photo._id,
          url: photo.url,
          name: photo.originalName ?? 'Photo',
        })),
        hadGpx: Boolean(etape.gpxFile),
        existingGpxName: etape.gpxFile?.originalName ?? null,
      })),
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

/**
 * Corps multipart attendu par POST /api/treks (création) et PUT /api/treks/:id (modification) :
 *   data                → JSON du trek (les stats saisies priment sur celles du GPX)
 *   etapes[i][gpx]      → fichier GPX d'origine, analysé à nouveau par le serveur
 *   etapes[i][photos]   → photos de l'étape
 */
export function draftToFormData(draft: TrekDraft): FormData {
  const formData = new FormData()
  const data = {
    name: draft.name.trim(),
    region: draft.region.trim(),
    description: draft.description.trim(),
    etapes: draft.etapes.map((etape) => ({
      // Modification : étape existante, trace à retirer, photos à conserver
      ...(etape.id && {
        _id: etape.id,
        removeGpx: etape.hadGpx && !etape.existingGpxName && !etape.gpxFile,
        keepPhotoIds: etape.existingPhotos.map((photo) => photo.id),
      }),
      name: etape.name.trim(),
      description: etape.description.trim(),
      difficulty: etape.difficulty,
      distanceKm: etape.distanceKm,
      elevationGain: etape.elevationGain,
      elevationLoss: etape.elevationLoss,
      durationMin: etape.durationMin,
    })),
  }
  formData.append('data', JSON.stringify(data))

  draft.etapes.forEach((etape, index) => {
    if (etape.gpxFile) formData.append(`etapes[${index}][gpx]`, etape.gpxFile)
    etape.photos.forEach((photo) => formData.append(`etapes[${index}][photos]`, photo.file))
  })
  return formData
}
