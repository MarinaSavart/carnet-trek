import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Etape } from '../types/trek'
import {
  defaultNights,
  isDefaultNights,
  mergeEtapes,
  parseDecoupage,
  serializeDecoupage,
} from '../utils/decoupage'

/**
 * Découpage affiché d'un trek. Il vit dans l'URL (?decoupage=1-2,3,4-5) : partageable
 * par lien, conservé au rafraîchissement et d'une page étape à l'autre, sans compte.
 */
export function useDecoupage(etapes: MaybeRefOrGetter<Etape[]>) {
  const route = useRoute()
  const router = useRouter()

  const nights = computed(() => {
    const count = toValue(etapes).length
    return parseDecoupage(route.query.decoupage, count) ?? defaultNights(count)
  })
  const isCustom = computed(() => !isDefaultNights(nights.value))
  const displayEtapes = computed(() => mergeEtapes(toValue(etapes), nights.value))

  /** Paramètres à reporter sur les liens internes au trek pour garder le découpage */
  const query = computed(() => {
    const decoupage = serializeDecoupage(nights.value)
    return decoupage ? { decoupage } : {}
  })

  function setNights(next: boolean[]) {
    const decoupage = serializeDecoupage(next) ?? undefined
    router.replace({ query: { ...route.query, decoupage } })
  }

  function toggleNight(index: number) {
    setNights(nights.value.map((night, i) => (i === index ? !night : night)))
  }

  function reset() {
    setNights(defaultNights(toValue(etapes).length))
  }

  return { nights, isCustom, displayEtapes, query, setNights, toggleNight, reset }
}
