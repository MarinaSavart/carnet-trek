<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useTreksStore } from '../stores/treks'
import { useAuthStore } from '../stores/auth'
import EtapeFormCard from '../components/EtapeFormCard.vue'
import { ApiError } from '../api/treks'
import { formatDuration } from '../utils/format'
import {
  createEtapeDraft,
  createTrekDraft,
  draftToFormData,
  hasErrors,
  trekToDraft,
  validateTrekDraft,
  type TrekDraftErrors,
} from '../utils/trekForm'

// Même formulaire pour la création (/treks/new) et la modification (/treks/:id/modifier)
const route = useRoute()
const router = useRouter()
const store = useTreksStore()
const auth = useAuthStore()

const trekId = typeof route.params.id === 'string' ? route.params.id : null
const isEdit = trekId !== null

const draft = reactive(createTrekDraft())
// Modification : le trek est chargé avant d'afficher le formulaire
const isLoading = ref(isEdit)
const loadError = ref<string | null>(null)
// Passe à true à la première modification du brouillon (après chargement)
const isDirty = ref(false)

function trackChanges() {
  watch(draft, () => (isDirty.value = true), { deep: true, once: true })
}

onMounted(async () => {
  if (!trekId) {
    trackChanges()
    return
  }
  try {
    const trek = await store.loadTrek(trekId)
    if (!auth.canEdit(trek)) {
      loadError.value = "Seul l'auteur de ce trek peut le modifier."
      return
    }
    Object.assign(draft, trekToDraft(trek))
    await nextTick()
    trackChanges()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Chargement impossible'
  } finally {
    isLoading.value = false
  }
})

const backTo = isEdit ? `/treks/${trekId}` : '/'
// Les erreurs ne s'affichent qu'après une première tentative d'envoi, puis se mettent à jour
const submitted = ref(false)
const errors = computed<TrekDraftErrors>(() =>
  submitted.value ? validateTrekDraft(draft) : { byEtape: {} },
)
let saved = false
const isSubmitting = ref(false)
const serverError = ref<{ message: string; details: string[] } | null>(null)

const totals = computed(() => ({
  distanceKm: draft.etapes.reduce((sum, e) => sum + (e.distanceKm ?? 0), 0),
  durationMin: draft.etapes.reduce((sum, e) => sum + (e.durationMin ?? 0), 0),
}))

async function addEtape() {
  const etape = createEtapeDraft()
  draft.etapes.push(etape)
  await nextTick()
  document.getElementById(`etape-${etape.key}-name`)?.focus()
}

function moveEtape(index: number, direction: -1 | 1) {
  const [etape] = draft.etapes.splice(index, 1)
  if (etape) draft.etapes.splice(index + direction, 0, etape)
}

function removeEtape(index: number) {
  const etape = draft.etapes[index]
  if (!etape) return
  const hasContent = etape.id || etape.name.trim() || etape.gpx || etape.photos.length
  const message = etape.id
    ? `Supprimer l'étape « ${etape.name || index + 1} » ? Sa trace et ses photos seront supprimées à l'enregistrement.`
    : `Supprimer l'étape « ${etape.name || index + 1} » ?`
  if (hasContent && !window.confirm(message)) return
  etape.photos.forEach((p) => URL.revokeObjectURL(p.url))
  draft.etapes.splice(index, 1)
}

async function submit() {
  submitted.value = true
  if (hasErrors(validateTrekDraft(draft))) {
    // Amène l'utilisateur sur le premier champ en erreur
    await nextTick()
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }

  isSubmitting.value = true
  serverError.value = null
  try {
    const formData = draftToFormData(draft)
    const trek = trekId
      ? await store.updateTrek(trekId, formData)
      : await store.createTrek(formData)
    saved = true
    router.push(`/treks/${trek._id}`)
  } catch (e) {
    // Session expirée pendant la saisie : le brouillon reste là, il suffit de se reconnecter
    // (dans un autre onglet, pour ne rien perdre)
    const sessionExpired = e instanceof ApiError && e.status === 401
    serverError.value = {
      message: sessionExpired
        ? 'Ta session a expiré : reconnecte-toi dans un autre onglet, puis renvoie le formulaire.'
        : e instanceof Error
          ? e.message
          : 'Enregistrement impossible',
      details: e instanceof ApiError ? e.details : [],
    }
    await nextTick()
    document.getElementById('server-error')?.focus()
  } finally {
    isSubmitting.value = false
  }
}

onBeforeRouteLeave(() => {
  if (saved || !isDirty.value) return true
  return window.confirm('Quitter sans enregistrer ? Les modifications seront perdues.')
})

// Aperçus locaux : une fois le trek enregistré, les photos sont servies par le backend
onBeforeUnmount(() => {
  draft.etapes.forEach((e) => e.photos.forEach((p) => URL.revokeObjectURL(p.url)))
})
</script>

<template>
  <div v-if="isLoading || loadError" class="page page-status">
    <RouterLink :to="backTo" class="back-link">← Retour</RouterLink>
    <p :role="loadError ? 'alert' : 'status'">{{ loadError ?? 'Chargement…' }}</p>
  </div>

  <form v-else class="page" novalidate @submit.prevent="submit">
    <RouterLink :to="backTo" class="back-link"
      >← {{ isEdit ? 'Retour au trek' : 'Treks' }}</RouterLink
    >
    <h1>{{ isEdit ? 'Modifier le trek' : 'Nouveau trek' }}</h1>

    <section class="section" aria-labelledby="trek-section-title">
      <h2 id="trek-section-title" class="section-title">Le trek</h2>

      <div class="trek-fields">
        <div class="field">
          <label for="trek-name" class="field-label">Nom du trek *</label>
          <input
            id="trek-name"
            v-model="draft.name"
            class="input"
            placeholder="Ex. Laugavegur & Fimmvörðuháls"
            :aria-invalid="Boolean(errors.name)"
          />
          <p v-if="errors.name" class="field-error">{{ errors.name }}</p>
        </div>

        <div class="field">
          <label for="trek-region" class="field-label">
            Région <span class="field-hint">(facultatif)</span>
          </label>
          <input
            id="trek-region"
            v-model="draft.region"
            class="input"
            placeholder="Ex. Hautes Terres, Islande"
          />
        </div>

        <div class="field span-2">
          <label for="trek-description" class="field-label">
            Description <span class="field-hint">(facultatif)</span>
          </label>
          <textarea
            id="trek-description"
            v-model="draft.description"
            class="textarea"
            placeholder="L'itinéraire en quelques mots, la période, l'autonomie…"
          />
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="etapes-section-title">
      <h2 id="etapes-section-title" class="section-title">
        Étapes <span class="count">{{ draft.etapes.length }}</span>
      </h2>
      <p v-if="errors.etapes" class="field-error">{{ errors.etapes }}</p>

      <TransitionGroup tag="ol" name="etape" class="etapes">
        <li v-for="(etape, index) in draft.etapes" :key="etape.key">
          <EtapeFormCard
            v-model="draft.etapes[index]!"
            :index="index"
            :count="draft.etapes.length"
            :errors="errors.byEtape[etape.key]"
            :previous-track="draft.etapes[index - 1]?.track"
            :next-track="draft.etapes[index + 1]?.track"
            @move="moveEtape(index, $event)"
            @remove="removeEtape(index)"
          />
        </li>
      </TransitionGroup>

      <button type="button" class="btn add-etape" @click="addEtape">+ Ajouter une étape</button>
    </section>

    <div v-if="serverError" id="server-error" class="server-error" role="alert" tabindex="-1">
      <strong>{{ serverError.message }}</strong>
      <ul v-if="serverError.details.length">
        <li v-for="detail in serverError.details" :key="detail">{{ detail }}</li>
      </ul>
    </div>

    <footer class="footer">
      <p class="summary">
        {{ draft.etapes.length }} étape{{ draft.etapes.length > 1 ? 's' : '' }} ·
        {{ totals.distanceKm.toFixed(1) }} km · {{ formatDuration(totals.durationMin) }}
      </p>
      <div class="footer-actions">
        <RouterLink :to="backTo" class="btn">Annuler</RouterLink>
        <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
          {{
            isSubmitting
              ? 'Enregistrement…'
              : isEdit
                ? 'Enregistrer les modifications'
                : 'Créer le trek'
          }}
        </button>
      </div>
    </footer>
  </form>
</template>

<style scoped>
.page-status {
  color: var(--color-text-muted);
}
.page {
  max-width: 820px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md) 0;
}
h1 {
  margin: var(--space-xs) 0 var(--space-md);
}
.section {
  margin-bottom: var(--space-lg);
}
.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
  font-size: 1.6rem;
}
.count {
  display: inline-grid;
  place-items: center;
  min-width: 1.6rem;
  height: 1.6rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--color-surface-raised);
  font-family: var(--font-body);
  font-size: 0.85rem;
}
.trek-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
}
.span-2 {
  grid-column: span 2;
}
@media (max-width: 520px) {
  .trek-fields {
    grid-template-columns: minmax(0, 1fr);
  }
  .span-2 {
    grid-column: auto;
  }
}
.etapes {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  list-style: none;
  padding: 0;
  margin: 0;
}
.add-etape {
  width: 100%;
  margin-top: var(--space-md);
  border-style: dashed;
}

/* Réordonnancement et ajout animés */
.etape-move,
.etape-enter-active,
.etape-leave-active {
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}
.etape-enter-from,
.etape-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.etape-leave-active {
  position: absolute;
}

/* Barre d'actions toujours visible en bas de l'écran */
.footer {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  border-top: var(--border-hairline);
  background: var(--color-bg);
}
.summary {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
.server-error {
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
.server-error ul {
  margin: var(--space-xs) 0 0;
  padding-left: 1.25rem;
}
.footer-actions {
  display: flex;
  gap: var(--space-xs);
}
@media (prefers-reduced-motion: reduce) {
  .etape-move,
  .etape-enter-active,
  .etape-leave-active {
    transition: none;
  }
}
</style>
