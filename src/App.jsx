import { lazy, Suspense, useMemo, useState } from 'react'
import Login from './components/Login.jsx'
import LegacyModule from './components/LegacyModule.jsx'
import ClientsReact from './components/ClientsReact.jsx'
import TasksReact from './components/TasksReact.jsx'
import Dashboard from './components/Dashboard.jsx'
import CalendarReact from './components/CalendarReact.jsx'
import ObligationsReact from './components/ObligationsReact.jsx'
import { AppSidebar, AppTopbar } from './components/AppChrome.jsx'
import { useAuthSession } from './hooks/useAuthSession.js'
import { useLegacyIdentity } from './hooks/useLegacyIdentity.js'
import { useOfficeData } from './hooks/useOfficeData.js'
import { collectCalendarEvents } from './lib/calendarEvents.js'

const ProcessesReact = lazy(() => import('./components/ProcessesReact.jsx'))
const FinanceReact = lazy(() => import('./components/FinanceReact.jsx'))

const notificationWindows = [0, 1, 3, 5, 7, 15, 30]
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'

function localDateOnly(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function daysFromToday(value) {
  const target = localDateOnly(value)
  if (!target) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function deadlineCopy(days) {
  if (days < 0) return `${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'} em atraso`
  if (days === 0) return 'Vence hoje'
  if (days === 1) return 'Vence amanhã'
  return `Vence em ${days} dias`
}

export default function App() {
  const localPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('react-preview')
  const { session, authReady, signOut } = useAuthSession()
  const { office, update, ready, sync } = useOfficeData(session)
  const identity = useLegacyIdentity()
  const [view, setView] = useState(localPreview ? 'clientes' : 'dashboard')
  const [clientTarget, setClientTarget] = useState({ id: '', request: 0 })
  const [taskClientId, setTaskClientId] = useState('')
  const [taskOpenRequest, setTaskOpenRequest] = useState(0)
  const [taskEditTarget, setTaskEditTarget] = useState({ id: '', request: 0 })
  const [obligationTarget, setObligationTarget] = useState({ id: '', clientId: '', request: 0 })
  const [processTarget, setProcessTarget] = useState({ id: '', clientId: '', openRequest: 0, newRequest: 0 })
  const [financeTarget, setFinanceTarget] = useState({ clientId: '', request: 0, newRequest: 0 })
  const [legacyTarget, setLegacyTarget] = useState({ type: '', id: '', request: 0 })
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('med_react_sidebar_collapsed') === '1')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [globalQuery, setGlobalQuery] = useState('')
  const configuredNotificationDays = Number(office.ui?.notifications?.daysBefore ?? 3)
  const notificationDays = notificationWindows.includes(configuredNotificationDays) ? configuredNotificationDays : 3
  const notificationItems = useMemo(() => collectCalendarEvents(office)
    .filter(event => !event.done)
    .map(event => ({ ...event, days: daysFromToday(event.date) }))
    .filter(event => event.days !== null && event.days <= notificationDays), [office, notificationDays])
  const notificationSummary = useMemo(() => ({
    overdue: notificationItems.filter(item => item.days < 0).length,
    today: notificationItems.filter(item => item.days === 0).length,
    upcoming: notificationItems.filter(item => item.days > 0).length,
  }), [notificationItems])

  const searchResults = useMemo(() => {
    const query = normalize(globalQuery)
    if (!query) return []
    const clientsById = new Map((office.clients || []).map(client => [String(client.id), client]))
    const results = []

    ;(office.clients || []).forEach(client => {
      const haystack = normalize(`${clientName(client)} ${client.fantasia || ''} ${client.documento || ''} ${client.id || ''}`)
      if (haystack.includes(query)) results.push({ key: `client-${client.id}`, type: 'client', typeLabel: 'Cliente', id: String(client.id), title: clientName(client), subtitle: client.documento || client.tributacao || 'Cadastro de cliente' })
    })

    ;(office.tasks || []).forEach(task => {
      const customer = task.clientId ? clientName(clientsById.get(String(task.clientId))) : 'Interna'
      const haystack = normalize(`${task.titulo || ''} ${customer} ${task.departamento || ''} ${task.responsavel || ''}`)
      if (haystack.includes(query)) results.push({ key: `task-${task.id}`, type: 'task', typeLabel: 'Tarefa', id: String(task.id), title: task.titulo || 'Tarefa', subtitle: `${customer}${task.departamento ? ` · ${task.departamento}` : ''}` })
    })

    ;(office.processes || []).forEach(process => {
      const customer = clientName(clientsById.get(String(process.clientId)))
      const haystack = normalize(`${process.tipo || ''} ${customer} ${process.status || ''} ${process.origem || ''}`)
      if (haystack.includes(query)) results.push({ key: `process-${process.id}`, type: 'process', typeLabel: 'Processo', id: String(process.id), title: process.tipo || 'Processo', subtitle: `${customer}${process.status ? ` · ${process.status}` : ''}` })
    })

    ;(office.obligations || []).forEach(obligation => {
      const linked = (obligation.clientes || []).map(link => ({ link, client: clientsById.get(String(link.clienteId)) })).filter(item => item.client)
      const linkedText = linked.map(({ client }) => `${clientName(client)} ${client.documento || ''}`).join(' ')
      const haystack = normalize(`${obligation.nome || ''} ${obligation.categoria || ''} ${obligation.competencia || ''} ${linkedText}`)
      if (!haystack.includes(query)) return
      const matchingClient = linked.find(({ client }) => normalize(`${clientName(client)} ${client.documento || ''}`).includes(query))
      const selectedLink = matchingClient?.link || linked[0]?.link
      results.push({
        key: `obligation-${obligation.id}`,
        type: 'obligation',
        typeLabel: 'Obrigação',
        id: String(obligation.id),
        clientId: selectedLink?.clienteId ? String(selectedLink.clienteId) : '',
        title: obligation.nome || 'Obrigação',
        subtitle: matchingClient ? `${obligation.categoria || 'Obrigação'} · ${clientName(matchingClient.client)}` : obligation.categoria || 'Obrigação do escritório',
      })
    })

    return results.slice(0, 30)
  }, [globalQuery, office.clients, office.obligations, office.processes, office.tasks])
  if (!authReady && !localPreview) return <div className="react-loading"><span>ED</span><b>Verificando acesso…</b></div>
  if (!session && !localPreview) return <Login />
  if (!ready && !localPreview) return <div className="react-loading"><span>ED</span><b>Carregando seus dados…</b></div>

  function toggleSidebar() {
    setCollapsed(current => { localStorage.setItem('med_react_sidebar_collapsed', current ? '0' : '1'); return !current })
  }

  function navigate(nextView) {
    setClientTarget({ id: '', request: 0 })
    setTaskClientId('')
    setTaskOpenRequest(0)
    setTaskEditTarget({ id: '', request: 0 })
    setObligationTarget({ id: '', clientId: '', request: 0 })
    setProcessTarget({ id: '', clientId: '', openRequest: 0, newRequest: 0 })
    setFinanceTarget({ clientId: '', request: 0, newRequest: 0 })
    setLegacyTarget({ type: '', id: '', request: 0 })
    setNotificationsOpen(false)
    setGlobalQuery('')
    setView(nextView)
  }

  function openTasksForClient(clientId) {
    setTaskClientId(clientId || '')
    setTaskOpenRequest(current => current + 1)
    setTaskEditTarget({ id: '', request: 0 })
    setView('tarefas')
  }

  function openProcessesForClient(clientId, processId = '') {
    setProcessTarget(current => processId
      ? { id: processId, clientId: '', openRequest: current.openRequest + 1, newRequest: 0 }
      : { id: '', clientId: clientId || '', openRequest: 0, newRequest: current.newRequest + 1 })
    setView('processos')
  }

  function openFinanceForClient(clientId, create = false) {
    setFinanceTarget(current => ({
      clientId: clientId || '',
      request: current.request + 1,
      newRequest: create ? current.newRequest + 1 : 0,
    }))
    setView('honorarios')
  }

  function setNotificationDays(value) {
    const days = Math.max(0, Number(value) || 0)
    update(draft => {
      if (!draft.ui || typeof draft.ui !== 'object' || Array.isArray(draft.ui)) draft.ui = {}
      draft.ui.notifications = { ...(draft.ui.notifications || {}), daysBefore: days }
    })
  }

  function openNotification(event) {
    setNotificationsOpen(false)
    openCalendarEvent(event)
  }

  function openCalendarEvent(event) {
    if (event.type === 'task') {
      setTaskClientId('')
      setTaskOpenRequest(0)
      setTaskEditTarget(current => ({ id: event.id, request: current.request + 1 }))
      setView('tarefas')
      return
    }
    if (event.type === 'obligation') {
      setObligationTarget(current => ({ id: event.id, clientId: event.clientId || '', request: current.request + 1 }))
      setView('obrigacoes')
      return
    }
    setProcessTarget(current => ({ id: event.id, clientId: '', openRequest: current.openRequest + 1, newRequest: 0 }))
    setView('processos')
  }

  function chooseSearchResult(item) {
    setGlobalQuery('')
    setNotificationsOpen(false)
    if (item.type === 'client') {
      setClientTarget(current => ({ id: item.id, request: current.request + 1 }))
      setView('clientes')
      return
    }
    if (item.type === 'task') {
      setTaskClientId('')
      setTaskOpenRequest(0)
      setTaskEditTarget(current => ({ id: item.id, request: current.request + 1 }))
      setView('tarefas')
      return
    }
    if (item.type === 'process') {
      setProcessTarget(current => ({ id: item.id, clientId: '', openRequest: current.openRequest + 1, newRequest: 0 }))
      setView('processos')
      return
    }
    if (item.type === 'obligation') {
      setObligationTarget(current => ({ id: item.id, clientId: item.clientId || '', request: current.request + 1 }))
      setView('obrigacoes')
    }
  }

  return <div className={`react-shell ${collapsed ? 'is-collapsed' : ''}`}>
    <AppSidebar currentView={view} identity={identity} sync={sync} collapsed={collapsed} notificationsOpen={notificationsOpen} onToggle={toggleSidebar} onNavigate={navigate} onSignOut={signOut} />
    <AppTopbar currentView={view} query={globalQuery} onQueryChange={setGlobalQuery} searchResults={searchResults} onChooseResult={chooseSearchResult} notificationsCount={notificationItems.length} notificationsOpen={notificationsOpen} onToggleNotifications={() => setNotificationsOpen(current => !current)} identity={identity} />

    {notificationsOpen ? <div className="react-notifications"><section className="notification-panel" aria-label="Central de notificações">
        <header>
          <div><strong>Notificações</strong><small>Agenda do escritório · atualização automática</small></div>
          <button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Fechar notificações">×</button>
        </header>
        <div className="notification-summary">
          <span className={notificationSummary.overdue ? 'danger' : ''}><b>{notificationSummary.overdue}</b><small>Vencidas</small></span>
          <span className={notificationSummary.today ? 'warning' : ''}><b>{notificationSummary.today}</b><small>Hoje</small></span>
          <span><b>{notificationSummary.upcoming}</b><small>Próximas</small></span>
        </div>
        <label className="notification-setting">
          <span>Alertar com antecedência</span>
          <select value={notificationDays} onChange={event => setNotificationDays(event.target.value)}>
            {notificationWindows.map(days => <option value={days} key={days}>{days === 0 ? 'Somente no dia' : `${days} dia${days === 1 ? '' : 's'} antes`}</option>)}
          </select>
        </label>
        <div className="notification-list">
          {notificationItems.length ? notificationItems.slice(0, 40).map(item => <button type="button" className={`notification-item ${item.days < 0 ? 'overdue' : item.days === 0 ? 'today' : ''}`} key={item.key} onClick={() => openNotification(item)}>
            <span className={`notification-kind ${item.type}`}>{item.type === 'task' ? 'Tarefa' : item.type === 'process' ? 'Processo' : 'Obrigação'}</span>
            <strong>{item.label.replace(/^(Tarefa|Processo|Obrigação) · /, '')}</strong>
            <small>{item.client} · {deadlineCopy(item.days)}</small>
          </button>) : <div className="notification-empty"><b>Agenda em dia</b><small>Nenhum item pendente dentro da janela configurada.</small></div>}
        </div>
        {notificationItems.length > 40 ? <p className="notification-more">Exibindo os 40 alertas mais próximos.</p> : null}
        <footer><span>Itens concluídos saem dos alertas automaticamente.</span><button type="button" onClick={() => navigate('calendario')}>Abrir calendário</button></footer>
      </section></div> : null}
    <main className="react-workspace">
      {view === 'dashboard' ? <Dashboard office={office} update={update} sync={sync} session={session} onNewTask={openTasksForClient} onNavigate={navigate} /> : null}
      {view === 'calendario' ? <CalendarReact office={office} update={update} sync={sync} onOpenEvent={openCalendarEvent} /> : null}
      {view === 'clientes' ? <ClientsReact office={office} update={update} sync={sync} onOpenTasks={openTasksForClient} onOpenProcesses={openProcessesForClient} onOpenFinance={openFinanceForClient} initialClientId={clientTarget.id} openClientRequest={clientTarget.request} /> : null}
      {view === 'obrigacoes' ? <ObligationsReact office={office} update={update} sync={sync} initialObligationId={obligationTarget.id} initialClientId={obligationTarget.clientId} openObligationRequest={obligationTarget.request} /> : null}
      {view === 'processos' ? <Suspense fallback={<div className="module-loading"><span>ED</span><b>Carregando Processos…</b></div>}><ProcessesReact office={office} update={update} sync={sync} initialProcessId={processTarget.id} openProcessRequest={processTarget.openRequest} initialClientId={processTarget.clientId} openNewRequest={processTarget.newRequest} /></Suspense> : null}
      {view === 'tarefas' ? <TasksReact office={office} update={update} sync={sync} session={session} initialClientId={taskClientId} openNewRequest={taskOpenRequest} initialTaskId={taskEditTarget.id} openTaskRequest={taskEditTarget.request} /> : null}
      {view === 'honorarios' ? <Suspense fallback={<div className="module-loading"><span>ED</span><b>Carregando Financeiro…</b></div>}><FinanceReact office={office} update={update} sync={sync} initialClientId={financeTarget.clientId} openClientRequest={financeTarget.request} openNewRequest={financeTarget.newRequest} /></Suspense> : null}
      {view !== 'dashboard' && view !== 'calendario' && view !== 'clientes' && view !== 'obrigacoes' && view !== 'processos' && view !== 'tarefas' && view !== 'honorarios' ? <LegacyModule view={view} record={legacyTarget} /> : null}
    </main>
  </div>
}
