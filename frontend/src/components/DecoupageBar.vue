<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useVariantes } from '../composables/useVariantes'
import type { Etape, Variante } from '../types/trek'
import { groupsOfIds, nightsFromGroups, serializeDecoupage } from '../utils/decoupage'

const props = defineProps<{
  trekId: string
  /** Étapes d'origine, dans l'ordre */
  etapes: Etape[]
  /** Découpage affiché (voir utils/decoupage.ts) */
  nights: boolean[]
}>()

const emit = defineEmits<{
  apply: [nights: boolean[]]
  reset: []
}>()

const editing = defineModel<boolean>('editing', { required: true })

const route = useRoute()
const auth = useAuthStore()
const { variantes, save, remove } = useVariantes(() => props.trekId)

const displayCount = computed(() => props.nights.filter(Boolean).length + 1)
const isCustom = computed(() => displayCount.value !== props.etapes.length)
const current = computed(() => serializeDecoupage(props.nights))

function etapesLabel(count: number): string {
  return `${count} étape${count > 1 ? 's' : ''}`
}

function varianteNights(variante: Variante): boolean[] | null {
  return variante.isStale ? null : nightsFromGroups(variante.groups, props.etapes)
}

function isActive(variante: Variante): boolean {
  const nights = varianteNights(variante)
  return nights !== null && serializeDecoupage(nights) === current.value
}

// Découpage affiché pas encore proposé : on invite à l'enregistrer
const isNew = computed(() => isCustom.value && !variantes.value.some(isActive))

function apply(variante: Variante) {
  const nights = varianteNights(variante)
  if (nights) emit('apply', nights)
}

async function removeVariante(variante: Variante) {
  const label = `Supprimer le découpage en ${etapesLabel(variante.groups.length)} ?`
  if (!window.confirm(label)) return
  try {
    await remove(variante._id)
  } catch (e) {
    window.alert(e instanceof Error ? e.message : 'Suppression impossible')
  }
}

const isSaving = ref(false)
const saveError = ref<string | null>(null)

async function saveCurrent() {
  isSaving.value = true
  saveError.value = null
  try {
    await save(groupsOfIds(props.nights, props.etapes))
    editing.value = false
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Enregistrement impossible'
  } finally {
    isSaving.value = false
  }
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
            Voir en {{ etapesLabel(etapes.length) }}
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
            Voir en {{ etapesLabel(variante.groups.length) }}
            <span v-if="variante.isStale" class="variante-note">trek modifié</span>
          </button>
          <button
            v-if="variante.canDelete"
            type="button"
            class="variante-remove"
            :aria-label="`Supprimer le découpage en ${etapesLabel(variante.groups.length)}`"
            @click="removeVariante(variante)"
          >
            ×
          </button>
        </li>
      </ul>
    </div>

    <div v-if="isNew" class="banner" role="status">
      <p class="banner-text">
        <strong>Nouveau découpage : {{ etapesLabel(displayCount) }}.</strong>
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

    <button
      v-if="etapes.length > 1"
      type="button"
      class="btn edit-toggle"
      :class="{ 'btn-primary': editing }"
      :aria-pressed="editing"
      @click="editing = !editing"
    >
      {{ editing ? 'Terminer le découpage' : 'Adapter le découpage' }}
    </button>
    <p v-if="editing" class="hint">
      Retire une nuit 🌙 entre deux étapes pour les fusionner. La carte et le profil suivent en
      direct.
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
.hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
</style>
