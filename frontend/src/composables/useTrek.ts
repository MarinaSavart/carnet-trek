import { ref, shallowRef, watch, type MaybeRefOrGetter, toValue } from 'vue'
import { ApiError } from '../api/treks'
import { useTreksStore } from '../stores/treks'
import type { Trek } from '../types/trek'

/** Charge un trek complet et suit l'identifiant (changement de route sans démontage) */
export function useTrek(id: MaybeRefOrGetter<string>) {
  const store = useTreksStore()
  const trek = shallowRef<Trek | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  watch(
    () => toValue(id),
    async (currentId) => {
      error.value = null
      // On garde le trek affiché s'il reste le même (navigation entre ses étapes)
      if (trek.value?._id !== currentId) trek.value = null
      isLoading.value = true
      try {
        const loaded = await store.loadTrek(currentId)
        // Ignore une réponse arrivée après un nouveau changement d'identifiant
        if (toValue(id) === currentId) trek.value = loaded
      } catch (e) {
        if (toValue(id) !== currentId) return
        error.value =
          e instanceof ApiError && e.status === 404
            ? 'Trek introuvable'
            : e instanceof Error
              ? e.message
              : 'Erreur de chargement'
      } finally {
        if (toValue(id) === currentId) isLoading.value = false
      }
    },
    { immediate: true },
  )

  return { trek, isLoading, error }
}
