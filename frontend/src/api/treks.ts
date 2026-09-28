import type { Trek, TrekSummary } from '../types/trek'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

// Les fichiers (photos, GPX) sont servis par le backend sous /uploads, à côté de l'API :
// l'URL relative renvoyée est complétée avec l'origine de l'API.
const API_ORIGIN = new URL(API_URL).origin

function absoluteUrl(url: string): string {
  return url.startsWith('/') ? `${API_ORIGIN}${url}` : url
}

export class ApiError extends Error {
  readonly status: number
  readonly details: string[]

  constructor(status: number, message: string, details: string[] = []) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, init)
  } catch {
    throw new ApiError(0, 'Serveur injoignable. Vérifie que le backend est lancé.')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body.error ?? `Erreur ${response.status}`, body.details)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

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

export async function deleteTrek(id: string): Promise<void> {
  await request<void>(`/treks/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
