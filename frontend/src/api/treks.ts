import type { Trek, TrekSummary } from '../types/trek'
import { absoluteUrl, request } from './http'

export { ApiError } from './http'

function withAbsoluteUrls(trek: Trek): Trek {
  return {
    ...trek,
    // `?? []` : des treks créés avec l'ancien modèle n'ont pas d'étapes
    etapes: (trek.etapes ?? []).map((etape) => ({
      ...etape,
      photos: etape.photos?.map((photo) => ({ ...photo, url: absoluteUrl(photo.url) })),
    })),
  }
}

export async function fetchTrekSummaries(): Promise<TrekSummary[]> {
  const treks = await request<TrekSummary[]>('/treks')
  return treks.map((trek) => ({
    ...trek,
    coverPhotoUrl: trek.coverPhotoUrl && absoluteUrl(trek.coverPhotoUrl),
  }))
}

export async function fetchTrek(id: string): Promise<Trek> {
  return withAbsoluteUrls(await request<Trek>(`/treks/${encodeURIComponent(id)}`))
}

/** Création en multipart : JSON du trek dans `data`, fichiers dans etapes[i][gpx|photos] */
export async function createTrek(formData: FormData): Promise<Trek> {
  return withAbsoluteUrls(await request<Trek>('/treks', { method: 'POST', body: formData }))
}

/** Modification, même format que la création (voir utils/trekForm.ts) */
export async function updateTrek(id: string, formData: FormData): Promise<Trek> {
  return withAbsoluteUrls(
    await request<Trek>(`/treks/${encodeURIComponent(id)}`, { method: 'PUT', body: formData }),
  )
}

export async function deleteTrek(id: string): Promise<void> {
  await request<void>(`/treks/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
