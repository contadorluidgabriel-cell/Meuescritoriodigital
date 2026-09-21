import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, before, after, description) {
  if (source.includes(after)) return source
  if (!source.includes(before)) throw new Error(`Legacy settings bridge: missing ${description}`)
  return source.replace(before, after)
}

export function applyLegacySettingsBridgePatch(root) {
  const legacyPath = `${root}legacy-v10-7.html`
  let legacy = readFileSync(legacyPath, 'utf8')
  if (!legacy.includes('MED_TRUSTED_EMBED_AUTH_V1')) {
    const previousBoot = "  ensureSession().then(ok=>ok?hydrate():setMessage('Entre para carregar os dados do escritório.')).catch(error=>setMessage(error.message,'error'));"
    const bridgedBoot = `  /* MED_TRUSTED_EMBED_AUTH_V1: the React shell already authenticated this same-origin iframe. */
  const trustedReactEmbed = (() => {
    try {
      return window.parent !== window
        && window.parent.location.origin === window.location.origin
        && Boolean(window.parent.document.querySelector('.react-shell'))
    } catch { return false }
  })()
  if (trustedReactEmbed) {
    // Do not hydrate or synchronize the obsolete office_snapshots database.
    // React owns authentication and workspace persistence for embedded settings.
    gate.hidden = true
    document.body.classList.remove('cloud-locked')
    app?.removeAttribute('inert')
  } else {
    ensureSession().then(ok=>ok?hydrate():setMessage('Entre para carregar os dados do escritório.')).catch(error=>setMessage(error.message,'error'));
  }`
    legacy = replaceRequired(legacy, previousBoot, bridgedBoot, 'legacy authentication bootstrap')
    writeFileSync(legacyPath, legacy)
  }

  const modulePath = `${root}src/components/LegacyModule.jsx`
  let module = readFileSync(modulePath, 'utf8')
  if (!module.includes('MED_SETTINGS_WORKSPACE_BRIDGE_V1')) {
    module = replaceRequired(module,
      'function configureFrame(frame, view, record) {',
      'function configureFrame(frame, view, record, onSettingsChange) {',
      'frame configuration signature')
    const anchor = '  style.textContent = bridgeCss\n'
    const bridge = `  style.textContent = bridgeCss

  /* MED_SETTINGS_WORKSPACE_BRIDGE_V1: listen only after the old page has loaded.
     Its initial migration writes must never overwrite the active workspace. */
  if (view === 'configuracoes' && !frameWindow.__medSettingsBridgeInstalled) {
    const originalSetItem = frameWindow.Storage.prototype.setItem
    const settingsKeys = new Set(['med_configuracoes', 'med_preferencias', 'med_processos_modelos', 'med_tarefas_modelos'])
    frameWindow.Storage.prototype.setItem = function (key, value) {
      const result = originalSetItem.call(this, key, value)
      if (this === frameWindow.localStorage && settingsKeys.has(String(key))) {
        try { onSettingsChange?.(String(key), JSON.parse(String(value))) } catch { /* malformed local data is never synced */ }
      }
      return result
    }
    frameWindow.__medSettingsBridgeInstalled = true
  }
`
    module = replaceRequired(module, anchor, bridge, 'workspace persistence bridge')
    module = replaceRequired(module,
      'export default function LegacyModule({ view, record }) {',
      'export default function LegacyModule({ view, record, onSettingsChange }) {',
      'legacy component signature')
    module = replaceRequired(module,
      'configureFrame(frameRef.current, view, record)',
      'configureFrame(frameRef.current, view, record, onSettingsChange)',
      'effect frame bridge')
    module = replaceRequired(module,
      'configureFrame(frameRef.current, view, record); setLoaded(true)',
      'configureFrame(frameRef.current, view, record, onSettingsChange); setLoaded(true)',
      'load frame bridge')
    writeFileSync(modulePath, module)
  }

  const appPath = `${root}src/App.jsx`
  let app = readFileSync(appPath, 'utf8')
  if (!app.includes('MED_REACT_SETTINGS_PERSISTENCE_V1')) {
    const opening = '  return <>\n'
    const handler = `  /* MED_REACT_SETTINGS_PERSISTENCE_V1: keep legacy settings in the authenticated workspace. */
  function applyLegacySettingsChange(key, value) {
    if (!value || typeof value !== 'object') return
    update(draft => {
      if (key === 'med_configuracoes' && !Array.isArray(value)) draft.settings = { ...(draft.settings || {}), ...value }
      else if (key === 'med_preferencias' && !Array.isArray(value)) draft.ui = { ...(draft.ui || {}), ...value }
      else if (key === 'med_processos_modelos' && Array.isArray(value)) draft.processModels = value
      else if (key === 'med_tarefas_modelos' && Array.isArray(value)) draft.taskTemplates = value
    })
  }

${opening}`
    app = replaceRequired(app, opening, handler, 'React settings persistence')
    app = replaceRequired(app,
      '<LegacyModule view={view} record={legacyTarget} />',
      '<LegacyModule view={view} record={legacyTarget} onSettingsChange={applyLegacySettingsChange} />',
      'legacy settings callback')
    writeFileSync(appPath, app)
  }
}
