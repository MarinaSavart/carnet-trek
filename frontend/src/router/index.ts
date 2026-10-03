import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import TrekList from '../views/TrekList.vue'
import TrekDetail from '../views/TrekDetail.vue'
import EtapeDetail from '../views/EtapeDetail.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** Page réservée aux utilisateurs connectés */
    requiresAuth?: boolean
    /** Page sans intérêt une fois connecté (connexion / inscription) */
    guestOnly?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(),
  // Nouvelle page → retour en haut ; bouton précédent → position d'origine restaurée ;
  // simple changement de paramètres (ex. découpage d'un trek) → on ne bouge pas
  scrollBehavior: (to, from, savedPosition) =>
    savedPosition ?? (to.path === from.path ? false : { top: 0 }),
  routes: [
    { path: '/', name: 'home', component: TrekList },
    {
      path: '/connexion',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/treks/new',
      name: 'trek-create',
      component: () => import('../views/TrekForm.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/treks/:id/modifier',
      name: 'trek-edit',
      component: () => import('../views/TrekForm.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/treks/:id', name: 'trek-detail', component: TrekDetail },
    { path: '/treks/:trekId/etapes/:etapeId', name: 'etape-detail', component: EtapeDetail },
  ],
})

/**
 * Chemin de retour après connexion : uniquement un chemin interne à l'appli.
 * Refuse « //site.com », « /\site.com » ou « https://… » (sinon redirection ouverte
 * vers un autre site).
 */
export function safeRedirect(value: unknown): string {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : '/'
}

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.ensureLoaded()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return safeRedirect(to.query.redirect)
  }
})

export default router
