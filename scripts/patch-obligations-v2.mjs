import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`Obligations v2 patch failed (${label})`)
  return source.replace(from, to)
}

function replaceRange(source, startMarker, endMarker, replacement, label) {
  if (source.includes(replacement)) return source
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)
  if (start < 0 || end < 0) throw new Error(`Obligations v2 patch failed (${label})`)
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`
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
  }
  if (!main.includes("import './obligations-accordion.css'")) {
    const anchor = "import './obligations-redesign.css'"
    if (!main.includes(anchor)) throw new Error('Obligations v2 patch failed (accordion css import)')
    main = main.replace(anchor, `${anchor}\nimport './obligations-accordion.css'`)
  }
  writeFileSync(mainPath, main)

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

  if (!workspace.includes('const [expandedObligations, setExpandedObligations] = useState(new Set())')) {
    workspace = replaceRequired(
      workspace,
      '  const [details, setDetails] = useState(null)',
      '  const [details, setDetails] = useState(null)\n  const [expandedObligations, setExpandedObligations] = useState(new Set())',
      'accordion state',
    )
  }

  if (workspace.includes("import ObligationDeadlinesBoard from './ObligationDeadlinesBoard.jsx'")) {
    workspace = workspace.replace("import ObligationDeadlinesBoard from './ObligationDeadlinesBoard.jsx'\n", '')
  }

  const deadlineStart = "    {tab === 'open' ? <ObligationDeadlinesBoard"
  if (workspace.includes(deadlineStart)) {
    const deadlineEnd = '    <section className="obligations-card obligation-v2-card">'
    workspace = replaceRange(workspace, deadlineStart, deadlineEnd, '', 'remove individual deadline cards')
  }

  const accordionMarkup = `<div className="obligation-v2-accordion">
        <div className="obligation-v2-accordion-tools"><span>{rows.length} obrigação(ões) exibida(s)</span>{rows.length ? <div><button type="button" onClick={() => setExpandedObligations(new Set(rows.map(item => String(item.id))))}>Expandir todos</button><button type="button" onClick={() => setExpandedObligations(new Set())}>Recolher todos</button></div> : null}</div>
        {rows.map(obligation => {
          const progress = obligationProgress(obligation)
          const complete = obligationIsComplete(obligation)
          const pct = complete ? 100 : progress.pct
          const due = dueInfo(obligation)
          const situation = obligationSituation(obligation)
          const expanded = expandedObligations.has(String(obligation.id))
          const receiptEnabled = controlsReceipt(obligation)
          return <article className={\`obligation-v2-container \${expanded ? 'expanded' : ''}\`} key={obligation.id}>
            <div className="obligation-v2-container-head">
              <div className="obligation-v2-container-title"><strong>{obligation.nome}</strong><span>{[obligation.categoria || 'Outros', obligation.competencia && \`Referência \${obligation.competencia}\`, \`\${progress.total} CNPJ\${progress.total === 1 ? '' : 's'}\`].filter(Boolean).join(' · ')}</span></div>
              <div className="obligation-v2-container-progress"><b>{progress.done} de {progress.applicable} concluído(s)</b><Progress value={pct} /></div>
              <div className="obligation-v2-container-due"><small>Vencimento</small><b>{due.mixed ? 'Datas diferentes' : formatDate(due.value)}</b></div>
              <span className={\`obligation-v2-situation situation-\${normalize(situation).replaceAll(' ', '-')}\`}>{situation}</span>
              <div className="obligation-v2-container-actions"><button type="button" onClick={() => openEdit(obligation)}>Editar</button><button type="button" className="obligation-v2-expand-button" aria-expanded={expanded} onClick={() => setExpandedObligations(current => { const next = new Set(current); const id = String(obligation.id); next.has(id) ? next.delete(id) : next.add(id); return next })}><span>{expanded ? 'Recolher' : 'Ver empresas'}</span><b aria-hidden="true">{expanded ? '⌃' : '⌄'}</b></button></div>
            </div>
            {expanded ? <div className={\`obligation-v2-company-list \${receiptEnabled ? 'with-receipt' : 'without-receipt'}\`}>
              <div className="obligation-v2-company-head"><span>Empresa</span><span>Vínculo</span><span>Status</span>{receiptEnabled ? <span>Recibo / protocolo</span> : null}<span /></div>
              {(obligation.clientes || []).map(link => {
                const entityType = inferLinkType(link, clientsById, linkedCompaniesById)
                const linked = entityType === 'linkedCompany'
                const entity = linked ? linkedCompaniesById.get(String(link.clienteId)) : clientsById.get(String(link.clienteId))
                const responsible = linked ? clientsById.get(String(entity?.clientId || '')) : null
                const typeLabel = linked ? 'Terceirizado' : entity?.relacionamento === 'Avulso' ? 'Avulso' : 'Cliente'
                const status = link.status || 'Pendente'
                return <div className="obligation-v2-company-row" key={entityKey(entityType, link.clienteId)}>
                  <div className="obligation-v2-company-name"><b>{clientName(entity)}</b><small>{entityDocument(entity) || 'Sem documento'}{linked && responsible ? \` · via \${clientName(responsible)}\` : ''}</small></div>
                  <span className={\`obligation-v2-link-badge link-\${linked ? 'outsourced' : entity?.relacionamento === 'Avulso' ? 'avulso' : 'client'}\`}>{typeLabel}</span>
                  <span className={\`obligation-status status-\${normalize(status).replaceAll(' ', '-')}\`}>{status}</span>
                  {receiptEnabled ? <span className={\`obligation-v2-receipt \${link.recibo ? 'filled' : ''}\`}>{link.recibo || '—'}</span> : null}
                  <button type="button" onClick={() => openDetails(obligation, link.clienteId)}>{tab === 'history' ? 'Consultar' : 'Abrir'}</button>
                </div>
              })}
              <footer><span>{progress.total} CNPJ{progress.total === 1 ? '' : 's'}</span><strong>{progress.done} concluído(s) · {Math.max(0, progress.applicable - progress.done)} pendente(s)</strong></footer>
            </div> : null}
          </article>
        })}
        {!rows.length ? <div className="obligation-empty">{tab === 'history' ? 'Nenhuma obrigação concluída encontrada.' : 'Nenhuma obrigação em aberto encontrada.'}</div> : null}
      </div>`

  if (!workspace.includes('className="obligation-v2-accordion"')) {
    workspace = replaceRange(
      workspace,
      '<div className="obligation-table obligation-v2-table">',
      '    </section>\n\n    {editing ? <Modal',
      `${accordionMarkup}\n`,
      'accordion obligation list',
    )
  }

  writeFileSync(workspacePath, workspace)

  const intelligencePath = `${root}src/lib/operationalIntelligence.js`
  let intelligence = readFileSync(intelligencePath, 'utf8')
  const statusGuard = "const operationalStatus = normalize(link.status || 'Pendente')\n      if (!includeDone && !['pendente', 'em andamento'].includes(operationalStatus)) return"
  if (!intelligence.includes(statusGuard)) {
    const anchor = "const done = obligationDone(link)\n      if (!includeDone && done) return"
    if (!intelligence.includes(anchor)) throw new Error('Obligations v2 patch failed (Meu Dia status guard)')
    intelligence = intelligence.replace(anchor, `const done = obligationDone(link)\n      ${statusGuard}\n      if (!includeDone && done) return`)
    writeFileSync(intelligencePath, intelligence)
  }
}
