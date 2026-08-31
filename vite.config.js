import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { applyThirdPartyWorkPatches } from './scripts/patch-third-party-work.mjs'
import { applyClientOutsourcingPatch } from './scripts/patch-client-outsourcing.mjs'
import { applyClientSharingPatch } from './scripts/patch-client-sharing.mjs'
import { applyTaskDeletionPatch } from './scripts/patch-task-deletion.mjs'
import { applyQuantitativeAndAvulsoPatches } from './scripts/patch-quantitative-and-avulsos.mjs'
import { applyQuantitativeDuplicatePatch } from './scripts/patch-quantitative-duplicate.mjs'
import { applyAvulsoSelectorPositionPatch } from './scripts/patch-avulso-selector-position.mjs'
import { applySharedResponsibilityPatches } from './scripts/patch-shared-responsibility.mjs'
import { applyProcessFinancePatch } from './scripts/patch-process-finance.mjs'
import { applyOfficialPdfBrandPatch } from './scripts/patch-official-pdf-brand.mjs'
import { applySharingStylesPatch } from './scripts/patch-sharing-styles.mjs'

const root = fileURLToPath(new URL('./', import.meta.url))
const payloadDir = fileURLToPath(new URL('./source-payloads/', import.meta.url))

const payloadMap = [
  ['ProcessesReact.jsx.gz.b64', 'src/components/ProcessesReact.jsx'],
  ['TasksReact.jsx.gz.b64', 'src/components/TasksReactBase.jsx'],
  ['calendar-react.css.gz.b64', 'src/calendar-react.css'],
  ['clients-react.css.gz.b64', 'src/clients-react.css'],
  ['dashboard-react.css.gz.b64', 'src/dashboard-react.css'],
  ['finance-react.css.gz.b64', 'src/finance-react.css'],
  ['migration-shell.css.gz.b64', 'src/migration-shell.css'],
  ['obligations-react.css.gz.b64', 'src/obligations-react.css'],
  ['processes-react.css.gz.b64', 'src/processes-react.css'],
  ['styles.css.gz.b64', 'src/styles.css'],
  ['tasks-react.css.gz.b64', 'src/tasks-react.css'],
]

function decodePayload(text) {
  return gunzipSync(Buffer.from(text.replace(/\s+/g, ''), 'base64'))
}

function readLegacyChunk(index) {
  const part = String(index).padStart(2, '0')
  if (index === 2 || index === 8) {
    return readFileSync(`${payloadDir}legacy-v10-7.html.gz.b64.part${part}a`, 'utf8')
      + readFileSync(`${payloadDir}legacy-v10-7.html.gz.b64.part${part}b`, 'utf8')
  }
  return readFileSync(`${payloadDir}legacy-v10-7.html.gz.b64.part${part}`, 'utf8')
}

function restorePayloads() {
  for (const [payloadName, targetName] of payloadMap) {
    const target = `${root}${targetName}`
    if (existsSync(target)) continue
    const payload = readFileSync(`${payloadDir}${payloadName}`, 'utf8')
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, decodePayload(payload))
  }

  const legacyTarget = `${root}legacy-v10-7.html`
  if (!existsSync(legacyTarget)) {
    const chunks = Array.from({ length: 10 }, (_, index) => readLegacyChunk(index))
    writeFileSync(legacyTarget, decodePayload(chunks.join('')))
  }
}

restorePayloads()
applyThirdPartyWorkPatches(root)
applyTaskDeletionPatch(root)
applyClientOutsourcingPatch(root)
applyClientSharingPatch(root)
applyQuantitativeAndAvulsoPatches(root)
applyQuantitativeDuplicatePatch(root)
applyAvulsoSelectorPositionPatch(root)
applySharedResponsibilityPatches(root)
applyProcessFinancePatch(root)
applyOfficialPdfBrandPatch(root)
applySharingStylesPatch(root)

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
