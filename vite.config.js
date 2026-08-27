import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const legacyFile = fileURLToPath(new URL('./legacy-v10-7.html', import.meta.url))

function legacyCompatibilityFile() {
  return {
    name: 'legacy-compatibility-file',
    configureServer(server) {
      server.middlewares.use('/legacy-v10-7.html', (_request, response) => {
        response.setHeader('Content-Type', 'text/html; charset=utf-8')
        response.end(readFileSync(legacyFile))
      })
    },
    closeBundle() {
      copyFileSync(legacyFile, fileURLToPath(new URL('./dist/legacy-v10-7.html', import.meta.url)))
    },
  }
}

export default defineConfig({
  plugins: [react(), legacyCompatibilityFile()],
  build: { target: 'es2022' },
})
