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
  if (!app.includes('const { office, update, ready, sync, access')) {
    app = replaceRequired(
      app,
      'const { office, update, ready, sync } = useOfficeData(session)',
      'const { office, update, ready, sync, access } = useOfficeData(session)',
      'workspace access',
    )
  }
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

  const workspacePath = `${root}src/components/ObligationsWorkspace.jsx`
  let workspace = readFileSync(workspacePath, 'utf8')
  if (!workspace.includes("function openNewModel() {\n    setModelsOpen(false)")) {
    workspace = replaceRequired(
      workspace,
      "function openNewModel() {\n    setModelEditing(",
      "function openNewModel() {\n    setModelsOpen(false)\n    setModelEditing(",
      'new model modal flow',
    )
  }
  if (!workspace.includes("function openEditModel(model) {\n    setModelsOpen(false)")) {
    workspace = replaceRequired(
      workspace,
      "function openEditModel(model) {\n    const chosen = selectionFromModel(model)",
      "function openEditModel(model) {\n    setModelsOpen(false)\n    const chosen = selectionFromModel(model)",
      'edit model modal flow',
    )
  }
  if (!workspace.includes("setModelEditing(null)\n    setModelsOpen(true)\n    setNotice('Modelo salvo.')")) {
    workspace = replaceRequired(
      workspace,
      "setModelEditing(null)\n    setNotice('Modelo salvo.')",
      "setModelEditing(null)\n    setModelsOpen(true)\n    setNotice('Modelo salvo.')",
      'return to models after save',
    )
  }
  const closeModelEditor = "onClose={() => { setModelEditing(null); setModelsOpen(true) }}"
  if (!workspace.includes(closeModelEditor)) {
    workspace = replaceRequired(
      workspace,
      "onClose={() => setModelEditing(null)} wide><form className=\"obligation-form obligation-v2-form\" onSubmit={saveModel}",
      `${closeModelEditor} wide><form className=\"obligation-form obligation-v2-form\" onSubmit={saveModel}`,
      'model editor close',
    )
    workspace = replaceRequired(
      workspace,
      '<button type="button" onClick={() => setModelEditing(null)}>Cancelar</button><button className="primary">Salvar modelo</button>',
      '<button type="button" onClick={() => { setModelEditing(null); setModelsOpen(true) }}>Cancelar</button><button className="primary">Salvar modelo</button>',
      'model editor cancel',
    )
  }
  writeFileSync(workspacePath, workspace)
}
