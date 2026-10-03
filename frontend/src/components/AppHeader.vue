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
    <div class="app-header-inner">
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
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  min-height: var(--navbar-height);
  box-sizing: border-box;
  position: sticky;
  top: 0;
  z-index: 30;
  /* Même dégradé que le fond de page, figé par rapport à l'écran : se fond avec le contenu
     qui défile dessous au lieu de trancher par une couleur plate */
  background: var(--page-gradient), var(--color-bg);
  background-attachment: fixed;
}
.app-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  /* Pleine largeur, comme les pages avec carte en dessous */
  width: 100%;
  padding: 0 var(--space-md);
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
