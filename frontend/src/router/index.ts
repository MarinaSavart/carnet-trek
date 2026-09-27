import { createRouter, createWebHistory } from 'vue-router'
import TrekList from '../views/TrekList.vue'
import TrekDetail from '../views/TrekDetail.vue'
import EtapeDetail from '../views/EtapeDetail.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: TrekList },
    { path: '/treks/:id', name: 'trek-detail', component: TrekDetail },
    { path: '/etapes/:id', name: 'etape-detail', component: EtapeDetail },
  ],
})

export default router
