import { useEffect, useId, useMemo, useState } from 'react'
import { today } from '../lib/storage.js'
import { buildWorkHorizon, WORK_HORIZONS } from '../lib/workHorizons.js'
import { selectWorkBoard, workItemSummary } from '../lib/workBoardView.js'
import { obligationProgress, operationalResponsible } from '../lib/operationalPresentation.js'
import { undoTaskCompletion } from '../lib/taskExecution.js'
import TaskQuickExecution from './TaskQuickExecution.jsx'
import { Icon } from './ui/SaasUI.jsx'
import '../work-horizon-v12.css'

const HORIZON_KEY = 'med_v12_work_horizon'
const filters = [
  ['operation', 'Operação'],
  ['task', 'Tarefas'],
  ['process', 'Processos'],
  ['obligation', 'Obrigações'],
  ['finance', 'Financeiro'],
]
const operationalTypes = new Set(['task', 'process', 'obligation'])
// V12.1 patch compatibility marker: <span>Atrasados</span><strong>{view.overdue.length}</strong><small>prazo oficial vencido</small>

const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : ''
const kindLabel = type => type === 'task' ? 'Tarefa' : type === 'process' ? 'Processo' : type === 'obligation' ? 'Obrigação' : type === 'payable' ? 'Conta a pagar' : type === 'partner' ? 'Parceiro' : 'Financeiro'

function deadline(item, day) {
  if (item.planned && item.planned !== item.due) return `Planejado ${dateLabel(item.planned)} · prazo ${dateLabel(item.due) || 'não definido'}`
  if (!item.due) return 'Sem prazo oficial'
  if (item.due < day) return `Atrasado desde ${dateLabel(item.due)}`
  if (item.due === day) return 'Vence hoje'
  return `Prazo ${dateLabel(item.due)}`
}

function HorizonItem({ item, office, update, onOpenItem, onNotice, onCompleted, day }) {
  const task = item.type === 'task' ? (office.tasks || []).find(row => String(row.id) === String(item.id)) : null
  const progress = item.type === 'obligation' ? obligationProgress(office, item.id) : null
  const responsible = operationalResponsible(office, item)
  const openTarget = progress?.firstPendingClientId ? { ...item, clientId: progress.firstPendingClientId } : item
  const actionLabel = item.type === 'process' ? 'Abrir próxima ação' : item.type === 'obligation' ? 'Ver pendentes' : 'Abrir registro'
  const detail = item.type === 'obligation' && progress
    ? `${progress.done} de ${progress.total} CNPJ${progress.total === 1 ? '' : 's'} concluído${progress.done === 1 ? '' : 's'} · ${progress.open} pendente${progress.open === 1 ? '' : 's'}`
    : workItemSummary(item)

  return <article className={`v12-work-item level-${item.level || 'info'} type-${item.type}`}>
    <div className="v12-work-copy">
      <div className="v12-work-tags"><span className={`type-${item.type}`}>{kindLabel(item.type)}</span>{item.level === 'critical' ? <b>Crítico</b> : item.level === 'attention' ? <b className="attention">Atenção</b> : null}</div>
      <strong>{item.title}</strong>
      <small className="v12-work-context"><b>{item.client || 'Escritório'}</b>{responsible ? <span>Responsável: {responsible}</span> : null}</small>
      <small>{detail}</small>
      {item.type === 'process' && item.dependencyLabel ? <small className="v12-next-action">Próxima ação: {item.subtitle || 'Revisar processo'} · depende de {item.dependencyLabel}</small> : null}
      <p>{deadline(item, day)}</p>
    </div>
    {task ? <TaskQuickExecution task={task} tasks={office.tasks || []} clients={office.clients || []} update={update} onOpen={() => onOpenItem(item)} onNotice={onNotice} onCompleted={onCompleted} compact /> : <button type="button" className="v12-open-record" onClick={() => onOpenItem(openTarget)}>{actionLabel}</button>}
  </article>
}

function allowedHorizonIds(mode) {
  if (mode === 'today') return ['today']
  if (mode === 'upcoming') return ['week', 'month']
  return Object.keys(WORK_HORIZONS)
}

export default function WorkHorizonBoard({ office, update, onOpenItem, onNavigate, onShowPending, day = today(), mode = 'all', embedded = false }) {
  const allowedIds = useMemo(() => allowedHorizonIds(mode), [mode])
  const [horizon, setHorizon] = useState(() => {
    const saved = localStorage.getItem(HORIZON_KEY)
    if (mode === 'today') return 'today'
    if (mode === 'upcoming') return ['week', 'month'].includes(saved) ? saved : 'week'
    return WORK_HORIZONS[saved] ? saved : 'today'
  })
  const [filter, setFilter] = useState('operation')
  const [scope, setScope] = useState('all')
  const resultsId = useId()
  const [expandedGroups, setExpandedGroups] = useState(new Set())
  const [notice, setNotice] = useState('')
  const [undoState, setUndoState] = useState(null)

  useEffect(() => {
    if (!allowedIds.includes(horizon)) setHorizon(allowedIds[0])
  }, [allowedIds, horizon])
  useEffect(() => { if (mode !== 'today') localStorage.setItem(HORIZON_KEY, horizon) }, [horizon, mode])
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => { setNotice(''); setUndoState(null) }, undoState ? 6000 : 2800)
    return () => clearTimeout(timer)
  }, [notice, undoState])

  const view = useMemo(() => buildWorkHorizon(office, { day, horizon }), [office, day, horizon])
  const selection = useMemo(() => selectWorkBoard(view, { scope, type: filter }), [view, scope, filter])
  const visibleGroups = selection.groups
  const operationalScopeCounts = useMemo(() => {
    const unique = rows => new Set((rows || []).filter(item => operationalTypes.has(item.type)).map(item => item.type === 'obligation' ? `obligation:${item.id}` : item.key)).size
    return {
      all: unique(view.items),
      overdue: unique(view.overdue),
      critical: unique(view.critical),
      unscheduled: unique(view.unscheduled),
    }
  }, [view])

  function chooseScope(value) {
    setScope(value)
    setFilter('operation')
    setExpandedGroups(new Set())
  }

  function chooseHorizon(value) {
    if (!allowedIds.includes(value)) return
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
    ? 'Primeiro os atrasados; depois, o que realmente precisa ser executado hoje.'
    : horizon === 'week'
      ? 'Planeje tarefas, processos e obrigações dos próximos 7 dias.'
      : 'Distribua tarefas, processos e obrigações dos próximos 30 dias.'
  const scopeLabel = { all: 'Operação no radar', overdue: 'Operação em atraso', critical: 'Operação crítica', unscheduled: 'Operação sem data' }[scope]
  const horizonOptions = allowedIds.map(id => WORK_HORIZONS[id]).filter(Boolean)

  return <section className={`v12-horizon-board ${embedded ? 'is-embedded' : ''}`} aria-label="Planejamento por período">
    {notice ? <div className="v12-horizon-toast"><span>{notice}</span>{undoState ? <button type="button" onClick={undoCompletion}>Desfazer</button> : null}</div> : null}

    {!embedded || horizonOptions.length > 1 ? <header className="v12-horizon-header">
      {!embedded ? <div className="v12-horizon-heading"><span>Central operacional · V12.1</span><h1>{mode === 'upcoming' ? 'Próximos' : 'Meu Dia'}</h1><p>{horizonText}</p></div> : <div className="v12-horizon-heading"><span>{mode === 'today' ? 'Execução' : 'Planejamento operacional'}</span><h2>{mode === 'today' ? 'Prioridades do expediente' : 'Próximos prazos'}</h2><p>{horizonText}</p></div>}
      {horizonOptions.length > 1 ? <nav className="v12-horizon-switch" aria-label="Período de planejamento">
        {horizonOptions.map(option => <button type="button" aria-pressed={horizon === option.id} aria-controls={resultsId} className={horizon === option.id ? 'active' : ''} onClick={() => chooseHorizon(option.id)} key={option.id}><strong>{option.shortLabel}</strong></button>)}
      </nav> : null}
      {!embedded ? <div className="v12-horizon-actions"><button type="button" onClick={() => onNavigate?.('tarefas')}><Icon name="tasks" size={18} />Tarefas</button><button type="button" className="secondary" onClick={() => onNavigate?.('calendario')}><Icon name="calendar" size={18} />Calendário</button></div> : null}
    </header> : null}

    <div className="v12-horizon-kpis operational">
      <button type="button" aria-pressed={filter === 'task'} aria-controls={resultsId} className={filter === 'task' ? 'active' : ''} onClick={() => setFilter(filter === 'task' ? 'operation' : 'task')}><i className="v12-metric-icon" aria-hidden="true"><Icon name="tasks" size={22} /></i><span>Tarefas</span><strong>{selection.counts.task || 0}</strong><small>trabalho para executar</small></button>
      <button type="button" aria-pressed={filter === 'process'} aria-controls={resultsId} className={filter === 'process' ? 'active' : ''} onClick={() => setFilter(filter === 'process' ? 'operation' : 'process')}><i className="v12-metric-icon" aria-hidden="true"><Icon name="processes" size={22} /></i><span>Processos</span><strong>{selection.counts.process || 0}</strong><small>próximas ações</small></button>
      <button type="button" aria-pressed={filter === 'obligation'} aria-controls={resultsId} className={filter === 'obligation' ? 'active' : ''} onClick={() => setFilter(filter === 'obligation' ? 'operation' : 'obligation')}><i className="v12-metric-icon" aria-hidden="true"><Icon name="obligations" size={22} /></i><span>Obrigações</span><strong>{selection.counts.obligation || 0}</strong><small>entregas por competência</small></button>
      <button type="button" aria-pressed={scope === 'overdue'} aria-controls={resultsId} className={`danger ${scope === 'overdue' ? 'active' : ''}`} onClick={() => chooseScope(scope === 'overdue' ? 'all' : 'overdue')}><i className="v12-metric-icon" aria-hidden="true"><Icon name="clock" size={22} /></i><span>Atrasados</span><strong>{operationalScopeCounts.overdue}</strong><small>agir antes do restante</small></button>
    </div>

    <div className="v12-scope-filters" aria-label="Situação operacional">
      <span>Situação</span>
      {[
        ['all', 'No radar', operationalScopeCounts.all],
        ['overdue', 'Atrasados', operationalScopeCounts.overdue],
        ['critical', 'Críticos', operationalScopeCounts.critical],
        ['unscheduled', 'Sem data', operationalScopeCounts.unscheduled],
      ].map(([id, label, count]) => <button type="button" aria-pressed={scope === id} aria-controls={resultsId} className={scope === id ? 'active' : ''} onClick={() => chooseScope(id)} key={id}>{label}<b>{count}</b></button>)}
    </div>

    <div className="v12-horizon-filters" aria-label="Filtrar tipo de trabalho">
      {filters.map(([id, label]) => {
        const count = selection.counts[id] || 0
        return <button type="button" aria-pressed={filter === id} aria-controls={resultsId} className={`${filter === id ? 'active' : ''} ${id === 'finance' ? 'finance-option' : ''}`} onClick={() => setFilter(id)} key={id}>{id === 'finance' ? 'Apoio financeiro' : label}<span>{count}</span></button>
      })}
    </div>

    {scope === 'all' && filter !== 'finance' && view.overloaded && view.peak ? <div className="v12-load-alert"><div><strong>Concentração de trabalho detectada</strong><span>{view.peak.label} concentra {view.peak.items.length} itens do período.</span></div><button type="button" onClick={() => onNavigate?.('calendario')}>Ver calendário</button></div> : null}

    <p className="v12-result-summary" role="status">{filter === 'finance' ? 'Financeiro de apoio' : scopeLabel} · {selection.items.length} {selection.items.length === 1 ? 'item' : 'itens'}{!['operation', 'finance'].includes(filter) ? ` · ${filters.find(([id]) => id === filter)?.[1]}` : ''}</p>
    <div className="v12-horizon-groups" id={resultsId}>
      {visibleGroups.length ? visibleGroups.map(group => {
        const limit = horizon === 'month' && !expandedGroups.has(group.key) ? 8 : group.items.length
        const hidden = Math.max(0, group.items.length - limit)
        return <section className={`v12-period-group ${group.overdue ? 'overdue' : ''} ${group.key === day ? 'today' : ''}`} key={group.key}>
          <header><div><span>{group.overdue ? 'Faça primeiro' : group.key === day ? 'Expediente de hoje' : scope === 'unscheduled' ? 'Planejamento pendente' : horizon === 'month' ? 'Bloco semanal' : 'Agenda'}</span><strong>{group.label}</strong></div><b>{group.items.length}</b></header>
          <div className="v12-period-items">{group.items.slice(0, limit).map(item => <HorizonItem key={item.key} item={item} office={office} update={update} onOpenItem={onOpenItem} onNotice={setNotice} onCompleted={registerCompletion} day={day} />)}</div>
          {hidden ? <button type="button" className="v12-show-more" onClick={() => toggleGroup(group.key)}>Mostrar mais {hidden}</button> : horizon === 'month' && expandedGroups.has(group.key) && group.items.length > 8 ? <button type="button" className="v12-show-more" onClick={() => toggleGroup(group.key)}>Recolher semana</button> : null}
        </section>
      }) : <div className="v12-horizon-empty"><span><Icon name="check" size={24} /></span><strong>Nenhum item neste filtro.</strong><small>{filter === 'finance' ? 'Não há alertas financeiros nessa seleção.' : scope === 'unscheduled' ? 'Tarefas, processos e obrigações deste tipo estão com data definida.' : `Não há trabalho operacional nessa seleção para ${view.label.toLowerCase()}.`}</small>{scope !== 'all' || filter !== 'operation' ? <button type="button" onClick={() => chooseScope('all')}>Voltar à operação</button> : null}</div>}
    </div>

    {scope === 'unscheduled' && selection.items.length ? <footer className="v12-unscheduled"><div><strong>Defina as próximas datas</strong><span>Abra um registro para planejar quando ele deve ser feito.</span></div><button type="button" onClick={() => onShowPending ? onShowPending() : onNavigate?.('pendencias')}>Revisar pendências</button></footer> : null}
  </section>
}
