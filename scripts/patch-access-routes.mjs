import { readFileSync, writeFileSync } from 'node:fs'

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Access routes patch failed (${label})`)
  return source.replace(from, to)
}

export function applyAccessRoutesPatch(root) {
  const appPath = `${root}src/App.jsx`
  let source = readFileSync(appPath, 'utf8')
  if (source.includes("ClientDirectoryReadOnly from './components/ClientDirectoryReadOnly.jsx'")) return

  source = replaceOrFail(source,
    "import TeamManagement from './components/TeamManagement.jsx'",
    "import TeamManagement from './components/TeamManagement.jsx'\nimport ClientDirectoryReadOnly from './components/ClientDirectoryReadOnly.jsx'",
    'readonly client import')

  source = replaceOrFail(source,
    "      {view === 'clientes' ? <ClientsReact office={office} update={update} sync={sync} onOpenTasks={openTasksForClient} onOpenProcesses={openProcessesForClient} onOpenFinance={openFinanceForClient} initialClientId={clientTarget.id} openClientRequest={clientTarget.request} /> : null}",
    "      {view === 'clientes' ? (access?.membership?.role === 'partner' || (access?.membership?.role === 'collaborator' && !access?.membership?.permissions?.manage_clients) ? <ClientDirectoryReadOnly office={office} access={access} onOpenTasks={openTasksForClient} onOpenProcesses={openProcessesForClient} /> : <ClientsReact office={office} update={update} sync={sync} onOpenTasks={openTasksForClient} onOpenProcesses={openProcessesForClient} onOpenFinance={openFinanceForClient} initialClientId={clientTarget.id} openClientRequest={clientTarget.request} />) : null}",
    'readonly clients route')

  writeFileSync(appPath, source)
}
