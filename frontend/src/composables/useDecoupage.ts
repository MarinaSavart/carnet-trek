import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Etape } from '../types/trek'
import {
  dayCount,
  defaultDecoupage,
  defaultNights,
  isDefaultDecoupage,
  mergeEtapes,
  normalizeCuts,
  parseCuts,
  parseNights,
  serializeCuts,
  serializeNights,
  type Decoupage,
} from '../utils/decoupage'

/**
 * Découpage affiché d'un trek. Il vit dans l'URL (?decoupage=1-2,3,4-5&coupes=3@8.20) :
 * partageable par lien, conservé au rafraîchissement et d'une page étape à l'autre,
 * sans compte.
 */
export function useDecoupage(etapes: MaybeRefOrGetter<Etape[]>) {
  const route = useRoute()
  const router = useRouter()

  const decoupage = computed<Decoupage>(() => {
    const list = toValue(etapes)
    return {
      nights: parseNights(route.query.decoupage, list.length) ?? defaultNights(list.length),
      cuts: parseCuts(route.query.coupes, list),
    }
  })
  const isCustom = computed(() => !isDefaultDecoupage(decoupage.value))
  const days = computed(() => dayCount(decoupage.value))
  const displayEtapes = computed(() => mergeEtapes(toValue(etapes), decoupage.value))

  function toQuery({ nights, cuts }: Decoupage) {
    return {
      decoupage: serializeNights(nights) ?? undefined,
      coupes: serializeCuts(cuts) ?? undefined,
    }
  }

  /** Paramètres à reporter sur les liens internes au trek pour garder le découpage */
  const query = computed(() => {
    const { decoupage: nights, coupes } = toQuery(decoupage.value)
    return { ...(nights && { decoupage: nights }), ...(coupes && { coupes }) }
  })

  function setDecoupage(next: Decoupage) {
    const cuts = normalizeCuts(next.cuts, toValue(etapes))
    router.replace({ query: { ...route.query, ...toQuery({ nights: next.nights, cuts }) } })
  }

  function toggleNight(index: number) {
    const { nights, cuts } = decoupage.value
    setDecoupage({ nights: nights.map((night, i) => (i === index ? !night : night)), cuts })
  }

  /** Nuit au milieu d'une étape (position de l'étape, km sur sa trace) */
  function addCut(etape: number, km: number) {
    const { nights, cuts } = decoupage.value
    setDecoupage({ nights, cuts: [...cuts, { etape, km }] })
  }

  function removeCut(etape: number, km: number) {
    const { nights, cuts } = decoupage.value
    setDecoupage({ nights, cuts: cuts.filter((c) => c.etape !== etape || c.km !== km) })
  }

  function reset() {
    setDecoupage(defaultDecoupage(toValue(etapes).length))
  }

  return {
    decoupage,
    isCustom,
    days,
    displayEtapes,
    query,
    setDecoupage,
    toggleNight,
    addCut,
    removeCut,
    reset,
  }
}
