import { createRouter, createWebHistory } from 'vue-router'
import TrekList from '../views/TrekList.vue'
import TrekDetail from '../views/TrekDetail.vue'
import EtapeDetail from '../views/EtapeDetail.vue'

const router = createRouter({
  history: createWebHistory(),
  // Nouvelle page → retour en haut ; bouton précédent → position d'origine restaurée
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
  routes: [
    { path: '/', name: 'home', component: TrekList },
    { path: '/treks/new', name: 'trek-create', component: () => import('../views/TrekCreate.vue') },
    { path: '/treks/:id', name: 'trek-detail', component: TrekDetail },
    { path: '/etapes/:id', name: 'etape-detail', component: EtapeDetail },
  ],
})

export default router
