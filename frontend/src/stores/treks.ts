import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '../api/treks'
import type { Trek, TrekSummary } from '../types/trek'

export interface MapView {
  center: [number, number]
  zoom: number
}

export const useTreksStore = defineStore('treks', () => {
  const summaries = ref<TrekSummary[]>([])
  // Treks complets déjà chargés : revenir sur un trek ou passer d'une étape à l'autre
  // ne refait pas l'appel (le détail pèse ~200 Ko avec les tracés)
  const treksById = ref(new Map<string, Trek>())
  // Dernière vue de la carte d'accueil : on la retrouve en revenant d'une page trek
  const homeMapView = ref<MapView | null>(null)

  async function loadSummaries(): Promise<void> {
    summaries.value = await api.fetchTrekSummaries()
  }

  async function loadTrek(id: string): Promise<Trek> {
    const cached = treksById.value.get(id)
    if (cached) return cached
    const trek = await api.fetchTrek(id)
    treksById.value.set(id, trek)
    return trek
  }

  async function createTrek(formData: FormData): Promise<Trek> {
    const trek = await api.createTrek(formData)
    treksById.value.set(trek._id, trek)
    return trek
  }

  async function updateTrek(id: string, formData: FormData): Promise<Trek> {
    const trek = await api.updateTrek(id, formData)
    treksById.value.set(trek._id, trek)
    return trek
  }

  async function deleteTrek(id: string): Promise<void> {
    await api.deleteTrek(id)
    treksById.value.delete(id)
    summaries.value = summaries.value.filter((t) => t._id !== id)
  }

  return { summaries, homeMapView, loadSummaries, loadTrek, createTrek, updateTrek, deleteTrek }
})
