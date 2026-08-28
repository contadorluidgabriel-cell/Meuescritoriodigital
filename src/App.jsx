import { lazy, Suspense, useMemo, useState } from 'react'
import Login from './components/Login.jsx'
import LegacyModule from './components/LegacyModule.jsx'
import ClientsReact from './components/ClientsReact.jsx'
import TasksReact from './components/TasksReact.jsx'
import Dashboard from './components/Dashboard.jsx'
import CalendarReact from './components/CalendarReact.jsx'
import ObligationsReact from './components/ObligationsReact.jsx'
import { useAuthSession } from './hooks/useAuthSession.js'
import { useLegacyIdentity } from './hooks/useLegacyIdentity.js'
import { useOfficeData } from './hooks/useOfficeData.js'
import { collectCalendarEvents } from './lib/calendarEvents.js'

const navigationGroups = [
  {
    label: 'Visão geral',
    items: [
      ['dashboard', 'Painel Principal', '⌂'],
      ['calendario', 'Calendário', '▣'],
    ],
  },
  {
    label: 'Operação',
    items: [
      ['clientes', 'Clientes', '◎'],
      ['tarefas', 'Tarefas', '☑'],
      ['processos', 'Processos', '↗'],
      ['obrigacoes', 'Obrigações', '✓'],
    ],
  },
  {
    label: 'Gestão',
    items: [
      ['honorarios', 'Financeiro', 'R$'],
      ['configuracoes', 'Configurações', '⚙'],
    ],
  },
]

const ProcessesReact = lazy(() => import('./components/ProcessesReact.jsx'))
const FinanceReact = lazy(() => import('./components/FinanceReact.jsx'))

const notificationWindows = [0, 1, 3, 5, 7, 15, 30]

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
  const [taskClientId, setTaskClientId] = useState('')
  const [taskOpenRequest, setTaskOpenRequest] = useState(0)
  const [taskEditTarget, setTaskEditTarget] = useState({ id: '', request: 0 })
  const [obligationTarget, setObligationTarget] = useState({ id: '', clientId: '', request: 0 })
  const [processTarget, setProcessTarget] = useState({ id: '', clientId: '', openRequest: 0, newRequest: 0 })
  const [legacyTarget, setLegacyTarget] = useState({ type: '', id: '', request: 0 })
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('med_react_sidebar_collapsed') === '1')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
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

  if (!authReady && !localPreview) return <div className="react-loading"><span>ED</span><b>Verificando acesso…</b></div>
  if (!session && !localPreview) return <Login />
  if (!ready && !localPreview) return <div className="react-loading"><span>ED</span><b>Carregando seus dados…</b></div>

  function toggleSidebar() {
    setCollapsed(current => { localStorage.setItem('med_react_sidebar_collapsed', current ? '0' : '1'); return !current })
  }

  function navigate(nextView) {
    setTaskClientId('')
    setTaskOpenRequest(0)
    setTaskEditTarget({ id: '', request: 0 })
    setObligationTarget({ id: '', clientId: '', request: 0 })
    setProcessTarget({ id: '', clientId: '', openRequest: 0, newRequest: 0 })
    setLegacyTarget({ type: '', id: '', request: 0 })
    setNotificationsOpen(false)
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

  return <div className={`react-shell ${collapsed ? 'is-collapsed' : ''}`}>
    <aside className="react-sidebar">
      <header className="react-brand">
        <span className="react-logo">{identity.initials || 'ED'}</span>
        <div><strong>{identity.office}</strong><small>{identity.system} · V11.1</small></div>
        <button type="button" className="collapse-button" onClick={toggleSidebar} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>‹</button>
      </header>

      <div className="react-nav-stack">
        {navigationGroups.map(group => <section className="react-nav-group" key={group.label}>
          <div className="react-nav-title">{group.label}</div>
          <nav aria-label={group.label}>{group.items.map(([id, label, icon]) => <button type="button" className={view === id ? 'active' : ''} onClick={() => navigate(id)} title={label} key={id}><i aria-hidden="true">{icon}</i><span>{label}</span></button>)}</nav>
        </section>)}
      </div>

      <div className="react-notification-nav">
        <button type="button" className={notificationItems.length ? 'has-alerts' : ''} onClick={() => setNotificationsOpen(current => !current)} aria-label={`Notificações: ${notificationItems.length} alerta(s)`} aria-expanded={notificationsOpen} title="Notificações">
          <svg className="notification-bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
          <span>Notificações</span>
          {notificationItems.length ? <b>{notificationItems.length > 99 ? '99+' : notificationItems.length}</b> : null}
        </button>
      </div>

      <footer className="react-profile"><span>{identity.initials || 'ME'}</span><div><strong>{identity.user}</strong><small>{identity.role} · {sync}</small></div><button type="button" onClick={signOut}>Sair</button></footer>
    </aside>

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
      {view === 'clientes' ? <ClientsReact office={office} update={update} sync={sync} onOpenTasks={openTasksForClient} onOpenProcesses={openProcessesForClient} /> : null}
      {view === 'obrigacoes' ? <ObligationsReact office={office} update={update} sync={sync} initialObligationId={obligationTarget.id} initialClientId={obligationTarget.clientId} openObligationRequest={obligationTarget.request} /> : null}
      {view === 'processos' ? <Suspense fallback={<div className="module-loading"><span>ED</span><b>Carregando Processos…</b></div>}><ProcessesReact office={office} update={update} sync={sync} initialProcessId={processTarget.id} openProcessRequest={processTarget.openRequest} initialClientId={processTarget.clientId} openNewRequest={processTarget.newRequest} /></Suspense> : null}
      {view === 'tarefas' ? <TasksReact office={office} update={update} sync={sync} session={session} initialClientId={taskClientId} openNewRequest={taskOpenRequest} initialTaskId={taskEditTarget.id} openTaskRequest={taskEditTarget.request} /> : null}
      {view === 'honorarios' ? <Suspense fallback={<div className="module-loading"><span>ED</span><b>Carregando Financeiro…</b></div>}><FinanceReact office={office} update={update} sync={sync} /></Suspense> : null}
      {view !== 'dashboard' && view !== 'calendario' && view !== 'clientes' && view !== 'obrigacoes' && view !== 'processos' && view !== 'tarefas' && view !== 'honorarios' ? <LegacyModule view={view} record={legacyTarget} /> : null}
    </main>
  </div>
}
