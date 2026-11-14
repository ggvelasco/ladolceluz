import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Em desenvolvimento a API roda dentro do próprio Vite: um comando, uma porta.
function reservasApi(): Plugin {
  return {
    name: 'la-dolce-luz-api',
    async configureServer(server) {
      const { createApi } = await import(pathToFileURL(resolve(process.cwd(), 'server/api.js')).href)
      server.middlewares.use(createApi())
    },
  }
}

export default defineConfig({
  plugins: [react(), reservasApi()],
  server: { port: 5173, strictPort: true },
})
