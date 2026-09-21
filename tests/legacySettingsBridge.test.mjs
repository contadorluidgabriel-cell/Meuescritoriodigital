import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const html = readFileSync(new URL('../legacy-v10-7.html', import.meta.url), 'utf8')
const marker = '/* MED_TRUSTED_EMBED_AUTH_V1'
const start = html.indexOf(marker)
const end = html.indexOf('\n})();', start)
assert.ok(start > 0 && end > start, 'A proteção do login incorporado deve existir no HTML publicado')
const bootstrap = html.slice(start, end)

function runBootstrap({ embedded = false, sameOrigin = true, authenticatedParent = true } = {}) {
  const calls = { login: 0, unlock: 0, messages: [] }
  const gate = { hidden: false }
  const parent = {
    location: { origin: sameOrigin ? 'https://med.example' : 'https://external.example' },
    document: { querySelector: () => authenticatedParent ? {} : null },
  }
  const window = { location: { origin: 'https://med.example' } }
  window.parent = embedded ? parent : window
  const document = { body: { classList: { remove: value => { if (value === 'cloud-locked') calls.unlock++ } } } }
  const app = { removeAttribute: value => { if (value === 'inert') calls.unlock++ } }
  runInNewContext(bootstrap, {
    window, document, gate, app,
    ensureSession: () => { calls.login++; return Promise.resolve(false) },
    setMessage: value => { calls.messages.push(value) },
  })
  return { calls, gate }
}

test('Configurações dentro do MED autenticado não solicita segundo login', () => {
  const { calls, gate } = runBootstrap({ embedded: true })
  assert.equal(gate.hidden, true)
  assert.equal(calls.unlock, 2)
  assert.equal(calls.login, 0)
})

test('URL antiga isolada ou iframe sem shell autenticado mantém autenticação', () => {
  for (const scenario of [{}, { embedded: true, sameOrigin: false }, { embedded: true, authenticatedParent: false }]) {
    const { calls, gate } = runBootstrap(scenario)
    assert.equal(gate.hidden, false)
    assert.equal(calls.login, 1)
  }
})

test('Alterações da tela antiga são encaminhadas somente após carregar o iframe para o workspace React', () => {
  const legacyModule = readFileSync(new URL('../src/components/LegacyModule.jsx', import.meta.url), 'utf8')
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(legacyModule, /MED_SETTINGS_WORKSPACE_BRIDGE_V1/)
  assert.match(legacyModule, /view === 'configuracoes' && !frameWindow\.__medSettingsBridgeInstalled/)
  assert.match(legacyModule, /onSettingsChange\?\.\(String\(key\), JSON\.parse\(String\(value\)\)\)/)
  assert.match(app, /MED_REACT_SETTINGS_PERSISTENCE_V1/)
  assert.match(app, /draft\.settings = \{ \.\.\.\(draft\.settings \|\| \{\}\), \.\.\.value \}/)
  assert.match(app, /onSettingsChange=\{applyLegacySettingsChange\}/)
  assert.match(bootstrap, /Do not hydrate or synchronize the obsolete office_snapshots database/)
})
