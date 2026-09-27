import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.ts'
import { createPinia } from 'pinia'
import './styles/tokens.css'

createApp(App).use(createPinia()).use(router).mount('#app')
