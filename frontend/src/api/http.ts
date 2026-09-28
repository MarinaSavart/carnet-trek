// Par défaut, l'API est servie sur la même origine que le front (proxy de Vite) :
// le cookie de session est alors envoyé naturellement.
export const API_URL = import.meta.env.VITE_API_URL ?? '/api'

// Si l'API est sur une autre origine (VITE_API_URL absolue), les fichiers envoyés
// (/uploads/…) doivent être préfixés de cette origine.
const API_ORIGIN = /^https?:\/\//.test(API_URL) ? new URL(API_URL).origin : ''

export function absoluteUrl(url: string): string {
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

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Exigé par l'API sur les requêtes qui modifient des données (protection CSRF)
  const headers = new Headers(init.headers)
  if (init.method && init.method !== 'GET') headers.set('X-Requested-With', 'carnet-trek')

  let response: Response
  try {
    // credentials : envoie le cookie de session, y compris si l'API est sur une autre origine
    response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'Serveur injoignable. Vérifie que le backend est lancé.')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body.error ?? `Erreur ${response.status}`, body.details)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

/** Corps JSON avec le bon en-tête */
export function jsonBody(data: unknown): RequestInit {
  return { body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }
}
