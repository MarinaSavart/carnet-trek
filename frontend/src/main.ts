import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.ts'
import { createPinia } from 'pinia'
import './styles/tokens.css'
import 'maplibre-gl/dist/maplibre-gl.css'

createApp(App).use(createPinia()).use(router).mount('#app')
