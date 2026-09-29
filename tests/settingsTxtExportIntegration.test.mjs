import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('Configurações exibe ferramenta nativa de exportação TXT', () => {
  const legacy = readFileSync('src/components/LegacyModule.jsx', 'utf8')
  const panel = readFileSync('src/components/SettingsTxtExports.jsx', 'utf8')
  const app = readFileSync('src/App.jsx', 'utf8')

  assert.match(legacy, /MED_SETTINGS_TXT_EXPORT_V1/)
  assert.match(legacy, /<SettingsTxtExports office=\{office \|\| \{\}\} \/>/)
  assert.match(legacy, /view === 'configuracoes'/)
  assert.match(app, /office=\{office\}/)

  assert.match(panel, /Exportar dados em TXT/)
  assert.match(panel, /Clientes/)
  assert.match(panel, /Processos/)
  assert.match(panel, /Financeiro/)
  assert.match(panel, /downloadTxtExport\(office, type\)/)
})

test('exportação TXT é aplicada depois dos demais patches da interface', () => {
  const source = readFileSync('scripts/patch-departments.mjs', 'utf8')
  const moduleViews = source.indexOf('applyModuleViewsPatch(root)')
  const txtExport = source.indexOf('applySettingsTxtExportPatch(root)')
  assert.ok(moduleViews >= 0)
  assert.ok(txtExport > moduleViews)
})
