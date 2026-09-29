<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const isLoggingOut = ref(false)

async function logout() {
  isLoggingOut.value = true
  try {
    await auth.logout()
    // Une page réservée n'a plus de sens une fois déconnecté
    if (route.meta.requiresAuth) router.push('/')
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <header class="app-header">
    <RouterLink to="/" class="brand">
      <img src="/carnet-trek-logo.png" class="brand-mark" alt="Carnet Trek" />
      Carnet Trek
    </RouterLink>

    <nav class="account" aria-label="Compte">
      <template v-if="auth.user">
        <span class="user" :title="auth.user.email">
          <span class="avatar" aria-hidden="true">{{
            auth.user.name.charAt(0).toUpperCase()
          }}</span>
          <span class="user-name">{{ auth.user.name }}</span>
        </span>
        <button type="button" class="btn" :disabled="isLoggingOut" @click="logout">
          Déconnexion
        </button>
      </template>
      <RouterLink
        v-else-if="route.name !== 'login'"
        :to="{ name: 'login', query: { redirect: route.fullPath } }"
        class="btn"
      >
        Connexion
      </RouterLink>
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-sm) var(--space-md) 0;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  text-decoration: none;
}
.brand-mark {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-size: 1rem;
}
.account {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.user {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
.avatar {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-surface-raised);
  color: var(--color-gold);
  font-weight: 700;
}
@media (max-width: 480px) {
  .user-name {
    display: none;
  }
}
</style>
