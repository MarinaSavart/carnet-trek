import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Trek, Etape } from '../types/trek'
import { mockTreks } from '../data/mockTreks'
import { withEtapeAssets } from '../data/etapeAssets'

export const useTreksStore = defineStore('treks', () => {
  const treks = ref<Trek[]>(withEtapeAssets(mockTreks))

  function getTrekById(id: string): Trek | undefined {
    return treks.value.find((t) => t._id === id)
  }

  function getEtapeById(etapeId: string): Etape | undefined {
    for (const trek of treks.value) {
      const etape = trek.etapes.find((e) => e._id === etapeId)
      if (etape) return etape
    }
    return undefined
  }

  function getTrekByEtapeId(etapeId: string): Trek | undefined {
    return treks.value.find((t) => t.etapes.some((e) => e._id === etapeId))
  }

  const totalDistanceByTrek = computed(() => {
    const totals = new Map<string, number>()
    treks.value.forEach((trek) => {
      const total = trek.etapes.reduce((sum, e) => sum + e.distanceKm, 0)
      totals.set(trek._id, total)
    })
    return totals
  })

  return { treks, getTrekById, getEtapeById, getTrekByEtapeId, totalDistanceByTrek }
})
