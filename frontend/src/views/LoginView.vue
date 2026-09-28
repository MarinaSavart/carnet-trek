<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api/http'
import { safeRedirect } from '../router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

type Mode = 'login' | 'register'
const mode = ref<Mode>('login')
const form = reactive({ email: '', name: '', password: '' })
const isSubmitting = ref(false)
const error = ref<{ message: string; details: string[] } | null>(null)

const isRegister = computed(() => mode.value === 'register')
// Venu d'une page réservée : on explique pourquoi on est là
const fromProtectedPage = computed(() => typeof route.query.redirect === 'string')

async function switchMode(next: Mode) {
  mode.value = next
  error.value = null
  await nextTick()
  document.getElementById(next === 'register' ? 'auth-name' : 'auth-email')?.focus()
}

async function submit() {
  isSubmitting.value = true
  error.value = null
  try {
    if (isRegister.value) await auth.register({ ...form })
    else await auth.login(form.email, form.password)
    router.replace(safeRedirect(route.query.redirect))
  } catch (e) {
    error.value = {
      message: e instanceof Error ? e.message : 'Connexion impossible',
      details: e instanceof ApiError ? e.details.map((d) => d.replace(/^\w+ : /, '')) : [],
    }
    form.password = ''
    await nextTick()
    document.getElementById('auth-error')?.focus()
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <h1>{{ isRegister ? 'Créer un compte' : 'Connexion' }}</h1>
      <p class="intro">
        <template v-if="fromProtectedPage">Connecte-toi pour continuer.</template>
        <template v-else-if="isRegister">Pour ajouter et gérer tes propres treks.</template>
        <template v-else>Heureux de te revoir sur le sentier.</template>
      </p>

      <div class="tabs" role="tablist" aria-label="Type de formulaire">
        <button
          type="button"
          role="tab"
          class="tab"
          :aria-selected="!isRegister"
          @click="switchMode('login')"
        >
          Se connecter
        </button>
        <button
          type="button"
          role="tab"
          class="tab"
          :aria-selected="isRegister"
          @click="switchMode('register')"
        >
          Créer un compte
        </button>
      </div>

      <form class="form" @submit.prevent="submit">
        <div v-if="isRegister" class="field">
          <label for="auth-name" class="field-label">Nom</label>
          <input
            id="auth-name"
            v-model="form.name"
            class="input"
            autocomplete="name"
            required
            maxlength="80"
          />
        </div>

        <div class="field">
          <label for="auth-email" class="field-label">Email</label>
          <input
            id="auth-email"
            v-model="form.email"
            type="email"
            class="input"
            autocomplete="email"
            required
          />
        </div>

        <div class="field">
          <label for="auth-password" class="field-label">
            Mot de passe
            <span v-if="isRegister" class="field-hint">(10 caractères minimum)</span>
          </label>
          <input
            id="auth-password"
            v-model="form.password"
            type="password"
            class="input"
            :autocomplete="isRegister ? 'new-password' : 'current-password'"
            :minlength="isRegister ? 10 : undefined"
            required
          />
        </div>

        <div v-if="error" id="auth-error" class="error" role="alert" tabindex="-1">
          <strong>{{ error.message }}</strong>
          <ul v-if="error.details.length">
            <li v-for="detail in error.details" :key="detail">{{ detail }}</li>
          </ul>
        </div>

        <button type="submit" class="btn btn-primary submit" :disabled="isSubmitting">
          <template v-if="isSubmitting">Un instant…</template>
          <template v-else>{{ isRegister ? 'Créer mon compte' : 'Se connecter' }}</template>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  place-items: start center;
  padding: var(--space-lg) var(--space-md);
}
.card {
  width: 100%;
  max-width: 420px;
  box-sizing: border-box;
  padding: var(--space-lg) var(--space-md);
  border: var(--border-hairline);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
}
.intro {
  margin: 0.25rem 0 var(--space-md);
  color: var(--color-text-muted);
}
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  margin-bottom: var(--space-md);
  border-radius: var(--radius-pill);
  background: var(--color-bg-deep);
}
.tab {
  padding: 0.45rem 0.75rem;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.tab[aria-selected='true'] {
  background: var(--color-surface-raised);
  color: var(--color-text);
}
.tab:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
.error {
  padding: var(--space-sm);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 0.9rem;
}
.error ul {
  margin: 0.25rem 0 0;
  padding-left: 1.25rem;
}
.submit {
  margin-top: var(--space-xs);
  padding-block: 0.7rem;
}
</style>
