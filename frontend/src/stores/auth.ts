import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as api from '../api/auth'
import type { User } from '../types/user'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => user.value !== null)

  // La session est lue une seule fois au démarrage ; le routeur attend ce chargement
  // avant de décider si une page réservée est accessible.
  let loading: Promise<void> | null = null
  function ensureLoaded(): Promise<void> {
    loading ??= api
      .fetchCurrentUser()
      .then((current) => {
        user.value = current
      })
      .catch(() => {
        // API injoignable : on continue en visiteur, les pages publiques restent lisibles
        user.value = null
      })
    return loading
  }

  async function login(email: string, password: string) {
    user.value = await api.login(email, password)
  }

  async function register(input: { email: string; name: string; password: string }) {
    user.value = await api.register(input)
  }

  async function logout() {
    await api.logout()
    user.value = null
  }

  /** L'auteur d'un trek peut le modifier ; les treks sans auteur, tout utilisateur connecté */
  function canEdit(trek: { owner?: string | null }): boolean {
    return user.value !== null && (!trek.owner || trek.owner === user.value._id)
  }

  return { user, isAuthenticated, ensureLoaded, login, register, logout, canEdit }
})
