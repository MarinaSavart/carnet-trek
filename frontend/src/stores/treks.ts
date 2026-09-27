import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Trek {
  _id: string
  name: string
  distanceKm: number
  elevationGain: number
  date?: string
  notes?: string
}

export const useTreksStore = defineStore('treks', () => {
  const treks = ref<Trek[]>([])

  const totalDistance = computed(() =>
    treks.value.reduce((sum, t) => sum + t.distanceKm, 0)
  )

  function addTrek(trek: Trek) {
    treks.value.push(trek)
  }

  function removeTrek(id: string) {
    treks.value = treks.value.filter(t => t._id !== id)
  }

  return { treks, totalDistance, addTrek, removeTrek }
})