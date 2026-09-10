import { useEffect, useId, useMemo, useState } from 'react'
import { today } from '../lib/storage.js'
import { buildWorkHorizon, WORK_HORIZONS } from '../lib/workHorizons.js'
import { selectWorkBoard, workItemSummary } from '../lib/workBoardView.js'
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
      <small>{workItemSummary(item)}</small>
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
  const [scope, setScope] = useState('all')
  const resultsId = useId()
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

  const selection = useMemo(() => selectWorkBoard(view, { scope, type: filter }), [view, scope, filter])
  const visibleGroups = selection.groups

  function chooseScope(value) {
    setScope(value)
    setFilter('all')
    setExpandedGroups(new Set())
  }

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
    ? 'Organize as prioridades de hoje e os itens em atraso.'
    : horizon === 'week'
      ? 'Planeje os próximos 7 dias e acompanhe os itens em atraso.'
      : 'Veja os próximos 30 dias e distribua melhor o trabalho.'
  const scopeLabel = { all: 'No radar', overdue: 'Em atraso', critical: 'Críticos', unscheduled: 'Sem data' }[scope]

  return <section className="v12-horizon-board" aria-label="Planejamento por período">
    {notice ? <div className="v12-horizon-toast"><span>{notice}</span>{undoState ? <button type="button" onClick={undoCompletion}>Desfazer</button> : null}</div> : null}
    <header className="v12-horizon-header">
      <div className="v12-horizon-heading"><span>Central de trabalho · V12.1</span><h1>Meu Dia</h1><p>{horizonText}</p></div>
      <nav className="v12-horizon-switch" aria-label="Período de planejamento">
        {Object.values(WORK_HORIZONS).map(option => <button type="button" aria-pressed={horizon === option.id} aria-controls={resultsId} className={horizon === option.id ? 'active' : ''} onClick={() => chooseHorizon(option.id)} key={option.id}><strong>{option.shortLabel}</strong></button>)}
      </nav>
      <div className="v12-horizon-actions"><button type="button" onClick={() => onNavigate?.('tarefas')}><Icon name="tasks" size={18} />Tarefas</button><button type="button" className="secondary" onClick={() => onNavigate?.('calendario')}><Icon name="calendar" size={18} />Calendário</button></div>
    </header>

    <div className="v12-horizon-kpis">
      <button type="button" aria-pressed={scope === 'all'} aria-controls={resultsId} className={scope === 'all' ? 'active' : ''} onClick={() => chooseScope('all')}><i className="v12-metric-icon" aria-hidden="true"><Icon name="layers" size={22} /></i><span>No radar</span><strong>{view.total}</strong><small>No período e em atraso</small></button>
      <button type="button" aria-pressed={scope === 'overdue'} aria-controls={resultsId} className={`danger ${scope === 'overdue' ? 'active' : ''}`} onClick={() => chooseScope('overdue')}><i className="v12-metric-icon" aria-hidden="true"><Icon name="clock" size={22} /></i><span>Atrasados</span><strong>{view.overdue.length}</strong><small>prazo oficial vencido</small></button>
      <button type="button" aria-pressed={scope === 'critical'} aria-controls={resultsId} className={`warning ${scope === 'critical' ? 'active' : ''}`} onClick={() => chooseScope('critical')}><i className="v12-metric-icon" aria-hidden="true"><Icon name="warning" size={22} /></i><span>Críticos</span><strong>{view.critical.length}</strong><small>Pedem atenção primeiro</small></button>
      <button type="button" aria-pressed={scope === 'unscheduled'} aria-controls={resultsId} className={scope === 'unscheduled' ? 'active' : ''} onClick={() => chooseScope('unscheduled')}><i className="v12-metric-icon" aria-hidden="true"><Icon name="calendarOff" size={22} /></i><span>Sem data</span><strong>{view.unscheduled.length}</strong><small>Aguardam planejamento</small></button>
    </div>

    <div className="v12-horizon-filters" aria-label="Filtrar tipo de trabalho">
      {filters.map(([id, label]) => {
        const count = selection.counts[id] || 0
        return <button type="button" aria-pressed={filter === id} aria-controls={resultsId} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)} key={id}>{label}<span>{count}</span></button>
      })}
    </div>

    {scope === 'all' && view.overloaded && view.peak ? <div className="v12-load-alert"><div><strong>Concentração de trabalho detectada</strong><span>{view.peak.label} concentra {view.peak.items.length} itens do período.</span></div><button type="button" onClick={() => onNavigate?.('calendario')}>Ver calendário</button></div> : null}

    <p className="v12-result-summary" role="status">{scopeLabel} · {selection.items.length} {selection.items.length === 1 ? 'item' : 'itens'}{filter !== 'all' ? ` · ${filters.find(([id]) => id === filter)?.[1]}` : ''}</p>
    <div className="v12-horizon-groups" id={resultsId}>
      {visibleGroups.length ? visibleGroups.map(group => {
        const limit = horizon === 'month' && !expandedGroups.has(group.key) ? 8 : group.items.length
        const hidden = Math.max(0, group.items.length - limit)
        return <section className={`v12-period-group ${group.overdue ? 'overdue' : ''}`} key={group.key}>
          <header><div><span>{group.overdue ? 'Prioridade' : scope === 'unscheduled' ? 'Planejamento pendente' : horizon === 'month' ? 'Bloco semanal' : 'Agenda'}</span><strong>{group.label}</strong></div><b>{group.items.length}</b></header>
          <div className="v12-period-items">{group.items.slice(0, limit).map(item => <HorizonItem key={item.key} item={item} office={office} update={update} onOpenItem={onOpenItem} onNotice={setNotice} onCompleted={registerCompletion} day={day} />)}</div>
          {hidden ? <button type="button" className="v12-show-more" onClick={() => toggleGroup(group.key)}>Mostrar mais {hidden}</button> : horizon === 'month' && expandedGroups.has(group.key) && group.items.length > 8 ? <button type="button" className="v12-show-more" onClick={() => toggleGroup(group.key)}>Recolher semana</button> : null}
        </section>
      }) : <div className="v12-horizon-empty"><span><Icon name="check" size={24} /></span><strong>Nenhum item neste filtro.</strong><small>{scope === 'unscheduled' ? 'Os registros deste tipo estão com data definida.' : `Não há itens nessa seleção para ${view.label.toLowerCase()}.`}</small>{scope !== 'all' || filter !== 'all' ? <button type="button" onClick={() => chooseScope('all')}>Ver todos</button> : null}</div>}
    </div>

    {scope === 'unscheduled' && selection.items.length ? <footer className="v12-unscheduled"><div><strong>Defina as próximas datas</strong><span>Abra um registro para planejar quando ele deve ser feito.</span></div><button type="button" onClick={() => onNavigate?.('pendencias')}>Revisar pendências</button></footer> : null}
  </section>
}
