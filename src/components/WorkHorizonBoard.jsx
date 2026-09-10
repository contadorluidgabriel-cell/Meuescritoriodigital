import { useEffect, useMemo, useState } from 'react'
import { today } from '../lib/storage.js'
import { buildWorkHorizon, WORK_HORIZONS } from '../lib/workHorizons.js'
import { undoTaskCompletion } from '../lib/taskExecution.js'
import TaskQuickExecution from './TaskQuickExecution.jsx'
import { Icon } from './ui/SaasUI.jsx'
import '../work-horizon-v12.css'

const HORIZON_KEY = 'med_v12_work_horizon'
const filters = [
  ['all', 'Tudo'],
  ['task', 'Tarefas'],
  ['process', 'Processos'],
  ['obligation', 'Obrigações'],
  ['finance', 'Financeiro'],
]

const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : ''
const kindLabel = type => type === 'task' ? 'Tarefa' : type === 'process' ? 'Processo' : type === 'obligation' ? 'Obrigação' : type === 'partner' ? 'Parceiro' : 'Financeiro'

function matchesFilter(item, filter) {
  if (filter === 'all') return true
  if (filter === 'finance') return item.type === 'finance' || item.type === 'partner'
  return item.type === filter
}

function deadline(item, day) {
  if (item.planned && item.planned !== item.due) return `Planejado ${dateLabel(item.planned)} · prazo ${dateLabel(item.due) || 'não definido'}`
  if (!item.due) return 'Sem prazo oficial'
  if (item.due < day) return `Atrasado desde ${dateLabel(item.due)}`
  if (item.due === day) return 'Vence hoje'
  return `Prazo ${dateLabel(item.due)}`
}

function HorizonItem({ item, office, update, onOpenItem, onNotice, onCompleted, day }) {
  const task = item.type === 'task' ? (office.tasks || []).find(row => String(row.id) === String(item.id)) : null
  return <article className={`v12-work-item level-${item.level || 'info'}`}>
    <div className="v12-work-copy">
      <div className="v12-work-tags"><span className={`type-${item.type}`}>{kindLabel(item.type)}</span>{item.level === 'critical' ? <b>Crítico</b> : item.level === 'attention' ? <b className="attention">Atenção</b> : null}</div>
      <strong>{item.title}</strong>
      <small>{item.client || 'Escritório'}{item.subtitle ? ` · ${item.subtitle}` : ''}</small>
      <p>{deadline(item, day)}</p>
    </div>
    {task ? <TaskQuickExecution task={task} tasks={office.tasks || []} clients={office.clients || []} update={update} onOpen={() => onOpenItem(item)} onNotice={onNotice} onCompleted={onCompleted} compact /> : <button type="button" className="v12-open-record" onClick={() => onOpenItem(item)}>Abrir registro</button>}
  </article>
}

export default function WorkHorizonBoard({ office, update, onOpenItem, onNavigate, day = today() }) {
  const [horizon, setHorizon] = useState(() => {
    const saved = localStorage.getItem(HORIZON_KEY)
    return WORK_HORIZONS[saved] ? saved : 'today'
  })
  const [filter, setFilter] = useState('all')
  const [expandedGroups, setExpandedGroups] = useState(new Set())
  const [notice, setNotice] = useState('')
  const [undoState, setUndoState] = useState(null)
  const view = useMemo(() => buildWorkHorizon(office, { day, horizon }), [office, day, horizon])

  useEffect(() => { localStorage.setItem(HORIZON_KEY, horizon) }, [horizon])
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => { setNotice(''); setUndoState(null) }, undoState ? 6000 : 2800)
    return () => clearTimeout(timer)
  }, [notice, undoState])

  const visibleGroups = useMemo(() => view.groups.map(group => ({ ...group, items: group.items.filter(item => matchesFilter(item, filter)) })).filter(group => group.items.length), [filter, view.groups])
  const visibleUnscheduled = useMemo(() => view.unscheduled.filter(item => matchesFilter(item, filter)), [filter, view.unscheduled])

  function chooseHorizon(value) {
    setHorizon(value)
    setExpandedGroups(new Set())
  }

  function registerCompletion(transaction, title) {
    if (transaction) setUndoState({ transaction, title })
  }

  function undoCompletion() {
    if (!undoState?.transaction) return
    const result = undoTaskCompletion(office.tasks || [], undoState.transaction)
    if (!result.changed) { setNotice(result.error || 'Não foi possível desfazer.'); return }
    update(draft => { draft.tasks = result.tasks })
    setUndoState(null)
    setNotice('Conclusão desfeita.')
  }

  function toggleGroup(key) {
    setExpandedGroups(current => {
      const next = new Set(current)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const horizonText = horizon === 'today'
    ? 'O que precisa ser resolvido hoje, incluindo atrasados.'
    : horizon === 'week'
      ? 'Enxergue a carga dos próximos 7 dias antes que os prazos virem urgência.'
      : 'Antecipe as próximas 4 semanas e identifique concentração de trabalho.'

  return <section className="v12-horizon-board" aria-label="Planejamento por período">
    {notice ? <div className="v12-horizon-toast"><span>{notice}</span>{undoState ? <button type="button" onClick={undoCompletion}>Desfazer</button> : null}</div> : null}
    <header className="v12-horizon-header">
      <div><span>Central de trabalho · V12</span><h2>O que precisa ser feito?</h2><p>{horizonText}</p></div>
      <nav className="v12-horizon-switch" aria-label="Período de planejamento">
        {Object.values(WORK_HORIZONS).map(option => <button type="button" className={horizon === option.id ? 'active' : ''} onClick={() => chooseHorizon(option.id)} key={option.id}><strong>{option.shortLabel}</strong><small>{option.id === 'today' ? 'agora' : option.id === 'week' ? 'planejar semana' : 'antecipar mês'}</small></button>)}
      </nav>
    </header>

    <div className="v12-horizon-kpis">
      <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}><i className="v12-metric-icon" aria-hidden="true"><Icon name="layers" size={22} /></i><span>No radar</span><strong>{view.total}</strong><small>{view.scheduledTotal} no período + {view.overdue.length} atrasado(s)</small></button>
      <button type="button" className={view.overdue.length ? 'danger' : ''} onClick={() => setFilter('all')}><i className="v12-metric-icon" aria-hidden="true"><Icon name="clock" size={22} /></i><span>Atrasados</span><strong>{view.overdue.length}</strong><small>prazo oficial vencido</small></button>
      <button type="button" className={view.critical.length ? 'warning' : ''} onClick={() => setFilter('all')}><i className="v12-metric-icon" aria-hidden="true"><Icon name="warning" size={22} /></i><span>Críticos</span><strong>{view.critical.length}</strong><small>pedem atenção primeiro</small></button>
      <button type="button" onClick={() => onNavigate?.('pendencias')}><i className="v12-metric-icon" aria-hidden="true"><Icon name="calendarOff" size={22} /></i><span>Sem data</span><strong>{view.unscheduled.length}</strong><small>fora do planejamento temporal</small></button>
    </div>

    <div className="v12-horizon-filters" aria-label="Filtrar tipo de trabalho">
      {filters.map(([id, label]) => {
        const count = id === 'all' ? view.total : id === 'finance' ? view.typeCounts.finance : view.typeCounts[id] || 0
        return <button type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)} key={id}>{label}<span>{count}</span></button>
      })}
    </div>

    {view.overloaded && view.peak ? <div className="v12-load-alert"><div><strong>Concentração de trabalho detectada</strong><span>{view.peak.label} concentra {view.peak.items.length} itens do período.</span></div><button type="button" onClick={() => onNavigate?.('calendario')}>Ver calendário</button></div> : null}

    <div className="v12-horizon-groups">
      {visibleGroups.length ? visibleGroups.map(group => {
        const limit = horizon === 'month' && !expandedGroups.has(group.key) ? 8 : group.items.length
        const hidden = Math.max(0, group.items.length - limit)
        return <section className={`v12-period-group ${group.overdue ? 'overdue' : ''}`} key={group.key}>
          <header><div><span>{group.overdue ? 'Prioridade' : horizon === 'month' ? 'Bloco semanal' : 'Agenda'}</span><strong>{group.label}</strong></div><b>{group.items.length}</b></header>
          <div className="v12-period-items">{group.items.slice(0, limit).map(item => <HorizonItem key={item.key} item={item} office={office} update={update} onOpenItem={onOpenItem} onNotice={setNotice} onCompleted={registerCompletion} day={day} />)}</div>
          {hidden ? <button type="button" className="v12-show-more" onClick={() => toggleGroup(group.key)}>Mostrar mais {hidden}</button> : horizon === 'month' && expandedGroups.has(group.key) && group.items.length > 8 ? <button type="button" className="v12-show-more" onClick={() => toggleGroup(group.key)}>Recolher semana</button> : null}
        </section>
      }) : <div className="v12-horizon-empty"><span><Icon name="check" size={24} /></span><strong>Nada neste filtro para {view.label.toLowerCase()}.</strong><small>Você pode antecipar itens futuros ou revisar os registros sem data.</small></div>}
    </div>

    {visibleUnscheduled.length ? <footer className="v12-unscheduled"><div><strong>{visibleUnscheduled.length} item(ns) sem prazo ou planejamento</strong><span>Eles não foram encaixados artificialmente no período.</span></div><button type="button" onClick={() => onNavigate?.('pendencias')}>Revisar pendências</button></footer> : null}
  </section>
}
