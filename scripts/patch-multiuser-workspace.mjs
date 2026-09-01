import { readFileSync, writeFileSync } from 'node:fs'

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Multiuser workspace patch failed (${label})`)
  return source.replace(from, to)
}

export function applyMultiuserWorkspacePatch(root) {
  const appPath = `${root}src/App.jsx`
  let app = readFileSync(appPath, 'utf8')
  if (!app.includes("TeamManagement from './components/TeamManagement.jsx'")) {
    app = replaceOrFail(app,
      "import { lazy, Suspense, useMemo, useState } from 'react'",
      "import { lazy, Suspense, useEffect, useMemo, useState } from 'react'",
      'react useEffect')

    app = replaceOrFail(app,
      "import { AppSidebar, AppTopbar } from './components/AppChrome.jsx'",
      "import { AppSidebar, AppTopbar, navigationGroupsForAccess } from './components/AppChrome.jsx'\nimport TeamManagement from './components/TeamManagement.jsx'\nimport TeamErrorBoundary from './components/TeamErrorBoundary.jsx'\nimport PartnerFinanceView from './components/PartnerFinanceView.jsx'\nimport InviteSetup from './components/InviteSetup.jsx'\nimport './team-multiuser.css'",
      'imports')

    app = replaceOrFail(app,
      "  const { office, update, ready, sync } = useOfficeData(session)",
      "  const { office, update, ready, sync, access, switchWorkspace, refreshWorkspace } = useOfficeData(session)",
      'workspace hook')

    app = replaceOrFail(app,
      "  const [globalQuery, setGlobalQuery] = useState('')",
      "  const [globalQuery, setGlobalQuery] = useState('')\n  const [inviteSetupOpen, setInviteSetupOpen] = useState(() => new URLSearchParams(window.location.search).get('invite') === '1')\n\n  useEffect(() => {\n    if (!ready || !access?.membership?.role) return\n    const allowed = new Set(navigationGroupsForAccess(access).flatMap(group => group.items.map(([id]) => id)))\n    if (access.membership.role !== 'partner') allowed.add('configuracoes')\n    if (!allowed.has(view)) setView('meu-dia')\n  }, [access?.membership?.role, access?.membership?.permissions, access?.workspace?.id, ready, view])",
      'route guard')

    app = replaceOrFail(app,
      "  function openFinanceForClient(clientId, create = false) {\n    setFinanceTarget(current => ({",
      "  function openFinanceForClient(clientId, create = false) {\n    if (access?.membership?.role === 'partner') { setView('financeiro-parceiro'); return }\n    if (access?.membership?.role === 'collaborator' && !access?.membership?.permissions?.finance) return\n    setFinanceTarget(current => ({",
      'finance guard')

    app = replaceOrFail(app,
      "    <AppSidebar currentView={view} identity={identity} sync={sync} collapsed={collapsed} notificationsOpen={notificationsOpen} onToggle={toggleSidebar} onNavigate={navigate} onSignOut={signOut} />",
      "    <AppSidebar currentView={view} identity={identity} sync={sync} collapsed={collapsed} notificationsOpen={notificationsOpen} access={access} onSwitchWorkspace={switchWorkspace} onToggle={toggleSidebar} onNavigate={navigate} onSignOut={signOut} />",
      'sidebar access')

    app = replaceOrFail(app,
      "    <AppTopbar currentView={view} query={globalQuery} onQueryChange={setGlobalQuery} searchResults={searchResults} onChooseResult={chooseSearchResult} notificationsCount={notificationItems.length} notificationsOpen={notificationsOpen} onToggleNotifications={() => setNotificationsOpen(current => !current)} identity={identity} />",
      "    <AppTopbar currentView={view} query={globalQuery} onQueryChange={setGlobalQuery} searchResults={searchResults} onChooseResult={chooseSearchResult} notificationsCount={notificationItems.length} notificationsOpen={notificationsOpen} onToggleNotifications={() => setNotificationsOpen(current => !current)} identity={identity} access={access} />",
      'topbar access')

    app = replaceOrFail(app,
      "      {view === 'meu-dia' || view === 'pendencias' ? <OperationalCommandCenter office={office} update={update} onOpenItem={openNotification} onNavigate={navigate} initialTab={view === 'pendencias' ? 'pending' : 'today'} /> : null}",
      "      {view === 'meu-dia' || view === 'pendencias' ? <OperationalCommandCenter office={office} update={update} access={access} onOpenItem={openNotification} onNavigate={navigate} initialTab={view === 'pendencias' ? 'pending' : 'today'} /> : null}\n      {view === 'equipe' ? (access?.membership?.role === 'admin' ? <TeamErrorBoundary><TeamManagement office={office} update={update} access={access} onRefresh={refreshWorkspace} /></TeamErrorBoundary> : <section className=\"team-shell\"><div className=\"team-panel team-access-state\"><header><div><span>Equipe do escritório</span><h2>{ready ? 'Acesso da equipe indisponível' : 'Carregando acesso…'}</h2><p>{ready ? 'Não foi possível confirmar um perfil de administrador para este workspace. Seus dados continuam preservados.' : 'Estamos confirmando seu perfil e as permissões do escritório.'}</p></div></header><div className=\"team-loading\">{ready ? <button type=\"button\" onClick={() => window.location.reload()}>Tentar novamente</button> : 'Aguarde alguns segundos…'}</div></div></section>) : null}\n      {view === 'financeiro-parceiro' && access?.membership?.role === 'partner' ? <PartnerFinanceView office={office} access={access} /> : null}",
      'workspace routes')

    app = replaceOrFail(app,
      "      {view === 'dashboard' ? <Dashboard office={office} update={update} sync={sync} session={session} onNewTask={openTasksForClient} onNavigate={navigate} /> : null}",
      "      {view === 'dashboard' ? <Dashboard office={office} update={update} sync={sync} session={access?.membership?.role === 'admin' ? session : null} onNewTask={openTasksForClient} onNavigate={navigate} /> : null}",
      'dashboard integration guard')

    app = replaceOrFail(app,
      "      {view !== 'meu-dia' && view !== 'pendencias' && view !== 'dashboard' && view !== 'calendario' && view !== 'clientes' && view !== 'obrigacoes' && view !== 'processos' && view !== 'tarefas' && view !== 'honorarios' ? <LegacyModule view={view} record={legacyTarget} /> : null}",
      "      {view !== 'meu-dia' && view !== 'pendencias' && view !== 'equipe' && view !== 'financeiro-parceiro' && view !== 'dashboard' && view !== 'calendario' && view !== 'clientes' && view !== 'obrigacoes' && view !== 'processos' && view !== 'tarefas' && view !== 'honorarios' ? <LegacyModule view={view} record={legacyTarget} /> : null}",
      'legacy exclusions')

    app = replaceOrFail(app,
      "  return <div className={`react-shell ${collapsed ? 'is-collapsed' : ''}`}>",
      "  return <>\n    {inviteSetupOpen && session ? <InviteSetup session={session} access={access} onDone={() => setInviteSetupOpen(false)} /> : null}\n    <div className={`react-shell ${collapsed ? 'is-collapsed' : ''}`}>",
      'invite modal open')

    app = replaceOrFail(app,
      "    </main>\n  </div>\n}",
      "    </main>\n  </div>\n  </>\n}",
      'invite modal close')

    writeFileSync(appPath, app)
  }

  const commandPath = `${root}src/components/OperationalCommandCenter.jsx`
  let command = readFileSync(commandPath, 'utf8')
  if (!command.includes("personalOfficeForAccess from '../lib/memberOfficeView.js'")) {
    command = replaceOrFail(command,
      "import { today } from '../lib/storage.js'",
      "import { today } from '../lib/storage.js'\nimport { personalOfficeForAccess } from '../lib/memberOfficeView.js'",
      'command center personal import')

    command = replaceOrFail(command,
      "export default function OperationalCommandCenter({ office, update, onOpenItem, onNavigate, initialTab = 'today' }) {\n  const day = today()",
      "export default function OperationalCommandCenter({ office, update, access, onOpenItem, onNavigate, initialTab = 'today' }) {\n  const day = today()\n  const commandOffice = useMemo(() => personalOfficeForAccess(office, access), [office, access])",
      'command center signature')

    command = command.replaceAll('buildMyDay(office, { day })', 'buildMyDay(commandOffice, { day })')
    command = command.replaceAll('buildWeekPlan(office, { day })', 'buildWeekPlan(commandOffice, { day })')
    command = command.replaceAll('buildOperationalMetrics(office, { day })', 'buildOperationalMetrics(commandOffice, { day })')
    command = command.replaceAll('collectCommandCenterItems(office, { day, daysBefore: 45 })', 'collectCommandCenterItems(commandOffice, { day, daysBefore: 45 })')
    command = command.replaceAll('buildClientTimeline(office, clientId)', 'buildClientTimeline(commandOffice, clientId)')
    command = command.replaceAll('answerOfficeQuery(office, query, { day })', 'answerOfficeQuery(commandOffice, query, { day })')
    command = command.replaceAll('answerOfficeQuery(office, value, { day })', 'answerOfficeQuery(commandOffice, value, { day })')
    command = command.replace("const clients = useMemo(() => (office.clients || [])", "const clients = useMemo(() => (commandOffice.clients || [])")
    command = command.replace('}, [office.clients])', '}, [commandOffice.clients])')
    writeFileSync(commandPath, command)
  }
}
