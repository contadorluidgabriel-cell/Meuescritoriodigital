import { readFileSync, writeFileSync } from 'node:fs'

const marker = 'MED_SETTINGS_TXT_EXPORT_V1'

function replaceRequired(source, before, after, label, path) {
  if (source.includes(after)) return source
  if (!source.includes(before)) throw new Error(`TXT export patch: missing ${label} in ${path}`)
  return source.replace(before, after)
}

export function applySettingsTxtExportPatch(root) {
  const modulePath = root + 'src/components/LegacyModule.jsx'
  let source = readFileSync(modulePath, 'utf8')
  if (!source.includes(marker)) {
    source = replaceRequired(
      source,
      "import { loadOffice } from '../lib/storage.js'",
      "import { loadOffice } from '../lib/storage.js'\nimport SettingsTxtExports from './SettingsTxtExports.jsx'",
      'settings TXT component import',
      modulePath,
    )
    source = replaceRequired(
      source,
      'export default function LegacyModule({ view, record, onSettingsChange }) {',
      'export default function LegacyModule({ view, record, onSettingsChange, office }) {',
      'LegacyModule signature',
      modulePath,
    )

    const oldReturn = `  return <section className="module-stage" aria-busy={!loaded}>
    {!loaded ? <div className="module-loading"><span>ED</span><b>Carregando módulo completo…</b></div> : null}
    <iframe ref={frameRef} className="module-frame" src="/legacy-v10-7.html" title={\`Meu Escritório Digital — \${view}\`} allow="clipboard-read; clipboard-write" onLoad={handleLoad} />
  </section>`
    const newReturn = `  const frame = <section className="module-stage" aria-busy={!loaded}>
    {!loaded ? <div className="module-loading"><span>ED</span><b>Carregando módulo completo…</b></div> : null}
    <iframe ref={frameRef} className="module-frame" src="/legacy-v10-7.html" title={\`Meu Escritório Digital — \${view}\`} allow="clipboard-read; clipboard-write" onLoad={handleLoad} />
  </section>
  return view === 'configuracoes' ? <div className="settings-native-page"><SettingsTxtExports office={office || {}} />{frame}</div> : frame`
    source = replaceRequired(source, oldReturn, newReturn, 'LegacyModule settings wrapper', modulePath)
    source = '// ' + marker + '\n' + source
    writeFileSync(modulePath, source)
  }

  const appPath = root + 'src/App.jsx'
  let app = readFileSync(appPath, 'utf8')
  if (!app.includes('MED_SETTINGS_TXT_EXPORT_APP_V1')) {
    app = replaceRequired(
      app,
      '<LegacyModule view={view} record={legacyTarget} onSettingsChange={applyLegacySettingsChange} />',
      '<LegacyModule view={view} record={legacyTarget} onSettingsChange={applyLegacySettingsChange} office={office} />',
      'office prop for settings export',
      appPath,
    )
    app = '// MED_SETTINGS_TXT_EXPORT_APP_V1\n' + app
    writeFileSync(appPath, app)
  }
}
