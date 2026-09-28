import { ref } from 'vue'
import type { Trek } from '../types/trek'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export function useTreks() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTreks(): Promise<Trek[]> {
    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_URL}/treks`)
      if (!response.ok) throw new Error('Réponse serveur invalide')
      return await response.json()
    } catch (e) {
      error.value = 'Erreur lors du chargement des randos'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function createTrek(trek: Omit<Trek, '_id'>): Promise<Trek> {
    const response = await fetch(`${API_URL}/treks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trek),
    })
    if (!response.ok) throw new Error('Création échouée')
    return await response.json()
  }

  async function deleteTrek(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/treks/${id}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('Suppression échouée')
  }

  return { isLoading, error, fetchTreks, createTrek, deleteTrek }
}
