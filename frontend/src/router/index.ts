import { createRouter, createWebHistory } from 'vue-router'
import TrekDetail from '../views/TrekDetail.vue'
import TrekList from '../views/TrekList.vue'


const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: TrekList },
    { path: '/treks/:id', name: 'trek-detail', component: TrekDetail },
  ],
})

export default router