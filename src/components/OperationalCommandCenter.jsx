import { useEffect, useMemo, useState } from 'react'
import { Icon } from './ui/SaasUI.jsx'
import { workItemSummary } from '../lib/workBoardView.js'
import { today } from '../lib/storage.js'
import { addDays, collectCommandCenterItems, replanTask } from '../lib/operationalIntelligence.js'
import WorkHorizonBoard from './WorkHorizonBoard.jsx'

// MED_INFORMATION_ARCHITECTURE_V12_2
const tabs = [
  ['today', 'Hoje'],
  ['pending', 'Pendências'],
  ['upcoming', 'Próximos'],
]

const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'
const normalizeTab = value => value === 'pending' ? 'pending' : value === 'week' || value === 'upcoming' ? 'upcoming' : 'today'

function deadlineText(item, day) {
  if (item.planned && item.planned === day && item.due !== day) return `Planejada para hoje · prazo oficial ${dateLabel(item.due)}`
  if (!item.due) return item.planned ? `Planejada para ${dateLabel(item.planned)} · sem prazo oficial` : 'Sem prazo definido'
  if (item.days < 0) return `${Math.abs(item.days)} dia${Math.abs(item.days) === 1 ? '' : 's'} em atraso · ${dateLabel(item.due)}`
  if (item.days === 0) return `Vence hoje · ${dateLabel(item.due)}`
  if (item.days === 1) return `Vence amanhã · ${dateLabel(item.due)}`
  return `Vence em ${item.days} dias · ${dateLabel(item.due)}`
}

function LevelBadge({ level }) {
  const label = level === 'critical' ? 'Crítico' : level === 'attention' ? 'Atenção' : 'Próximo'
  return <span className={`occ-level ${level}`}>{label}</span>
}

function WorkCard({ item, day, onOpen, onPlanTomorrow, onClearPlan }) {
  const kind = item.kindLabel || (item.type === 'finance' ? 'Financeiro' : item.type === 'payable' ? 'Conta a pagar' : item.type === 'partner' ? 'Parceiro' : 'Item')
  return <article className={`occ-work-card level-${item.level}`}>
    <div className="occ-work-main">
      <div className="occ-work-tags"><LevelBadge level={item.level} /><span className={`occ-kind type-${item.type}`}>{kind}</span>{item.priority && item.priority !== 'Normal' ? <span className="occ-priority">{item.priority}</span> : null}</div>
      <strong>{item.title}</strong>
      <small>{workItemSummary(item)}</small>
      <p>{deadlineText(item, day)}</p>
    </div>
    <div className="occ-work-actions">
      <button type="button" onClick={() => onOpen(item)}>Abrir</button>
      {item.type === 'task' ? item.planned ? <button type="button" className="ghost" onClick={() => onClearPlan(item)}>Limpar plano</button> : <button type="button" className="ghost" onClick={() => onPlanTomorrow(item)}>Planejar amanhã</button> : null}
    </div>
  </article>
}

function Empty({ title, text }) {
  return <div className="occ-empty"><span>✓</span><strong>{title}</strong><small>{text}</small></div>
}

export default function OperationalCommandCenter({ office, update, onOpenItem, onNavigate, initialTab = 'today' }) {
  const day = today()
  const [tab, setTab] = useState(() => normalizeTab(initialTab))
  const [pendingFilter, setPendingFilter] = useState(initialTab === 'pending' ? 'critical' : 'all')
  const [notice, setNotice] = useState('')

  useEffect(() => { setTab(normalizeTab(initialTab)) }, [initialTab])
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 2800)
    return () => clearTimeout(timer)
  }, [notice])

  const commandItems = useMemo(() => collectCommandCenterItems(office, { day, daysBefore: 60 }), [office, day])
  const counts = useMemo(() => ({
    critical: commandItems.filter(item => item.level === 'critical').length,
    overdue: commandItems.filter(item => item.due && item.due < day).length,
    waiting: commandItems.filter(item => String(item.status || '').toLowerCase().includes('aguardando')).length,
    finance: commandItems.filter(item => ['finance', 'payable', 'partner'].includes(item.type)).length,
  }), [commandItems, day])

  const filteredPending = useMemo(() => commandItems.filter(item => {
    if (pendingFilter === 'critical') return item.level === 'critical'
    if (pendingFilter === 'overdue') return Boolean(item.due && item.due < day)
    if (pendingFilter === 'waiting') return String(item.status || '').toLowerCase().includes('aguardando')
    if (pendingFilter === 'finance') return ['finance', 'payable', 'partner'].includes(item.type)
    return true
  }), [commandItems, day, pendingFilter])

  function planTomorrow(item) {
    const target = addDays(day, 1)
    update(draft => { draft.tasks = replanTask(draft.tasks || [], item.id, target) })
    setNotice(`Tarefa planejada para ${dateLabel(target)}. O prazo oficial foi preservado.`)
  }

  function clearPlan(item) {
    update(draft => { draft.tasks = replanTask(draft.tasks || [], item.id, '') })
    setNotice('Planejamento removido. O prazo oficial permanece inalterado.')
  }

  const heroText = counts.critical
    ? `${counts.critical} item(ns) crítico(s) pedem atenção.`
    : counts.overdue
      ? `${counts.overdue} item(ns) atrasado(s) precisam de revisão.`
      : 'A operação não tem item crítico neste momento.'

  return <div className="occ-shell">
    {notice ? <div className="occ-toast">{notice}</div> : null}

    <header className="occ-hero">
      <div><span className="occ-eyebrow">Central de trabalho</span><h1>Meu Dia</h1><p>{heroText}</p></div>
      <div className="occ-hero-actions"><button type="button" onClick={() => onNavigate('tarefas')}><Icon name="tasks" size={17} /> Tarefas</button><button type="button" className="secondary" onClick={() => onNavigate('calendario')}><Icon name="calendar" size={17} /> Calendário</button></div>
    </header>

    <nav className="occ-tabs" aria-label="Visões do Meu Dia">
      {tabs.map(([id, label]) => <button type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}>{label}</button>)}
    </nav>

    {tab === 'today' ? <WorkHorizonBoard office={office} update={update} onOpenItem={onOpenItem} onNavigate={onNavigate} onShowPending={() => setTab('pending')} day={day} mode="today" embedded /> : null}

    {tab === 'pending' ? <section className="occ-panel">
      <header className="occ-panel-head"><div><span>Central de pendências</span><h2>O que precisa da sua atenção</h2><p>Itens críticos, atrasos, dependências de cliente e alertas financeiros em um só lugar.</p></div><b>{filteredPending.length} item(ns)</b></header>
      <div className="occ-kpis" aria-label="Resumo de pendências">
        <button type="button" className={counts.critical ? 'critical' : ''} onClick={() => setPendingFilter('critical')}><span>Críticos</span><strong>{counts.critical}</strong><small>exigem ação</small></button>
        <button type="button" className={counts.overdue ? 'warning' : ''} onClick={() => setPendingFilter('overdue')}><span>Atrasados</span><strong>{counts.overdue}</strong><small>prazo vencido</small></button>
        <button type="button" onClick={() => setPendingFilter('waiting')}><span>Aguardando cliente</span><strong>{counts.waiting}</strong><small>dependem de retorno</small></button>
        <button type="button" onClick={() => setPendingFilter('finance')}><span>Financeiro</span><strong>{counts.finance}</strong><small>receber, pagar e parceiros</small></button>
      </div>
      <div className="occ-filter-row">
        {[['critical', 'Críticos'], ['overdue', 'Atrasados'], ['waiting', 'Aguardando cliente'], ['finance', 'Financeiro'], ['all', 'Todos']].map(([id, label]) => <button type="button" className={pendingFilter === id ? 'active' : ''} onClick={() => setPendingFilter(id)} key={id}>{label}</button>)}
      </div>
      <div className="occ-work-list">{filteredPending.length ? filteredPending.map(item => <WorkCard key={item.key} item={item} day={day} onOpen={onOpenItem} onPlanTomorrow={planTomorrow} onClearPlan={clearPlan} />) : <Empty title="Sem itens neste filtro" text="Nenhuma pendência corresponde ao critério selecionado." />}</div>
    </section> : null}

    {tab === 'upcoming' ? <WorkHorizonBoard office={office} update={update} onOpenItem={onOpenItem} onNavigate={onNavigate} onShowPending={() => setTab('pending')} day={day} mode="upcoming" embedded /> : null}
  </div>
}
