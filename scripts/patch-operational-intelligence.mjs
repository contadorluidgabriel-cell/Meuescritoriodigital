import { readFileSync, writeFileSync } from 'node:fs'

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Operational intelligence patch failed (${label})`)
  return source.replace(from, to)
}

export function applyOperationalIntelligencePatch(root) {
  const path = `${root}src/App.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes("OperationalCommandCenter from './components/OperationalCommandCenter.jsx'")) return

  source = replaceOrFail(
    source,
    "import PushNotificationSettings from './components/PushNotificationSettings.jsx'\nimport './push-notifications.css'",
    "import PushNotificationSettings from './components/PushNotificationSettings.jsx'\nimport OperationalCommandCenter from './components/OperationalCommandCenter.jsx'\nimport './push-notifications.css'\nimport './operational-command-center.css'",
    'imports',
  )

  source = replaceOrFail(
    source,
    "  const initialPushView = ['tarefas', 'calendario', 'honorarios'].includes(requestedPushView) ? requestedPushView : 'dashboard'",
    "  const initialPushView = ['meu-dia', 'pendencias', 'tarefas', 'calendario', 'honorarios'].includes(requestedPushView) ? requestedPushView : 'meu-dia'",
    'default command center view',
  )

  source = replaceOrFail(
    source,
    "    <main className=\"react-workspace\">\n      {view === 'dashboard' ? <Dashboard office={office} update={update} sync={sync} session={session} onNewTask={openTasksForClient} onNavigate={navigate} /> : null}",
    "    <main className=\"react-workspace\">\n      {view === 'meu-dia' || view === 'pendencias' ? <OperationalCommandCenter office={office} update={update} onOpenItem={openNotification} onNavigate={navigate} initialTab={view === 'pendencias' ? 'pending' : 'today'} /> : null}\n      {view === 'dashboard' ? <Dashboard office={office} update={update} sync={sync} session={session} onNewTask={openTasksForClient} onNavigate={navigate} /> : null}",
    'command center route',
  )

  source = replaceOrFail(
    source,
    "      {view !== 'dashboard' && view !== 'calendario' && view !== 'clientes' && view !== 'obrigacoes' && view !== 'processos' && view !== 'tarefas' && view !== 'honorarios' ? <LegacyModule view={view} record={legacyTarget} /> : null}",
    "      {view !== 'meu-dia' && view !== 'pendencias' && view !== 'dashboard' && view !== 'calendario' && view !== 'clientes' && view !== 'obrigacoes' && view !== 'processos' && view !== 'tarefas' && view !== 'honorarios' ? <LegacyModule view={view} record={legacyTarget} /> : null}",
    'legacy exclusion',
  )

  writeFileSync(path, source)
}
