import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`Obligations v2 patch failed (${label})`)
  return source.replace(from, to)
}

export function applyObligationsV2Patch(root) {
  const appPath = `${root}src/App.jsx`
  let app = readFileSync(appPath, 'utf8')
  app = replaceRequired(
    app,
    "import ObligationsReact from './components/ObligationsReact.jsx'",
    "import ObligationsReact from './components/ObligationsWorkspaceEntry.jsx'",
    'workspace import',
  )
  app = replaceRequired(
    app,
    'const { office, update, ready, sync } = useOfficeData(session)',
    'const { office, update, ready, sync, access } = useOfficeData(session)',
    'workspace access',
  )
  if (!app.includes('openObligationRequest={obligationTarget.request} access={access}')) {
    const from = 'openObligationRequest={obligationTarget.request} />'
    const to = 'openObligationRequest={obligationTarget.request} access={access} />'
    if (!app.includes(from)) throw new Error('Obligations v2 patch failed (access prop)')
    app = app.replace(from, to)
  }
  writeFileSync(appPath, app)

  const mainPath = `${root}src/main.jsx`
  let main = readFileSync(mainPath, 'utf8')
  if (!main.includes("import './obligations-redesign.css'")) {
    const anchor = "import './obligations-react.css'"
    if (!main.includes(anchor)) throw new Error('Obligations v2 patch failed (css import)')
    main = main.replace(anchor, `${anchor}\nimport './obligations-redesign.css'`)
    writeFileSync(mainPath, main)
  }
}
