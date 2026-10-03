import { ref, watch, type MaybeRefOrGetter, toValue } from 'vue'
import * as api from '../api/variantes'
import { useAuthStore } from '../stores/auth'
import type { Variante } from '../types/trek'

/**
 * Découpages proposés pour un trek, visibles par tous. Rechargés à la connexion /
 * déconnexion : les droits de suppression en dépendent.
 */
export function useVariantes(trekId: MaybeRefOrGetter<string | undefined>) {
  const auth = useAuthStore()
  const variantes = ref<Variante[]>([])

  watch(
    () => [toValue(trekId), auth.isAuthenticated] as const,
    async ([id], previous) => {
      // Autre trek : on n'affiche pas ses découpages le temps du chargement
      if (id !== previous?.[0]) variantes.value = []
      if (!id) return
      try {
        const loaded = await api.fetchVariantes(id)
        // Ignore une réponse arrivée après un changement de trek
        if (toValue(trekId) === id) variantes.value = loaded
      } catch {
        // Pas bloquant : le trek reste consultable sans les variantes
      }
    },
    { immediate: true },
  )

  async function save(groups: string[][]): Promise<Variante> {
    const id = toValue(trekId)
    if (!id) throw new Error('Trek non chargé')
    const variante = await api.createVariante(id, groups)
    // Découpage déjà proposé par quelqu'un d'autre : l'API renvoie l'existant
    if (!variantes.value.some((v) => v._id === variante._id)) {
      variantes.value = [...variantes.value, variante].sort(
        (a, b) => b.groups.length - a.groups.length,
      )
    }
    return variante
  }

  async function remove(varianteId: string): Promise<void> {
    const id = toValue(trekId)
    if (!id) return
    await api.deleteVariante(id, varianteId)
    variantes.value = variantes.value.filter((v) => v._id !== varianteId)
  }

  return { variantes, save, remove }
}
