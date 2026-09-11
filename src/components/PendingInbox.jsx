import { useMemo, useState } from 'react'
import { collectCommandCenterItems } from '../lib/operationalIntelligence.js'
import { obligationProgress, operationalResponsible, pendingReasonIds, pendingReasonLabel } from '../lib/operationalPresentation.js'
import { workItemSummary } from '../lib/workBoardView.js'
import TaskQuickExecution from './TaskQuickExecution.jsx'

const filters = [
  ['overdue', 'Atrasados'],
  ['waiting', 'Aguardando retorno'],
  ['unscheduled', 'Sem prazo'],
  ['unassigned', 'Sem responsável'],
  ['critical', 'Críticos'],
  ['all', 'Todos'],
]

const itemIdentity = item => item.type === 'obligation' ? `obligation:${item.id}` : item.key
const unique = items => [...new Map(items.map(item => [itemIdentity(item), item])).values()]
const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : ''

function actionCopy(item, day) {
  const action = String(item.actionDate || item.effectiveDate || item.planned || item.due || '')
  if (!action) return 'Defina quando este item deve voltar ao radar.'
  if (action < day) return `Ação pendente desde ${dateLabel(action)}.`
  if (action === day) return 'Ação necessária hoje.'
  return `Próxima ação em ${dateLabel(action)}.`
}

function PendingCard({ item, office, update, onOpenItem, onNotice, day }) {
  const task = item.type === 'task' ? (office.tasks || []).find(row => String(row.id) === String(item.id)) : null
  const reasons = [...pendingReasonIds(item, office, day)]
  const responsible = operationalResponsible(office, item)
  const progress = item.type === 'obligation' ? obligationProgress(office, item.id) : null
  const openTarget = progress?.firstPendingClientId ? { ...item, clientId: progress.firstPendingClientId } : item
  const buttonLabel = item.type === 'process' ? 'Abrir próxima ação' : item.type === 'obligation' ? 'Ver CNPJs pendentes' : 'Abrir'
  const secondary = item.type === 'obligation' && progress
    ? `${progress.done}/${progress.total} concluídos · ${progress.open} pendentes`
    : item.type === 'process' && item.dependencyLabel
      ? `${item.subtitle || 'Próxima ação'} · depende de ${item.dependencyLabel}`
      : workItemSummary(item)

  return <article className={`pending-inbox-card level-${item.level || 'info'}`}>
    <div className="pending-inbox-main">
      <div className="pending-reasons">{reasons.slice(0, 3).map(reason => <span className={`reason-${reason}`} key={reason}>{pendingReasonLabel(reason)}</span>)}</div>
      <strong>{item.title}</strong>
      <div className="pending-context"><b>{item.client || 'Escritório'}</b>{responsible ? <span>Responsável: {responsible}</span> : ['task', 'process'].includes(item.type) ? <span className="missing">Sem responsável</span> : null}</div>
      <small>{secondary}</small>
      <p>{actionCopy(item, day)}</p>
    </div>
    <div className="pending-inbox-actions">
      {task ? <TaskQuickExecution task={task} tasks={office.tasks || []} clients={office.clients || []} update={update} onOpen={() => onOpenItem(item)} onNotice={onNotice} compact /> : <button type="button" onClick={() => onOpenItem(openTarget)}>{buttonLabel}</button>}
    </div>
  </article>
}

export default function PendingInbox({ office, update, onOpenItem, onNavigate, day, onNotice }) {
  const [filter, setFilter] = useState('overdue')
  const allItems = useMemo(() => collectCommandCenterItems(office, { day, daysBefore: 60 }), [office, day])
  const operational = useMemo(() => unique(allItems.filter(item => ['task', 'process', 'obligation'].includes(item.type))), [allItems])
  const financeCount = useMemo(() => allItems.filter(item => ['finance', 'payable', 'partner'].includes(item.type)).length, [allItems])
  const classified = useMemo(() => operational.map(item => ({ item, reasons: pendingReasonIds(item, office, day) })), [operational, office, day])
  const counts = useMemo(() => Object.fromEntries(filters.map(([id]) => [id, id === 'all' ? classified.length : classified.filter(row => row.reasons.has(id)).length])), [classified])
  const visible = useMemo(() => classified.filter(row => filter === 'all' || row.reasons.has(filter)).map(row => row.item), [classified, filter])

  return <section className="occ-panel pending-inbox">
    <header className="occ-panel-head"><div><span>Caixa de exceções</span><h2>O que está travando a operação</h2><p>Pendências são exceções: atraso, dependência externa, falta de prazo ou falta de responsável.</p></div><b>{visible.length} item(ns)</b></header>

    <div className="pending-inbox-kpis">
      {filters.slice(0, 4).map(([id, label]) => <button type="button" className={`${filter === id ? 'active' : ''} ${id === 'overdue' && counts[id] ? 'danger' : ''}`} onClick={() => setFilter(id)} key={id}><span>{label}</span><strong>{counts[id]}</strong></button>)}
    </div>

    <div className="occ-filter-row pending-inbox-filters">
      {filters.map(([id, label]) => <button type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)} key={id}>{label} <span>{counts[id]}</span></button>)}
    </div>

    <div className="occ-work-list pending-inbox-list">{visible.length ? visible.map(item => <PendingCard key={itemIdentity(item)} item={item} office={office} update={update} onOpenItem={onOpenItem} onNotice={onNotice} day={day} />) : <div className="occ-empty"><span>✓</span><strong>Nenhuma exceção neste filtro.</strong><small>A operação não possui pendências com esse motivo.</small></div>}</div>

    {financeCount ? <footer className="pending-finance-support"><div><span>Apoio financeiro</span><strong>{financeCount} alerta(s) financeiro(s) fora da fila operacional</strong><small>O Financeiro continua separado para não competir com tarefas, processos e obrigações.</small></div><button type="button" onClick={() => onNavigate?.('honorarios')}>Abrir Financeiro</button></footer> : null}
  </section>
}
