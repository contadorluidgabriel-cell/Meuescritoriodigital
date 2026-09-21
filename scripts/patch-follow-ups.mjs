import { readFileSync, writeFileSync } from 'node:fs'

function replace(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Follow-ups integration: missing ${label}`)
  return source.replace(from, to)
}

export function applyFollowUpsPatch(root) {
  const chromePath = `${root}src/components/AppChrome.jsx`
  let chrome = readFileSync(chromePath, 'utf8')
  if (!chrome.includes("followUps: item('acompanhamentos'")) {
    chrome = replace(chrome, "  processes: item('processos', 'Processos', 'processes'),", "  processes: item('processos', 'Processos', 'processes'),\n  followUps: item('acompanhamentos', 'Acompanhamentos', 'calendar'),", 'navigation constant')
    chrome = replace(chrome, "processos: 'Processos', obrigacoes: 'Obrigações'", "processos: 'Processos', acompanhamentos: 'Acompanhamentos', obrigacoes: 'Obrigações'", 'page title')
    chrome = replace(chrome, "    if (allowed('processes')) operation.push(common.processes)", "    if (allowed('processes')) operation.push(common.processes)\n    operation.push(common.followUps)", 'collaborator navigation')
    chrome = replace(chrome, "items: [common.clients, common.tasks, common.processes, common.obligations] },\n    { label: 'Gestão'", "items: [common.clients, common.tasks, common.processes, common.followUps, common.obligations] },\n    { label: 'Gestão'", 'administrator navigation')
    writeFileSync(chromePath, chrome)
  }

  const appPath = `${root}src/App.jsx`
  let app = readFileSync(appPath, 'utf8')
  if (app.includes('MED_RESULT_FOLLOWUPS_APP_V1')) return
  app = replace(app, "import { useOfficeData } from './hooks/useOfficeData.js'", "import { useOfficeData } from './hooks/useOfficeData.js'\nimport { useFollowUps } from './hooks/useFollowUps.js'\nimport FollowUpsWorkspace, { FollowUpsToday } from './components/FollowUpsWorkspace.jsx'\n// MED_RESULT_FOLLOWUPS_APP_V1", 'hook imports')
  app = replace(app, "  const identity = useLegacyIdentity()", "  const identity = useLegacyIdentity()\n  const followUps = useFollowUps(access?.workspace?.id || '', session?.user?.id || '')\n  const [followUpTarget, setFollowUpTarget] = useState({ id: '', request: 0 })", 'hook state')
  app = replace(app, "    setLegacyTarget({ type: '', id: '', request: 0 })", "    setLegacyTarget({ type: '', id: '', request: 0 })\n    setFollowUpTarget({ id: '', request: 0 })", 'route reset')
  app = replace(app, "  function openTasksForClient(clientId) {", "  function openFollowUp(id) {\n    setFollowUpTarget(current => ({ id: String(id || ''), request: current.request + 1 }))\n    setView('acompanhamentos')\n  }\n\n  function openClientFromFollowUp(clientId) {\n    setClientTarget(current => ({ id: String(clientId || ''), request: current.request + 1 }))\n    setView('clientes')\n  }\n\n  function openWorkFromFollowUp(type, recordId) {\n    if (type === 'process') { openProcessesForClient('', recordId); return }\n    setTaskEditTarget(current => ({ id: recordId, request: current.request + 1 }))\n    setView('tarefas')\n  }\n\n  function openTasksForClient(clientId) {", 'navigation handlers')
  const route = "      {view === 'equipe' ?"
  if (!app.includes(route)) throw new Error('Follow-ups integration: team route missing')
  app = app.replace(route, "      {view === 'acompanhamentos' ? <FollowUpsWorkspace office={office} followUps={followUps} userId={session?.user?.id || ''} manager={access?.membership?.role === 'admin'} focusId={followUpTarget.id} focusRequest={followUpTarget.request} onOpenClient={openClientFromFollowUp} onOpenSource={openWorkFromFollowUp} onCreateTask={clientId => openTasksForClient(clientId)} /> : null}\n      {view === 'meu-dia' ? <FollowUpsToday records={followUps.records} office={office} userId={session?.user?.id || ''} onOpen={openFollowUp} onNavigate={navigate} /> : null}\n" + route)
  app = replace(app, "view !== 'equipe' && view !== 'financeiro-parceiro'", "view !== 'acompanhamentos' && view !== 'equipe' && view !== 'financeiro-parceiro'", 'legacy routing exclusion')
  writeFileSync(appPath, app)
}
