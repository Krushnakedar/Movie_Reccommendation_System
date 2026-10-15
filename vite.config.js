import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Express backend (server/) listens on PORT from server/.env (default 4000).
// The browser only ever talks to /api on the Vite origin; Vite forwards it to the backend,
// so the TMDB token never reaches browser code and no CORS setup is needed in development.
// If you change PORT in server/.env, set API_PROXY_TARGET (e.g. http://localhost:5000) before `npm run dev`.
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:4000'

const proxy = {
  '/api': {
    target: apiTarget,
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
