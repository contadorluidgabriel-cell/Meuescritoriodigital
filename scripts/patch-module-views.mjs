import { readFileSync, writeFileSync } from 'node:fs'

const marker = 'MED_OPERATIONAL_MODULE_VIEWS_V1'

function replaceRequired(source, from, to, label, path) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`Module views patch failed (${label}) in ${path}`)
  return source.replace(from, to)
}

function replaceRegexRequired(source, pattern, replacement, label, path) {
  if (typeof replacement === 'string' && source.includes(replacement)) return source
  if (!pattern.test(source)) throw new Error(`Module views patch failed (${label}) in ${path}`)
  pattern.lastIndex = 0
  return source.replace(pattern, replacement)
}

function patchApp(root) {
  const path = root + 'src/App.jsx'
  let source = readFileSync(path, 'utf8')
  if (source.includes("import ModelsReact from './components/ModelsReact.jsx'")) return

  source = replaceRequired(
    source,
    "import TasksReact from './components/TasksReact.jsx'",
    "import TasksReact from './components/TasksReact.jsx'\nimport ModelsReact from './components/ModelsReact.jsx'",
    'models import',
    path,
  )

  source = source.replace(
    /<TasksReact office=\{office\} update=\{update\} sync=\{sync\} session=\{session\}(?![^>]*access=)/,
    '<TasksReact office={office} update={update} sync={sync} session={session} access={access} onNavigate={navigate}',
  )
  source = source.replace(
    /<ProcessesReact office=\{office\} update=\{update\} sync=\{sync\}(?![^>]*onNavigate=)/,
    '<ProcessesReact office={office} update={update} sync={sync} onNavigate={navigate}',
  )

  const financeRoute = "{view === 'honorarios' ? <Suspense"
  if (!source.includes("{view === 'modelos' ? <ModelsReact")) {
    const index = source.indexOf(financeRoute)
    if (index < 0) throw new Error(`Module views patch failed (models route anchor) in ${path}`)
    source = source.slice(0, index) + "{view === 'modelos' ? <ModelsReact office={office} update={update} sync={sync} access={access} /> : null}\n      " + source.slice(index)
  }

  source = source.replace(
    /view !== 'honorarios' \? <LegacyModule/,
    "view !== 'honorarios' && view !== 'modelos' ? <LegacyModule",
  )

  writeFileSync(path, source)
}

function patchChrome(root) {
  const path = root + 'src/components/AppChrome.jsx'
  let source = readFileSync(path, 'utf8')
  if (source.includes("models: item('modelos', 'Modelos'")) return

  source = replaceRegexRequired(
    source,
    /(\s+obligations:\s*item\('obrigacoes',\s*'Obrigações',\s*'obligations'\),)/,
    "$1\n  models: item('modelos', 'Modelos', 'settings'),",
    'models navigation item',
    path,
  )
  source = source.replace("processos: 'Processos',", "processos: 'Processos', modelos: 'Modelos',")

  source = source.replace(
    "if (allowed('obligations')) operation.push(common.obligations)",
    "if (allowed('obligations')) operation.push(common.obligations)\n    if (allowed('tasks') || allowed('processes')) operation.push(common.models)",
  )

  source = source.replace(
    /items:\s*\[item\('dashboard', 'Painel do Escritório', 'dashboard'\), item\('honorarios', 'Financeiro', 'finance'\), item\('equipe', 'Usuários', 'clients'\)\]/,
    "items: [item('dashboard', 'Painel do Escritório', 'dashboard'), item('honorarios', 'Financeiro', 'finance'), item('equipe', 'Usuários', 'clients'), common.models]",
  )

  source = source.replace(
    "id === 'processos' ? 'Fluxos e protocolos' : id === 'obrigacoes'",
    "id === 'processos' ? 'Fluxos e protocolos' : id === 'modelos' ? 'Modelos de tarefas e processos' : id === 'obrigacoes'",
  )

  writeFileSync(path, source)
}

function patchTasks(root) {
  const path = root + 'src/components/TasksReactBase.jsx'
  let source = readFileSync(path, 'utf8')
  if (source.includes('MED_TASK_OPERATIONAL_VIEWS_V1')) return

  const reactImport = source.match(/import\s+\{[^}]+\}\s+from ['"]react['"]\n/)
  if (!reactImport) throw new Error(`Module views patch failed (task react import) in ${path}`)
  source = source.replace(reactImport[0], reactImport[0] + "import { TASK_VIEW_OPTIONS, taskViewOf } from '../lib/moduleViews.js'\n")

  source = replaceRegexRequired(
    source,
    /export default function ([^(]+)\(\{([^}]*)\}\) \{/,
    (match, name, props) => {
      let next = props
      if (!/\baccess\b/.test(next)) next += ', access'
      if (!/\bonNavigate\b/.test(next)) next += ', onNavigate'
      return `export default function ${name}({${next}}) {`
    },
    'task component props',
    path,
  )

  if (source.includes("const [view, setView] = useState('tasks'),")) {
    source = source.replace(
      "const [view, setView] = useState('tasks'),",
      "const [view, setView] = useState('tasks')\n  const [taskView, setTaskView] = useState('mine')\n  const MED_TASK_OPERATIONAL_VIEWS_V1 = true\n  const",
    )
  } else {
    source = replaceRequired(
      source,
      "  const [view, setView] = useState('tasks')",
      "  const [view, setView] = useState('tasks')\n  const [taskView, setTaskView] = useState('mine')\n  const MED_TASK_OPERATIONAL_VIEWS_V1 = true",
      'task view state',
      path,
    )
  }

  source = replaceRequired(
    source,
    "  const visibleRows = useMemo(() => rows.filter(task => !isDone(task.status) && (!competenciaFilter || String(task.competencia || '') === competenciaFilter)), [competenciaFilter, rows])",
    "  const currentTaskUserId = String(access?.membership?.user_id || session?.user?.id || '')\n  const taskViewCounts = useMemo(() => (office.tasks || []).reduce((counts, task) => { const key = taskViewOf(task, currentTaskUserId); counts[key] = (counts[key] || 0) + 1; return counts }, { mine: 0, team: 0, waiting: 0, completed: 0 }), [currentTaskUserId, office.tasks])\n  const visibleRows = useMemo(() => rows.filter(task => taskViewOf(task, currentTaskUserId) === taskView && (!competenciaFilter || String(task.competencia || '') === competenciaFilter)), [competenciaFilter, currentTaskUserId, rows, taskView])",
    'task visible rows',
    path,
  )

  source = source.replace(
    "useEffect(() => { setSelected(new Set()) }, [competenciaFilter, priority, query, status])",
    "useEffect(() => { setSelected(new Set()) }, [competenciaFilter, priority, query, status, taskView])",
  )

  source = source.replace(
    'Tarefas, subtarefas, recorrências e modelos em uma única área.',
    'Organize a execução por responsável, dependência e conclusão.',
  )
  source = source.replace(
    /<button onClick=\{\(\) => setView\('models'\)\}>Modelos<\/button>/,
    "<button type=\"button\" onClick={() => onNavigate?.('modelos')}>Modelos</button>",
  )

  source = replaceRegexRequired(
    source,
    /<div className="task-view-tabs" role="tablist">[\s\S]*?<\/div>/,
    '<div className="module-view-tabs task-operation-tabs" role="tablist" aria-label="Visões de tarefas">{TASK_VIEW_OPTIONS.map(([id, label]) => <button type="button" role="tab" aria-selected={taskView === id} className={taskView === id ? \'active\' : \'\'} onClick={() => setTaskView(id)} key={id}><span>{label}</span><b>{taskViewCounts[id] || 0}</b></button>)}</div>',
    'task tabs',
    path,
  )

  source = source.replace(/<div className="task-history-toolbar">[\s\S]*?<\/div>/, '')
  source = source.replace(
    '<div className="empty">Nenhuma tarefa em aberto encontrada.</div>',
    '<div className="empty">Nenhuma tarefa encontrada nesta visão.</div>',
  )

  source = '// MED_TASK_OPERATIONAL_VIEWS_V1\n' + source
  writeFileSync(path, source)
}

function patchProcesses(root) {
  const path = root + 'src/components/ProcessesReact.jsx'
  let source = readFileSync(path, 'utf8')
  if (source.includes('MED_PROCESS_OPERATIONAL_VIEWS_V1')) return

  const reactImport = source.match(/import\s+\{[^}]+\}\s+from ['"]react['"]\n/)
  if (!reactImport) throw new Error(`Module views patch failed (process react import) in ${path}`)
  source = source.replace(reactImport[0], reactImport[0] + "import { PROCESS_VIEW_OPTIONS, processViewOf } from '../lib/moduleViews.js'\n")

  source = replaceRegexRequired(
    source,
    /export default function ([^(]+)\(\{([^}]*)\}\) \{/,
    (match, name, props) => {
      let next = props
      if (!/\bonNavigate\b/.test(next)) next += ', onNavigate'
      return `export default function ${name}({${next}}) {`
    },
    'process component props',
    path,
  )

  if (source.includes("const [view, setView] = useState('processes'),")) {
    source = source.replace(
      "const [view, setView] = useState('processes'),",
      "const [view, setView] = useState('processes')\n  const [processView, setProcessView] = useState('active')\n  const MED_PROCESS_OPERATIONAL_VIEWS_V1 = true\n  const",
    )
  } else {
    source = replaceRequired(
      source,
      "  const [view, setView] = useState('processes')",
      "  const [view, setView] = useState('processes')\n  const [processView, setProcessView] = useState('active')\n  const MED_PROCESS_OPERATIONAL_VIEWS_V1 = true",
      'process view state',
      path,
    )
  }

  source = replaceRequired(
    source,
    '  const selectedProcess = useMemo',
    "  const processViewCounts = useMemo(() => (office.processes || []).reduce((counts, process) => { const key = processViewOf(process); counts[key] = (counts[key] || 0) + 1; return counts }, { active: 0, waiting: 0, completed: 0 }), [office.processes])\n  const visibleProcessRows = useMemo(() => rows.filter(process => processViewOf(process) === processView), [processView, rows])\n  const selectedProcess = useMemo",
    'process visible rows',
    path,
  )

  source = source.replace(
    'Fluxos flexíveis, etapas e múltiplos protocolos.',
    'Separe o que está em execução, o que depende de terceiros e o que já foi concluído.',
  )

  source = source.replace(
    '<span className="sync-indicator">{sync}</span><button type="button" className="primary" onClick={() => setEditing({})}>+ Novo processo</button>',
    '<span className="sync-indicator">{sync}</span><button type="button" onClick={() => onNavigate?.(\'modelos\')}>Modelos</button><button type="button" className="primary" onClick={() => setEditing({})}>+ Novo processo</button>',
  )

  source = replaceRegexRequired(
    source,
    /<div className="process-tabs" role="tablist" aria-label="Processos e modelos">[\s\S]*?<\/div>/,
    '<div className="module-view-tabs process-operation-tabs" role="tablist" aria-label="Visões de processos">{PROCESS_VIEW_OPTIONS.map(([id, label]) => <button type="button" role="tab" aria-selected={processView === id} className={processView === id ? \'active\' : \'\'} onClick={() => setProcessView(id)} key={id}><span>{label}</span><b>{processViewCounts[id] || 0}</b></button>)}</div>',
    'process tabs',
    path,
  )

  source = source.replace('{rows.map(process => {', '{visibleProcessRows.map(process => {')
  source = source.replace('{rows.length ? null : <p className="process-empty">Nenhum processo encontrado.</p>}', '{visibleProcessRows.length ? null : <p className="process-empty">Nenhum processo encontrado nesta visão.</p>}')

  source = '// MED_PROCESS_OPERATIONAL_VIEWS_V1\n' + source
  writeFileSync(path, source)
}

function patchObligations(root) {
  const path = root + 'src/components/ObligationsWorkspace.jsx'
  let source = readFileSync(path, 'utf8')
  if (source.includes('MED_OBLIGATION_OPERATIONAL_VIEWS_V1')) return

  source = replaceRequired(
    source,
    "import { today, uid } from '../lib/storage.js'",
    "import { today, uid } from '../lib/storage.js'\nimport { OBLIGATION_VIEW_OPTIONS, obligationViewOf } from '../lib/moduleViews.js'",
    'obligation view import',
    path,
  )
  source = replaceRequired(source, "  const [tab, setTab] = useState('open')", "  const [tab, setTab] = useState('pending')\n  const MED_OBLIGATION_OPERATIONAL_VIEWS_V1 = true", 'obligation tab state', path)

  source = replaceRequired(
    source,
    "  const openRows = useMemo(() => (office.obligations || []).filter(item => !obligationIsComplete(item) && matchesSearch(item)), [matchesSearch, office.obligations])\n  const historyRows = useMemo(() => (office.obligations || []).filter(item => obligationIsComplete(item) && matchesSearch(item)), [matchesSearch, office.obligations])\n  const rows = tab === 'history' ? historyRows : openRows",
    "  const matchingRows = useMemo(() => (office.obligations || []).filter(matchesSearch), [matchesSearch, office.obligations])\n  const obligationViewCounts = useMemo(() => (office.obligations || []).reduce((counts, obligation) => { const key = obligationViewOf(obligation); counts[key] = (counts[key] || 0) + 1; counts.all += 1; return counts }, { pending: 0, progress: 0, completed: 0, all: 0 }), [office.obligations])\n  const rows = useMemo(() => tab === 'all' ? matchingRows : matchingRows.filter(obligation => obligationViewOf(obligation) === tab), [matchingRows, tab])",
    'obligation row views',
    path,
  )

  source = source.replace(
    "if (obligation) { if (obligationIsComplete(obligation)) setTab('history'); openDetails(obligation, initialClientId) }",
    "if (obligation) { setTab(obligationViewOf(obligation)); openDetails(obligation, initialClientId) }",
  )
  source = source.replace("className={tab === 'open' ? 'active' : ''} onClick={() => setTab('open')}", "className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}")
  source = source.replace("className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}", "className={tab === 'completed' ? 'active' : ''} onClick={() => setTab('completed')}")
  source = source.replace("{tab === 'open' ? <ObligationDeadlinesBoard", "{tab !== 'completed' ? <ObligationDeadlinesBoard")

  source = replaceRegexRequired(
    source,
    /<div className="obligation-v2-tabs">[\s\S]*?<\/div><div className="obligation-filters">/,
    '<div className="module-view-tabs obligation-operation-tabs" role="tablist" aria-label="Visões de obrigações">{OBLIGATION_VIEW_OPTIONS.map(([id, label]) => <button type="button" role="tab" aria-selected={tab === id} className={tab === id ? \'active\' : \'\'} onClick={() => setTab(id)} key={id}><span>{label}</span><b>{obligationViewCounts[id] || 0}</b></button>)}</div><div className="obligation-filters">',
    'obligation tabs',
    path,
  )

  source = source.replace("placeholder={tab === 'history' ? 'Buscar por obrigação, competência, cliente ou CNPJ' : 'Buscar obrigação, cliente ou CNPJ'}", "placeholder={tab === 'completed' ? 'Buscar concluídas por obrigação, competência, cliente ou CNPJ' : 'Buscar obrigação, cliente ou CNPJ'}")
  source = source.replace("tab={tab} onOpenDetails", "tab={tab === 'completed' ? 'history' : 'open'} onOpenDetails")
  source = source.replace("{tab === 'history' ? 'Consultar' : 'Acompanhar'}", "{obligationViewOf(obligation) === 'completed' ? 'Consultar' : 'Acompanhar'}")
  source = source.replace("{tab === 'history' ? 'Nenhuma obrigação concluída encontrada.' : 'Nenhuma obrigação em aberto encontrada.'}", "'Nenhuma obrigação encontrada nesta visão.'")

  source = '// MED_OBLIGATION_OPERATIONAL_VIEWS_V1\n' + source
  writeFileSync(path, source)
}

function patchPartners(root) {
  const path = root + 'src/components/PartnersPanel.jsx'
  let source = readFileSync(path, 'utf8')
  if (source.includes('MED_PARTNER_OPERATIONAL_VIEWS_V1')) return

  source = replaceRequired(
    source,
    "import { allPartnerBalances, clientPartnerIds } from '../lib/sharedWork.js'",
    "import { allPartnerBalances, clientPartnerIds } from '../lib/sharedWork.js'\nimport { PARTNER_VIEW_OPTIONS, partnerViewOf } from '../lib/moduleViews.js'",
    'partner views import',
    path,
  )
  source = replaceRequired(
    source,
    "  const [editing, setEditing] = useState(null)",
    "  const [editing, setEditing] = useState(null)\n  const [partnerView, setPartnerView] = useState('active')\n  const MED_PARTNER_OPERATIONAL_VIEWS_V1 = true",
    'partner view state',
    path,
  )
  source = replaceRequired(
    source,
    "  const partners = useMemo(() => (office.partners || [])\n    .slice()\n    .sort((a, b) => partnerName(a).localeCompare(partnerName(b), 'pt-BR')), [office.partners])",
    "  const allPartners = useMemo(() => (office.partners || []).slice().sort((a, b) => partnerName(a).localeCompare(partnerName(b), 'pt-BR')), [office.partners])\n  const partnerViewCounts = useMemo(() => allPartners.reduce((counts, partner) => { const key = partnerViewOf(partner); counts[key] = (counts[key] || 0) + 1; return counts }, { active: 0, inactive: 0 }), [allPartners])\n  const partners = useMemo(() => allPartners.filter(partner => partnerViewOf(partner) === partnerView), [allPartners, partnerView])",
    'partner filtered list',
    path,
  )
  source = source.replace("    setEditing(null)\n  }", "    setEditing(null)\n    setPartnerView(partnerViewOf(record))\n  }")

  source = source.replace(
    "      </div>\n\n      {partners.length ? <div className=\"outsourced-grid partner-grid\">",
    "      </div>\n\n      <div className=\"module-view-tabs partner-operation-tabs\" role=\"tablist\" aria-label=\"Visões de parceiros\">{PARTNER_VIEW_OPTIONS.map(([id, label]) => <button type=\"button\" role=\"tab\" aria-selected={partnerView === id} className={partnerView === id ? 'active' : ''} onClick={() => setPartnerView(id)} key={id}><span>{label}</span><b>{partnerViewCounts[id] || 0}</b></button>)}</div>\n\n      {partners.length ? <div className=\"outsourced-grid partner-grid\">",
  )
  source = source.replace(
    '<div className="outsourced-empty">Nenhum parceiro de trabalho cadastrado.</div>',
    '<div className="outsourced-empty">Nenhum parceiro nesta visão.</div>',
  )

  source = '// MED_PARTNER_OPERATIONAL_VIEWS_V1\n' + source
  writeFileSync(path, source)
}

export function applyModuleViewsPatch(root) {
  patchApp(root)
  patchChrome(root)
  patchTasks(root)
  patchProcesses(root)
  patchObligations(root)
  patchPartners(root)
}
