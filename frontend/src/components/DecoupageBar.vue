<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useVariantes } from '../composables/useVariantes'
import type { Etape, Variante } from '../types/trek'
import {
  dayCount,
  decoupageFromSaved,
  decoupageKey,
  decoupageToSaved,
  isDefaultDecoupage,
  type Decoupage,
} from '../utils/decoupage'
import { canCut } from '../utils/etapeGeometry'
import { proposeDecoupage } from '../utils/proposeDecoupage'

const props = defineProps<{
  trekId: string
  /** Étapes d'origine, dans l'ordre */
  etapes: Etape[]
  /** Découpage affiché (voir utils/decoupage.ts) */
  decoupage: Decoupage
}>()

const emit = defineEmits<{
  apply: [decoupage: Decoupage]
  reset: []
}>()

const editing = defineModel<boolean>('editing', { required: true })

const route = useRoute()
const auth = useAuthStore()
const { variantes, save, remove } = useVariantes(() => props.trekId)

const displayCount = computed(() => dayCount(props.decoupage))
const isCustom = computed(() => !isDefaultDecoupage(props.decoupage))
const current = computed(() => decoupageKey(props.decoupage))
// Un trek d'une seule étape se découpe encore, si sa trace permet d'y ajouter une nuit
const canAdapt = computed(() => props.etapes.length > 1 || props.etapes.some(canCut))

function daysLabel(count: number): string {
  return `${count} étape${count > 1 ? 's' : ''}`
}

const varianteDays = (variante: Variante) => variante.groups.length + variante.cuts.length

function varianteDecoupage(variante: Variante): Decoupage | null {
  return variante.isStale ? null : decoupageFromSaved(variante.groups, variante.cuts, props.etapes)
}

function isActive(variante: Variante): boolean {
  const decoupage = varianteDecoupage(variante)
  return decoupage !== null && decoupageKey(decoupage) === current.value
}

// Découpage affiché pas encore proposé : on invite à l'enregistrer
const isNew = computed(() => isCustom.value && !variantes.value.some(isActive))

function apply(variante: Variante) {
  const decoupage = varianteDecoupage(variante)
  if (decoupage) emit('apply', decoupage)
}

// Confirmation dans le bouton lui-même (« Supprimer ? Oui / Non ») plutôt que
// window.confirm, que certains navigateurs bloquent sans rien afficher
const confirmingId = ref<string | null>(null)
const removingId = ref<string | null>(null)
const removeError = ref<string | null>(null)

async function removeVariante(variante: Variante) {
  removingId.value = variante._id
  removeError.value = null
  try {
    await remove(variante._id)
    confirmingId.value = null
  } catch (e) {
    removeError.value = e instanceof Error ? e.message : 'Suppression impossible'
  } finally {
    removingId.value = null
  }
}

const isSaving = ref(false)
const saveError = ref<string | null>(null)

async function saveCurrent() {
  isSaving.value = true
  saveError.value = null
  try {
    await save(decoupageToSaved(props.decoupage, props.etapes))
    editing.value = false
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Enregistrement impossible'
  } finally {
    isSaving.value = false
  }
}

// --- « Propose-moi un découpage en N jours » ---

const wantedDays = ref<number | ''>('')
const lodgingOnly = ref(true)
const proposeError = ref<string | null>(null)

function propose() {
  proposeError.value = null
  const days = Number(wantedDays.value)
  if (!Number.isInteger(days) || days < 1) {
    proposeError.value = 'Indique un nombre de jours'
    return
  }
  const result = proposeDecoupage(props.etapes, { days, lodgingOnly: lodgingOnly.value })
  if (result.ok) emit('apply', result.decoupage)
  else proposeError.value = result.message
}
</script>

<template>
  <section class="decoupage" aria-label="Découpage du trek">
    <div v-if="variantes.length" class="variantes">
      <p class="variantes-title">Découpages</p>
      <ul class="variantes-list">
        <li>
          <button
            type="button"
            class="variante-btn"
            :class="{ 'is-active': !isCustom }"
            :aria-pressed="!isCustom"
            @click="emit('reset')"
          >
            Voir en {{ daysLabel(etapes.length) }}
            <span class="variante-note">origine</span>
          </button>
        </li>
        <li
          v-for="variante in variantes"
          :key="variante._id"
          class="variante-item"
          :class="{ 'has-remove': variante.canDelete }"
        >
          <button
            type="button"
            class="variante-btn"
            :class="{ 'is-active': isActive(variante) }"
            :aria-pressed="isActive(variante)"
            :disabled="variante.isStale"
            :title="variante.isStale ? 'Le trek a été modifié depuis : découpage à refaire' : ''"
            @click="apply(variante)"
          >
            Voir en {{ daysLabel(varianteDays(variante)) }}
            <span v-if="variante.isStale" class="variante-note">trek modifié</span>
          </button>
          <span
            v-if="variante.canDelete && confirmingId === variante._id"
            class="variante-confirm"
            role="group"
            :aria-label="`Supprimer le découpage en ${daysLabel(varianteDays(variante))} ?`"
          >
            Supprimer ?
            <button
              type="button"
              class="confirm-yes"
              :disabled="removingId === variante._id"
              @click="removeVariante(variante)"
            >
              {{ removingId === variante._id ? '…' : 'Oui' }}
            </button>
            <button type="button" class="confirm-no" @click="confirmingId = null">Non</button>
          </span>
          <button
            v-else-if="variante.canDelete"
            type="button"
            class="variante-remove"
            :aria-label="`Supprimer le découpage en ${daysLabel(varianteDays(variante))}`"
            @click="confirmingId = variante._id"
          >
            ×
          </button>
        </li>
      </ul>
      <p v-if="removeError" class="field-error" role="alert">{{ removeError }}</p>
    </div>

    <div v-if="isNew" class="banner" role="status">
      <p class="banner-text">
        <strong>Nouveau découpage : {{ daysLabel(displayCount) }}.</strong>
        Enregistre-le pour le proposer à tout le monde.
      </p>
      <button
        v-if="auth.isAuthenticated"
        type="button"
        class="btn btn-primary"
        :disabled="isSaving"
        @click="saveCurrent"
      >
        {{ isSaving ? 'Enregistrement…' : 'Enregistrer ce découpage' }}
      </button>
      <RouterLink
        v-else
        :to="{ name: 'login', query: { redirect: route.fullPath } }"
        class="btn btn-primary"
      >
        Se connecter pour enregistrer
      </RouterLink>
      <p v-if="saveError" class="field-error" role="alert">{{ saveError }}</p>
    </div>

    <form v-if="canAdapt" class="propose" @submit.prevent="propose">
      <label class="propose-row">
        <span>Je veux faire ce trek en</span>
        <input
          v-model.number="wantedDays"
          type="number"
          min="1"
          max="60"
          inputmode="numeric"
          class="input propose-input"
          aria-describedby="propose-error"
        />
        <span>jours</span>
      </label>
      <button type="submit" class="btn">Proposer</button>
      <label class="propose-check">
        <input v-model="lodgingOnly" type="checkbox" />
        Dormir seulement en fin d'étape, en refuge, cabane ou camping
      </label>
      <p v-if="proposeError" id="propose-error" class="field-error" role="alert">
        {{ proposeError }}
      </p>
    </form>

    <button
      v-if="canAdapt"
      type="button"
      class="btn edit-toggle"
      :class="{ 'btn-primary': editing }"
      :aria-pressed="editing"
      @click="editing = !editing"
    >
      {{ editing ? 'Terminer le découpage' : 'Adapter le découpage' }}
    </button>
    <p v-if="editing" class="hint">
      Retire une nuit 🌙 entre deux étapes pour les fusionner, ou ajoute une nuit dans une étape
      pour la couper. La carte et le profil suivent en direct.
    </p>
  </section>
</template>

<style scoped>
.decoupage {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
}
.variantes {
  width: 100%;
}
.variantes-title {
  margin: 0 0 0.4rem;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.variantes-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  list-style: none;
  padding: 0;
  margin: 0;
}
.variante-item {
  display: flex;
  align-items: stretch;
}
.variante-btn {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}
.variante-item.has-remove .variante-btn {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
.variante-btn:hover:not(:disabled) {
  border-color: var(--color-accent);
}
.variante-btn.is-active {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}
.variante-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.variante-btn:focus-visible,
.variante-remove:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.variante-note {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  font-weight: 400;
}
.variante-remove {
  padding: 0 0.7rem 0 0.6rem;
  border: 1px solid var(--color-border-strong);
  border-left: none;
  border-radius: 0 var(--radius-pill) var(--radius-pill) 0;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font: inherit;
  font-size: 1.1rem;
  cursor: pointer;
}
.variante-item:has(.variante-confirm) .variante-btn {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
.variante-confirm {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0 0.4rem 0 0.6rem;
  border: 1px solid var(--color-danger);
  border-left: none;
  border-radius: 0 var(--radius-pill) var(--radius-pill) 0;
  background: var(--color-danger-soft);
  color: var(--color-text);
  font-size: 0.85rem;
}
.confirm-yes,
.confirm-no {
  padding: 0.2rem 0.55rem;
  border: none;
  border-radius: var(--radius-pill);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}
.confirm-yes {
  background: var(--color-danger);
  color: var(--color-on-accent);
}
.confirm-no {
  background: none;
  color: var(--color-text-muted);
}
.confirm-no:hover {
  color: var(--color-text);
}
.confirm-yes:focus-visible,
.confirm-no:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.variante-remove:hover {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}
.banner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-sm);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius);
  background: var(--color-accent-soft);
}
.banner-text {
  margin: 0;
}
.propose {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs) var(--space-sm);
  width: 100%;
}
.propose-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.propose-input {
  width: 4.5rem;
  padding: 0.4rem 0.6rem;
  text-align: center;
}
.propose .btn {
  margin-bottom: 0;
}
.propose-check {
  display: flex;
  flex-basis: 100%;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  cursor: pointer;
}
.propose-check input {
  accent-color: var(--color-accent);
}
.propose .field-error {
  flex-basis: 100%;
}
.hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
</style>
