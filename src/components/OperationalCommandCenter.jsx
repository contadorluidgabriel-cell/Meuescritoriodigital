import { useEffect, useMemo, useState } from 'react'
import { Icon } from './ui/SaasUI.jsx'
import { today } from '../lib/storage.js'
import {
  addDays,
  answerOfficeQuery,
  buildClientTimeline,
  buildMyDay,
  buildOperationalMetrics,
  buildWeekPlan,
  collectCommandCenterItems,
  replanTask,
} from '../lib/operationalIntelligence.js'

const tabs = [
  ['today', 'Meu Dia'],
  ['pending', 'Pendências'],
  ['week', 'Semana'],
  ['metrics', 'Indicadores'],
  ['ask', 'Consultar'],
]
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'

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

function WorkCard({ item, day, onOpen, onPlanTomorrow, onClearPlan, compact = false }) {
  return <article className={`occ-work-card level-${item.level} ${compact ? 'compact' : ''}`}>
    <div className="occ-work-main">
      <div className="occ-work-tags"><LevelBadge level={item.level} /><span className={`occ-kind type-${item.type}`}>{item.kindLabel || (item.type === 'finance' ? 'Financeiro' : item.type === 'partner' ? 'Parceiro' : 'Item')}</span>{item.priority && item.priority !== 'Normal' ? <span className="occ-priority">{item.priority}</span> : null}</div>
      <strong>{item.title}</strong>
      <small>{item.client || 'Escritório'}{item.subtitle && !String(item.subtitle).startsWith(String(item.client || '')) ? ` · ${item.subtitle}` : ''}</small>
      <p>{deadlineText(item, day)}</p>
    </div>
    <div className="occ-work-actions">
      <button type="button" onClick={() => onOpen(item)}>Abrir</button>
      {item.type === 'task' ? item.planned ? <button type="button" className="ghost" onClick={() => onClearPlan(item)}>Limpar plano</button> : <button type="button" className="ghost" onClick={() => onPlanTomorrow(item)}>Planejar amanhã</button> : null}
    </div>
  </article>
}

function Empty({ title, text }) { return <div className="occ-empty"><span>✓</span><strong>{title}</strong><small>{text}</small></div> }

export default function OperationalCommandCenter({ office, update, onOpenItem, onNavigate, initialTab = 'today' }) {
  const day = today()
  const [tab, setTab] = useState(initialTab)
  const [pendingFilter, setPendingFilter] = useState(initialTab === 'pending' ? 'critical' : 'all')
  const [query, setQuery] = useState('')
  const [queryResult, setQueryResult] = useState(null)
  const [clientId, setClientId] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { setTab(initialTab) }, [initialTab])
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 2800)
    return () => clearTimeout(timer)
  }, [notice])

  const myDay = useMemo(() => buildMyDay(office, { day }), [office, day])
  const week = useMemo(() => buildWeekPlan(office, { day }), [office, day])
  const metrics = useMemo(() => buildOperationalMetrics(office, { day }), [office, day])
  const commandItems = useMemo(() => collectCommandCenterItems(office, { day, daysBefore: 45 }), [office, day])
  const timeline = useMemo(() => buildClientTimeline(office, clientId), [office, clientId])
  const clients = useMemo(() => (office.clients || []).filter(client => client.status !== 'Inativo').sort((a, b) => clientName(a).localeCompare(clientName(b), 'pt-BR')), [office.clients])

  const filteredPending = useMemo(() => commandItems.filter(item => {
    if (pendingFilter === 'critical') return item.level === 'critical'
    if (pendingFilter === 'attention') return item.level === 'attention'
    if (pendingFilter === 'finance') return item.type === 'finance' || item.type === 'partner'
    if (pendingFilter === 'waiting') return String(item.status || '').toLowerCase().includes('aguardando')
    return true
  }), [commandItems, pendingFilter])

  function planTomorrow(item) {
    const target = addDays(day, 1)
    update(draft => { draft.tasks = replanTask(draft.tasks || [], item.id, target) })
    setNotice(`Tarefa planejada para ${dateLabel(target)}. O prazo oficial foi preservado.`)
  }

  function clearPlan(item) {
    update(draft => { draft.tasks = replanTask(draft.tasks || [], item.id, '') })
    setNotice('Planejamento removido. O prazo oficial permanece inalterado.')
  }

  function submitQuery(event) {
    event?.preventDefault?.()
    setQueryResult(answerOfficeQuery(office, query, { day }))
  }

  function quickQuery(value) {
    setQuery(value)
    setQueryResult(answerOfficeQuery(office, value, { day }))
  }

  const heroText = myDay.critical.length
    ? `${myDay.critical.length} item(ns) crítico(s) pedem atenção agora.`
    : myDay.overdue.length
      ? `${myDay.overdue.length} item(ns) atrasado(s) precisam entrar no plano.`
      : 'A operação não tem item crítico neste momento.'

  return <div className="occ-shell">
    {notice ? <div className="occ-toast">{notice}</div> : null}
    <header className="occ-hero">
      <div><span className="occ-eyebrow">Centro de comando</span><h1>Meu Dia</h1><p>{heroText}</p></div>
      <div className="occ-hero-actions"><button type="button" onClick={() => onNavigate('tarefas')}><Icon name="tasks" size={17} /> Nova/abrir tarefa</button><button type="button" className="secondary" onClick={() => onNavigate('calendario')}><Icon name="calendar" size={17} /> Calendário</button></div>
    </header>

    <section className="occ-kpis" aria-label="Resumo operacional">
      <button type="button" className={myDay.critical.length ? 'critical' : ''} onClick={() => { setTab('pending'); setPendingFilter('critical') }}><span>Críticos</span><strong>{myDay.critical.length}</strong><small>exigem ação</small></button>
      <button type="button" className={myDay.overdue.length ? 'warning' : ''} onClick={() => { setTab('pending'); setPendingFilter('critical') }}><span>Atrasados</span><strong>{myDay.overdue.length}</strong><small>prazo vencido</small></button>
      <button type="button" onClick={() => setTab('today')}><span>Hoje</span><strong>{myDay.dueToday.length + myDay.plannedToday.length}</strong><small>prazo ou plano</small></button>
      <button type="button" onClick={() => { setTab('pending'); setPendingFilter('finance') }}><span>Financeiro vencido</span><strong>{money(metrics.financeOverdue)}</strong><small>saldo em atraso</small></button>
    </section>

    <nav className="occ-tabs" aria-label="Áreas do centro de comando">
      {tabs.map(([id, label]) => <button type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}>{label}</button>)}
    </nav>

    {tab === 'today' ? <div className="occ-layout">
      <section className="occ-panel occ-main-panel">
        <header className="occ-panel-head"><div><span>Ordem sugerida</span><h2>O que fazer agora</h2><p>Prioridade calculada por atraso, prazo, criticidade e prioridade cadastrada.</p></div><button type="button" onClick={() => { setTab('pending'); setPendingFilter('all') }}>Ver tudo</button></header>
        <div className="occ-work-list">{myDay.top.length ? myDay.top.map(item => <WorkCard key={item.key} item={item} day={day} onOpen={onOpenItem} onPlanTomorrow={planTomorrow} onClearPlan={clearPlan} />) : <Empty title="Nada urgente" text="Você pode usar o tempo para antecipar os próximos prazos." />}</div>
      </section>
      <aside className="occ-side-stack">
        <section className="occ-panel"><header className="occ-mini-head"><h3>Diagnóstico rápido</h3><span>Agora</span></header><div className="occ-diagnostic">
          <div><strong>{metrics.openWork}</strong><span>itens operacionais abertos</span></div>
          <div><strong>{metrics.waitingClient}</strong><span>aguardando cliente</span></div>
          <div><strong>{metrics.clientsAtRisk}</strong><span>clientes com 2+ críticos</span></div>
          <div><strong>{metrics.pendingOnTimePercent}%</strong><span>pendências ainda no prazo</span></div>
        </div></section>
        <section className="occ-panel"><header className="occ-mini-head"><h3>Próximos movimentos</h3><button type="button" onClick={() => setTab('week')}>Semana</button></header><div className="occ-next-list">{week.days.flatMap(row => row.items.map(item => ({ ...item, planDate: row.date }))).filter(item => item.planDate >= day).slice(0, 5).map(item => <button type="button" onClick={() => onOpenItem(item)} key={`next-${item.key}-${item.planDate}`}><span>{dateLabel(item.planDate)}</span><strong>{item.title}</strong><small>{item.client}</small></button>)}</div></section>
      </aside>
    </div> : null}

    {tab === 'pending' ? <section className="occ-panel">
      <header className="occ-panel-head"><div><span>Central de pendências</span><h2>O que precisa da sua atenção</h2><p>Operação, financeiro e parceiros no mesmo lugar.</p></div><b>{filteredPending.length} item(ns)</b></header>
      <div className="occ-filter-row">
        {[['critical', 'Críticos'], ['attention', 'Atenção'], ['finance', 'Financeiro'], ['waiting', 'Aguardando cliente'], ['all', 'Todos']].map(([id, label]) => <button type="button" className={pendingFilter === id ? 'active' : ''} onClick={() => setPendingFilter(id)} key={id}>{label}</button>)}
      </div>
      <div className="occ-work-list">{filteredPending.length ? filteredPending.map(item => <WorkCard key={item.key} item={item} day={day} onOpen={onOpenItem} onPlanTomorrow={planTomorrow} onClearPlan={clearPlan} />) : <Empty title="Sem itens neste filtro" text="Nenhuma pendência corresponde ao critério selecionado." />}</div>
    </section> : null}

    {tab === 'week' ? <section className="occ-panel">
      <header className="occ-panel-head"><div><span>Planejamento semanal</span><h2>{dateLabel(week.start)} — {dateLabel(week.end)}</h2><p>O planejamento respeita o prazo oficial. Tarefas replanejadas aparecem no dia planejado sem alterar o vencimento.</p></div><button type="button" onClick={() => onNavigate('calendario')}>Abrir calendário</button></header>
      {week.overdue.length ? <div className="occ-week-alert"><strong>{week.overdue.length} item(ns) vencido(s) estão fora da semana.</strong><button type="button" onClick={() => { setTab('pending'); setPendingFilter('critical') }}>Revisar atrasos</button></div> : null}
      <div className="occ-week-grid">{week.days.map(row => { const weekday = weekdays[new Date(`${row.date}T12:00:00`).getDay()]; return <section className={`occ-day ${row.date === day ? 'today' : ''}`} key={row.date}><header><div><span>{weekday}</span><strong>{dateLabel(row.date).slice(0, 5)}</strong></div><b>{row.items.length}</b></header><div>{row.items.length ? row.items.slice(0, 8).map(item => <button type="button" className={`level-${item.level}`} onClick={() => onOpenItem(item)} key={`${row.date}-${item.key}`}><strong>{item.title}</strong><small>{item.client}</small>{item.planned && item.planned !== item.due ? <em>Replanejada</em> : null}</button>) : <small className="occ-day-empty">Sem item planejado</small>}</div></section> })}</div>
      {week.unscheduled.length ? <div className="occ-unscheduled"><strong>{week.unscheduled.length} item(ns) sem prazo/planejamento.</strong><span>Eles permanecem visíveis na Central de Pendências, mas não são colocados artificialmente em um dia.</span></div> : null}
    </section> : null}

    {tab === 'metrics' ? <div className="occ-metrics-layout">
      <section className="occ-panel"><header className="occ-panel-head"><div><span>Operação</span><h2>Saúde do escritório</h2><p>Indicadores derivados dos registros existentes, sem estimativas ocultas.</p></div></header><div className="occ-metric-grid">
        <div><span>Pendências abertas</span><strong>{metrics.openWork}</strong><small>{metrics.overdueWork} atrasada(s)</small></div>
        <div><span>Concluídos 30 dias</span><strong>{metrics.completed30}</strong><small>histórico registrado</small></div>
        <div><span>Pendências no prazo</span><strong>{metrics.pendingOnTimePercent}%</strong><small>das que têm prazo</small></div>
        <div><span>Clientes em risco</span><strong>{metrics.clientsAtRisk}</strong><small>com 2+ itens críticos</small></div>
      </div></section>
      <section className="occ-panel"><header className="occ-panel-head"><div><span>Financeiro</span><h2>Honorários</h2><p>Visão operacional de recebimentos e atrasos.</p></div><button type="button" onClick={() => onNavigate('honorarios')}>Financeiro</button></header><div className="occ-metric-grid finance">
        <div><span>Faturado no mês</span><strong>{money(metrics.billedMonth)}</strong></div>
        <div><span>Recebido no mês</span><strong>{money(metrics.receivedMonth)}</strong></div>
        <div><span>Total em aberto</span><strong>{money(metrics.financeOpen)}</strong></div>
        <div className={metrics.financeOverdue ? 'danger' : ''}><span>Vencido</span><strong>{money(metrics.financeOverdue)}</strong></div>
      </div></section>
      <section className="occ-panel occ-full"><header className="occ-panel-head"><div><span>Fechamento</span><h2>Últimas entregas registradas</h2><p>Usa o histórico de conclusão já mantido pelo sistema.</p></div></header><div className="occ-history-strip">{(office.history || []).slice(0, 12).map(entry => <article key={entry.id}><span>{String(entry.completedAt || '').slice(0, 10) ? dateLabel(String(entry.completedAt).slice(0, 10)) : '—'}</span><strong>{entry.title}</strong><small>{entry.client || 'Escritório'} · {entry.responsible || 'Responsável não informado'}</small></article>)}</div></section>
    </div> : null}

    {tab === 'ask' ? <div className="occ-ask-layout">
      <section className="occ-panel">
        <header className="occ-panel-head"><div><span>Consulta operacional</span><h2>Pergunte ao seu escritório</h2><p>Busca determinística nos seus dados; não inventa informação e não depende de IA paga.</p></div></header>
        <form className="occ-query" onSubmit={submitQuery}><Icon name="search" size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex.: quem não pagou? o que vence essa semana?" /><button type="submit">Consultar</button></form>
        <div className="occ-query-chips">{['O que preciso fazer hoje?', 'O que vence essa semana?', 'Quais pendências estão atrasadas?', 'Quem não pagou?', 'Quais processos estão pendentes?'].map(value => <button type="button" onClick={() => quickQuery(value)} key={value}>{value}</button>)}</div>
        {queryResult ? <div className="occ-query-result"><header><strong>{queryResult.title}</strong><small>{queryResult.subtitle}</small></header><div className="occ-work-list">{queryResult.items.length ? queryResult.items.map(item => <WorkCard compact key={`query-${item.key}`} item={item} day={day} onOpen={onOpenItem} onPlanTomorrow={planTomorrow} onClearPlan={clearPlan} />) : <Empty title="Sem resultado" text={queryResult.subtitle} />}</div></div> : null}
      </section>
      <section className="occ-panel">
        <header className="occ-panel-head"><div><span>Linha do tempo</span><h2>Histórico por cliente</h2><p>Tarefas, processos, obrigações, cobranças e recebimentos em uma sequência única.</p></div></header>
        <label className="occ-client-select"><span>Cliente</span><select value={clientId} onChange={event => setClientId(event.target.value)}><option value="">Selecione um cliente</option>{clients.map(client => <option value={client.id} key={client.id}>{clientName(client)}</option>)}</select></label>
        {clientId ? <div className="occ-timeline">{timeline.length ? timeline.map(event => <article key={event.key}><time>{dateLabel(event.date)}</time><span className={`type-${event.type}`}></span><div><strong>{event.title}</strong><small>{event.detail}</small></div></article>) : <Empty title="Sem eventos datados" text="Não há registros com data suficiente para compor a linha do tempo deste cliente." />}</div> : <Empty title="Escolha um cliente" text="A linha do tempo será montada somente com fatos registrados no sistema." />}
      </section>
    </div> : null}
  </div>
}
