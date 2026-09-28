import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  // Backend vers lequel le serveur de dev relaie /api et /uploads.
  // En local : http://localhost:3000 ; dans Docker : http://backend:3000 (docker-compose.yml).
  const apiTarget = env.API_PROXY_TARGET ?? 'http://localhost:3000'

  // Front et API sur la même origine : le cookie de session reste « first-party »
  // (sinon 127.0.0.1:5173 → localhost:3000 serait inter-sites et le cookie bloqué).
  const proxy = { target: apiTarget, changeOrigin: false, xfwd: true }

  return {
    plugins: [vue()],
    server: {
      proxy: {
        '/api': proxy,
        '/uploads': proxy,
      },
    },
  }
})
