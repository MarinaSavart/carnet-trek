import type { Variante } from '../types/trek'
import { jsonBody, request } from './http'

const base = (trekId: string) => `/treks/${encodeURIComponent(trekId)}/variantes`

/** Découpages proposés pour ce trek, par tous les utilisateurs */
export async function fetchVariantes(trekId: string): Promise<Variante[]> {
  return request<Variante[]>(base(trekId))
}

/** Enregistre un découpage ; s'il existe déjà, l'API renvoie l'existant */
export async function createVariante(trekId: string, groups: string[][]): Promise<Variante> {
  return request<Variante>(base(trekId), { method: 'POST', ...jsonBody({ groups }) })
}

export async function deleteVariante(trekId: string, varianteId: string): Promise<void> {
  await request<void>(`${base(trekId)}/${encodeURIComponent(varianteId)}`, { method: 'DELETE' })
}
