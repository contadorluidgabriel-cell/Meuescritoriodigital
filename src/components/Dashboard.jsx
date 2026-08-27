import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isDone, today, uid } from '../lib/storage.js'
import { appendNextRecurringTask, reconcileGoogleTaskPayload } from '../lib/taskRecurrence.js'
import { useGoogleTasks } from '../hooks/useGoogleTasks.js'

const DAY_MS = 86400000
const widgets = [
  ['priorities', 'Prioridades'], ['alerts', 'Alertas inteligentes'], ['workload', 'Carga por departamento'],
  ['deadlines', 'Próximos prazos'], ['history', 'Concluídos recentemente'],
]
const filters = [
  ['todos', 'Todas'], ['atrasada', 'Atrasadas'], ['hoje', 'Hoje'], ['amanha', 'Amanhã'],
  ['7dias', 'Próximos 7 dias'], ['30dias', 'Próximos 30 dias'], ['aguardando', 'Aguardando cliente'],
]
const kindNames = { task: 'Tarefa', process: 'Processo', obligation: 'Obrigação' }
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const daysUntil = date => date ? Math.round((new Date(`${date}T12:00:00`) - new Date(`${today()}T12:00:00`)) / DAY_MS) : 9999
const formatDate = date => date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'
const completionKey = item => `${item.kind}|${item.id}|${item.clientId || ''}`

function normalizedLayout(ui = {}) {
  const ids = widgets.map(([id]) => id)
  const order = Array.isArray(ui.dashboardOrder) ? ui.dashboardOrder.filter(id => ids.includes(id)) : []
  ids.forEach(id => { if (!order.includes(id)) order.push(id) })
  return { order, hidden: new Set(Array.isArray(ui.dashboardHidden) ? ui.dashboardHidden.filter(id => ids.includes(id)) : []) }
}

function buildPendingItems(office, clients) {
  const result = []
  ;(office.tasks || []).forEach(task => {
    if (isDone(task.status) || !task.prazo) return
    result.push({ kind: 'task', id: String(task.id), clientId: '', recordClientId: String(task.clientId || ''), title: task.titulo, client: task.clientId ? clients.get(String(task.clientId)) || 'Cliente' : 'Interna', date: task.prazo, dept: task.departamento || 'Sem departamento', owner: task.responsavel || '', status: task.status, priority: task.prioridade || 'Normal', view: 'tarefas' })
  })
  ;(office.processes || []).forEach(process => {
    if (isDone(process.status) || !process.prazoFinal) return
    result.push({ kind: 'process', id: String(process.id), clientId: '', recordClientId: String(process.clientId || ''), title: process.tipo, client: clients.get(String(process.clientId)) || 'Cliente', date: process.prazoFinal, dept: 'Societário', owner: '', status: process.status, priority: '', view: 'processos' })
  })
  ;(office.obligations || []).forEach(obligation => (obligation.clientes || []).forEach(link => {
    if (isDone(link.status) || link.status === 'Não se aplica' || !link.vencimento) return
    result.push({ kind: 'obligation', id: String(obligation.id), clientId: String(link.clienteId), recordClientId: String(link.clienteId), title: obligation.nome, client: clients.get(String(link.clienteId)) || 'Cliente', date: link.vencimento, dept: obligation.categoria || 'Fiscal', owner: '', status: link.status, priority: '', view: 'obrigacoes' })
  }))
  return result.map(item => ({ ...item, days: daysUntil(item.date), key: completionKey(item) })).sort((a, b) => a.days - b.days || a.title.localeCompare(b.title, 'pt-BR'))
}

function KindBadge({ kind }) { return <span className={`dashboard-kind kind-${kind}`}>{kindNames[kind] || 'Item'}</span> }
function EmptyState({ children }) { return <div className="dashboard-empty">{children}</div> }
function PanelHeader({ title, subtitle, action }) { return <header className="dashboard-panel-head"><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</header> }
function Kpi({ label, value, tone = '', onClick }) { return <button type="button" className={`dashboard-kpi ${tone}`} onClick={onClick}><span>{label}</span><strong>{value}</strong><small>Abrir detalhes →</small></button> }
function DashboardModal({ title, subtitle, onClose, children }) { return <div className="dashboard-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="dashboard-modal-card"><header><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>{children}</div></div> }

export default function Dashboard({ office, update, sync, session, onNewTask, onNavigate }) {
  const savedUi = office.ui || {}
  const [filter, setFilter] = useState(() => savedUi.todayFilter || 'todos')
  const [query, setQuery] = useState(() => savedUi.todaySearch || '')
  const [clientFilter, setClientFilter] = useState(() => savedUi.todayClient || '')
  const [deptFilter, setDeptFilter] = useState(() => savedUi.todayDept || '')
  const [ownerFilter, setOwnerFilter] = useState(() => savedUi.todayOwner || '')
  const [selected, setSelected] = useState(new Set())
  const [customizing, setCustomizing] = useState(false)
  const [draftOrder, setDraftOrder] = useState([])
  const [draftHidden, setDraftHidden] = useState(new Set())
  const [undoText, setUndoText] = useState('')
  const [notice, setNotice] = useState('')
  const undoSnapshot = useRef(null), undoTimer = useRef(null), prioritiesRef = useRef(null)
  const clientMap = useMemo(() => new Map((office.clients || []).map(client => [String(client.id), clientName(client)])), [office.clients])
  const pending = useMemo(() => buildPendingItems(office, clientMap), [clientMap, office])
  const layout = useMemo(() => normalizedLayout(office.ui), [office.ui])
  const reconcileGoogleTasks = useCallback((remoteTasks, currentTasks) => reconcileGoogleTaskPayload(remoteTasks, currentTasks, office.clients || []), [office.clients])
  const google = useGoogleTasks({ enabled: Boolean(session), tasks: office.tasks || [], update, reconcileTasks: reconcileGoogleTasks })

  const choices = useMemo(() => ({
    clients: (office.clients || []).filter(client => client.status !== 'Inativo'),
    departments: [...new Set([...(office.departments || []).filter(item => item.active !== false).map(item => item.name), ...pending.map(item => item.dept)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    owners: [...new Set((office.tasks || []).map(task => task.responsavel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  }), [office.clients, office.departments, office.tasks, pending])

  const visible = useMemo(() => pending.filter(item => {
    if (filter === 'atrasada' && item.days >= 0) return false
    if (filter === 'hoje' && item.days !== 0) return false
    if (filter === 'amanha' && item.days !== 1) return false
    if (filter === '7dias' && !(item.days > 0 && item.days <= 7)) return false
    if (filter === '30dias' && !(item.days > 0 && item.days <= 30)) return false
    if (filter === 'aguardando' && item.status !== 'Aguardando cliente') return false
    if (query && !normalize(`${item.title} ${item.client}`).includes(normalize(query))) return false
    if (clientFilter && item.recordClientId !== clientFilter) return false
    if (deptFilter && item.dept !== deptFilter) return false
    if (ownerFilter && item.owner !== ownerFilter) return false
    return true
  }), [clientFilter, deptFilter, filter, ownerFilter, pending, query])

  const history = useMemo(() => (office.history || []).filter(item => Date.now() - new Date(item.completedAt).getTime() <= 365 * DAY_MS).slice(0, 500), [office.history])
  const workload = useMemo(() => {
    const counts = new Map()
    pending.forEach(item => counts.set(item.dept, (counts.get(item.dept) || 0) + 1))
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7)
    return { rows, max: Math.max(1, ...rows.map(([, count]) => count)) }
  }, [pending])
  const alerts = useMemo(() => {
    const rows = [], overdue = pending.filter(item => item.days < 0).length, dueToday = pending.filter(item => item.days === 0).length
    const waiting = pending.filter(item => item.status === 'Aguardando cliente').length
    const urgent = pending.filter(item => item.kind === 'task' && ['Alta', 'Urgente'].includes(item.priority)).length
    if (overdue) rows.push(['danger', `${overdue} item(ns) atrasado(s)`, 'Comece pelos vencimentos mais antigos.'])
    if (dueToday) rows.push(['warning', `${dueToday} vencimento(s) hoje`, 'Revise antes do fim do expediente.'])
    if (waiting) rows.push(['warning', `${waiting} aguardando cliente`, 'Vale cobrar documentos ou retorno.'])
    if (urgent) rows.push(['danger', `${urgent} tarefa(s) de alta prioridade`, 'Confira responsáveis e prazos.'])
    if (!rows.length) rows.push(['ok', 'Operação em dia', 'Nenhum alerta crítico neste momento.'])
    return rows
  }, [pending])

  useEffect(() => {
    const timer = setTimeout(() => update(draft => {
      draft.ui ||= {}
      const next = { todayFilter: filter, todaySearch: query, todayClient: clientFilter, todayDept: deptFilter, todayOwner: ownerFilter }
      if (Object.entries(next).some(([key, value]) => draft.ui[key] !== value)) Object.assign(draft.ui, next)
    }), 400)
    return () => clearTimeout(timer)
  }, [clientFilter, deptFilter, filter, ownerFilter, query, update])

  useEffect(() => () => clearTimeout(undoTimer.current), [])
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 2800)
    return () => clearTimeout(timer)
  }, [notice])

  function completeItems(items) {
    if (!items.length) return
    const snapshot = structuredClone({ tasks: office.tasks || [], processes: office.processes || [], obligations: office.obligations || [], history: office.history || [] })
    const next = structuredClone(snapshot)
    let nextHistory = (next.history || []).filter(item => Date.now() - new Date(item.completedAt).getTime() <= 365 * DAY_MS)
    let changed = 0, changedTask = false
    items.forEach(item => {
      let title = '', client = '', responsible = office.settings?.user || 'Usuário'
      if (item.kind === 'task') {
        const task = next.tasks.find(row => String(row.id) === item.id)
        if (!task || isDone(task.status)) return
        task.status = 'Concluída'; task.updatedAt = new Date().toISOString(); title = task.titulo; client = task.clientId ? clientMap.get(String(task.clientId)) || 'Cliente' : 'Interna'; responsible = task.responsavel || responsible
        next.tasks = appendNextRecurringTask(next.tasks, task, office.clients || []); changedTask = true
      }
      if (item.kind === 'process') {
        const process = next.processes.find(row => String(row.id) === item.id)
        if (!process || isDone(process.status)) return
        process.status = 'Concluído'; process.dataConclusao ||= today(); title = process.tipo; client = clientMap.get(String(process.clientId)) || 'Cliente'
      }
      if (item.kind === 'obligation') {
        const obligation = next.obligations.find(row => String(row.id) === item.id)
        const link = obligation?.clientes?.find(row => String(row.clienteId) === item.clientId)
        if (!link || isDone(link.status)) return
        link.status = 'Concluída'; link.concluidoEm ||= today(); title = obligation.nome; client = clientMap.get(item.clientId) || 'Cliente'
      }
      if (!title) return
      nextHistory.unshift({ id: uid('hist'), type: item.kind, title, client, responsible, completedAt: new Date().toISOString() })
      changed += 1
    })
    if (!changed) return
    next.history = nextHistory.slice(0, 500)
    update(draft => { draft.tasks = next.tasks; draft.processes = next.processes; draft.obligations = next.obligations; draft.history = next.history })
    if (changedTask) google.schedule(next.tasks)
    undoSnapshot.current = snapshot
    setSelected(new Set())
    setUndoText(`${changed} item(ns) concluído(s) pelo Painel Principal.`)
    clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => { undoSnapshot.current = null; setUndoText('') }, 10000)
  }

  function undoCompletion() {
    if (!undoSnapshot.current) return
    const snapshot = undoSnapshot.current
    update(draft => { draft.tasks = snapshot.tasks; draft.processes = snapshot.processes; draft.obligations = snapshot.obligations; draft.history = snapshot.history })
    google.schedule(snapshot.tasks)
    undoSnapshot.current = null; clearTimeout(undoTimer.current); setUndoText(''); setNotice('Conclusão desfeita.')
  }

  function toggleSelected(key, checked) { setSelected(current => { const next = new Set(current); checked ? next.add(key) : next.delete(key); return next }) }
  function selectVisible() { setSelected(current => { const next = new Set(current); const all = visible.length > 0 && visible.every(item => next.has(item.key)); visible.forEach(item => all ? next.delete(item.key) : next.add(item.key)); return next }) }
  function focusPriorities(nextFilter) { setFilter(nextFilter); setTimeout(() => prioritiesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }
  function openCustomizer() { setDraftOrder([...layout.order]); setDraftHidden(new Set(layout.hidden)); setCustomizing(true) }
  function moveWidget(id, direction) { setDraftOrder(current => { const next = [...current], index = next.indexOf(id), target = index + direction; if (index < 0 || target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next }) }
  function toggleWidget(id) { setDraftHidden(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next }) }
  function saveWidgets() { update(draft => { draft.ui ||= {}; draft.ui.dashboardOrder = draftOrder; draft.ui.dashboardHidden = [...draftHidden] }); setCustomizing(false); setNotice('Painel personalizado.') }
  function clearHistory() { if (!window.confirm('Limpar somente o histórico de conclusões do painel? Tarefas, processos e obrigações não serão alterados.')) return; update(draft => { draft.history = [] }); setNotice('Histórico do painel limpo.') }

  const upcoming = pending.filter(item => item.days >= 0).slice(0, 8)
  const visibleWidgets = layout.order.filter(id => !layout.hidden.has(id))
  const allVisibleSelected = visible.length > 0 && visible.every(item => selected.has(item.key))

  function renderWidget(id) {
    if (id === 'priorities') return <section className="dashboard-panel widget-priorities" ref={prioritiesRef} key={id}><PanelHeader title="Prioridades" subtitle="Conclua tarefas, processos e obrigações sem sair do painel." action={<div className="dashboard-head-actions"><button type="button" onClick={() => onNavigate('calendario')}>Calendário</button>{visible.length ? <button type="button" onClick={selectVisible}>{allVisibleSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'}</button> : null}</div>} /><div className="dashboard-pills">{filters.map(([value, label]) => <button type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div><div className="dashboard-filters"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar pendência" /><select value={clientFilter} onChange={event => setClientFilter(event.target.value)}><option value="">Todos os clientes</option>{choices.clients.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}</option>)}</select><select value={ownerFilter} onChange={event => setOwnerFilter(event.target.value)}><option value="">Todos os responsáveis</option>{choices.owners.map(name => <option key={name}>{name}</option>)}</select><select value={deptFilter} onChange={event => setDeptFilter(event.target.value)}><option value="">Todos os departamentos</option>{choices.departments.map(name => <option key={name}>{name}</option>)}</select></div>{selected.size ? <div className="dashboard-bulk"><b>{selected.size} selecionado(s)</b><button type="button" className="primary" onClick={() => completeItems(pending.filter(item => selected.has(item.key)))}>Concluir selecionados</button><button type="button" onClick={() => setSelected(new Set())}>Limpar</button></div> : null}<div className="dashboard-priority-list">{visible.map(item => <article className={item.days < 0 ? 'overdue' : ''} key={item.key}><input type="checkbox" checked={selected.has(item.key)} onChange={event => toggleSelected(item.key, event.target.checked)} aria-label={`Selecionar ${item.title}`} /><div><div className="dashboard-item-title"><KindBadge kind={item.kind} /><b>{item.title}</b>{item.days < 0 ? <span className="deadline-state">Atrasado</span> : null}{item.status === 'Aguardando cliente' ? <span className="deadline-state waiting">Aguardando cliente</span> : null}</div><small>{item.client} · {item.dept}{item.owner ? ` · ${item.owner}` : ''} · {formatDate(item.date)}</small></div><div className="dashboard-item-actions"><button type="button" className="primary" onClick={() => completeItems([item])}>Concluir</button><button type="button" onClick={() => onNavigate(item.view)}>Abrir</button></div></article>)}</div>{!visible.length ? <EmptyState>Nenhum item neste filtro.</EmptyState> : null}</section>
    if (id === 'alerts') return <section className="dashboard-panel widget-alerts" key={id}><PanelHeader title="Alertas inteligentes" subtitle="O que merece atenção agora." /><div className="dashboard-alerts">{alerts.map(([level, title, description]) => <article className={level} key={`${title}-${description}`}><i /><div><b>{title}</b><small>{description}</small></div></article>)}</div></section>
    if (id === 'workload') return <section className="dashboard-panel widget-workload" key={id}><PanelHeader title="Carga por departamento" subtitle="Pendências abertas por área." /><div>{workload.rows.map(([name, count]) => <div className="dashboard-workload-row" key={name}><span>{name}</span><div><i style={{ width: `${Math.round(count / workload.max * 100)}%` }} /></div><b>{count}</b></div>)}</div>{!workload.rows.length ? <EmptyState>Sem pendências abertas.</EmptyState> : null}</section>
    if (id === 'deadlines') return <section className="dashboard-panel widget-deadlines" key={id}><PanelHeader title="Próximos prazos" subtitle="Os oito vencimentos mais próximos." action={<button type="button" onClick={() => onNavigate('calendario')}>Ver calendário</button>} /><div className="dashboard-deadline-list">{upcoming.map(item => <article key={`deadline-${item.key}`}><div><KindBadge kind={item.kind} /><b>{item.title}</b><small>{item.client} · {item.dept}</small></div><div><time>{formatDate(item.date)}</time><button type="button" className="primary" onClick={() => completeItems([item])}>Concluir</button><button type="button" onClick={() => onNavigate(item.view)}>Abrir</button></div></article>)}</div>{!upcoming.length ? <EmptyState>Sem próximos prazos.</EmptyState> : null}</section>
    if (id === 'history') return <section className="dashboard-panel widget-history" key={id}><PanelHeader title="Concluídos recentemente" subtitle="Até 500 registros ou 12 meses, sem pesar no sistema." action={history.length ? <button type="button" onClick={clearHistory}>Limpar histórico</button> : null} /><div className="dashboard-history-list">{history.slice(0, 20).map(item => <article key={item.id}><KindBadge kind={item.type} /><div><b>{item.title}</b><small>{item.client || 'Sem cliente'} · {item.responsible || 'Sem responsável'}</small></div><time>{new Date(item.completedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time></article>)}</div>{!history.length ? <EmptyState>Nenhuma conclusão registrada pelo painel.</EmptyState> : null}</section>
    return null
  }

  return <div className="react-module-page dashboard-page">
    <div className="react-module-topbar"><div><h1>Painel Principal</h1><p>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} · acompanhe e conclua sua operação em um só lugar.</p></div><div className="react-module-actions"><span className="sync-indicator">{sync}{google.connected ? ' · Google conectado' : ''}</span><button type="button" onClick={openCustomizer}>Personalizar</button><button type="button" className="primary" onClick={() => onNewTask('')}>+ Nova tarefa</button></div></div>
    <div className="dashboard-kpis"><Kpi label="Atrasadas" value={pending.filter(item => item.days < 0).length} tone="danger" onClick={() => focusPriorities('atrasada')} /><Kpi label="Vencem hoje" value={pending.filter(item => item.days === 0).length} tone="warning" onClick={() => focusPriorities('hoje')} /><Kpi label="Processos ativos" value={(office.processes || []).filter(item => !isDone(item.status)).length} onClick={() => onNavigate('processos')} /><Kpi label="Tarefas abertas" value={(office.tasks || []).filter(item => !isDone(item.status)).length} onClick={() => onNavigate('tarefas')} /></div>
    <div className="dashboard-react-grid">{visibleWidgets.map(renderWidget)}{!visibleWidgets.length ? <section className="dashboard-panel dashboard-all-hidden"><h2>Seu painel está vazio</h2><p>Use “Personalizar” para voltar a exibir os blocos.</p><button type="button" className="primary" onClick={openCustomizer}>Escolher blocos</button></section> : null}</div>
    {customizing ? <DashboardModal title="Personalizar Painel Principal" subtitle="Escolha os blocos e altere a ordem de exibição." onClose={() => setCustomizing(false)}><div className="dashboard-widget-options">{draftOrder.map((id, index) => <article key={id}><input type="checkbox" checked={!draftHidden.has(id)} onChange={() => toggleWidget(id)} aria-label={`Exibir ${widgets.find(([widgetId]) => widgetId === id)?.[1]}`} /><b>{widgets.find(([widgetId]) => widgetId === id)?.[1]}</b><div><button type="button" disabled={index === 0} onClick={() => moveWidget(id, -1)} aria-label={`Mover ${id} para cima`}>↑</button><button type="button" disabled={index === draftOrder.length - 1} onClick={() => moveWidget(id, 1)} aria-label={`Mover ${id} para baixo`}>↓</button></div></article>)}</div><footer className="dashboard-modal-actions"><button type="button" onClick={() => { setDraftOrder(widgets.map(([id]) => id)); setDraftHidden(new Set()) }}>Restaurar padrão</button><button type="button" onClick={() => setCustomizing(false)}>Cancelar</button><button type="button" className="primary" onClick={saveWidgets}>Salvar painel</button></footer></DashboardModal> : null}
    {undoText ? <div className="dashboard-undo" role="status"><span>{undoText}</span><button type="button" onClick={undoCompletion}>Desfazer</button></div> : null}
    {notice ? <div className="dashboard-notice" role="status">{notice}</div> : null}
  </div>
}
