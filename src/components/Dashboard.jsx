import { useMemo } from 'react'
import { buildManagementDashboard } from '../lib/managementDashboard.js'
import { today } from '../lib/storage.js'
import { Icon } from './ui/SaasUI.jsx'
import '../management-dashboard.css'

// MED_MANAGEMENT_DASHBOARD
// Compatibility marker for the V12 build patch: completeTask } from '../lib/taskExecution.js'

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const percent = value => `${Math.max(0, Math.min(100, Math.round(Number(value) || 0)))}%`

function Metric({ label, value, detail, tone = '', icon, onClick }) {
  const body = <>
    <div className="mgmt-metric-head"><span>{label}</span><div className="mgmt-metric-icon"><Icon name={icon} size={17} /></div></div>
    <strong>{value}</strong>
    <small>{detail}</small>
  </>
  if (onClick) return <button type="button" className={`mgmt-metric clickable ${tone}`} onClick={onClick}>{body}</button>
  return <article className={`mgmt-metric ${tone}`}>{body}</article>
}

function Section({ eyebrow, title, action, children, className = '' }) {
  return <section className={`mgmt-panel ${className}`}>
    <header><div><span>{eyebrow}</span><h2>{title}</h2></div>{action}</header>
    {children}
  </section>
}

function BarRow({ label, value, max, suffix = '' }) {
  const width = max ? Math.max(3, Math.round((Number(value) || 0) * 100 / max)) : 0
  return <div className="mgmt-bar-row"><div><strong>{label}</strong><span>{value}{suffix}</span></div><i><b style={{ width: `${width}%` }} /></i></div>
}

function monthLabel(value) {
  const [year, month] = String(value || '').split('-').map(Number)
  if (!year || !month) return value
  return new Date(year, month - 1, 1, 12).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
}

function FinanceTrend({ rows }) {
  const max = Math.max(1, ...rows.flatMap(row => [row.billed, row.received]))
  return <div className="mgmt-trend-chart" aria-label="Faturado e recebido nos últimos seis meses">
    {rows.map((row, index) => <div className={`mgmt-trend-column ${index === rows.length - 1 ? 'current' : ''}`} key={row.month}>
      <div className="mgmt-trend-bars"><i className="billed" style={{ height: `${Math.max(3, row.billed * 100 / max)}%` }} title={`Faturado ${money(row.billed)}`} /><i className="received" style={{ height: `${Math.max(3, row.received * 100 / max)}%` }} title={`Recebido ${money(row.received)}`} /></div>
      <span>{monthLabel(row.month)}</span>
    </div>)}
  </div>
}

function CompletionTrend({ rows }) {
  const max = Math.max(1, ...rows.map(row => row.completed))
  return <div className="mgmt-completion-chart" aria-label="Conclusões registradas nos últimos seis meses">
    {rows.map((row, index) => <div className={index === rows.length - 1 ? 'current' : ''} key={row.month}><b style={{ width: `${Math.max(4, row.completed * 100 / max)}%` }} /><span>{monthLabel(row.month)}</span><strong>{row.completed}</strong></div>)}
  </div>
}

function AttentionClient({ client, onNavigate }) {
  const bits = []
  if (client.overdue) bits.push(`${client.overdue} atraso(s)`)
  if (client.waiting) bits.push(`${client.waiting} aguardando retorno`)
  if (client.critical) bits.push(`${client.critical} crítico(s)`)
  if (client.financeOverdue) bits.push(`${money(client.financeOverdue)} vencido`)
  const severity = client.critical || client.overdue >= 2 ? 'critical' : client.financeOverdue ? 'finance' : 'attention'
  return <button type="button" className={`mgmt-client-attention ${severity}`} onClick={() => onNavigate?.('clientes')}>
    <i aria-hidden="true" />
    <div><strong>{client.name}</strong><small>{bits.join(' · ') || `${client.open} item(ns) em aberto`}</small></div>
    <span aria-hidden="true">›</span>
  </button>
}

function FinanceAging({ finance }) {
  const total = finance.aging.upTo7 + finance.aging.from8To30 + finance.aging.from31To60 + finance.aging.over60
  const width = value => total > 0 ? Math.max(value > 0 ? 3 : 0, value * 100 / total) : 0
  return <div className="mgmt-aging">
    <header><div><strong>Inadimplência por idade</strong><small>Quanto mais antigo, maior a prioridade de cobrança.</small></div><span>{percent(finance.overdueRatio)} do saldo aberto vencido</span></header>
    <div className="mgmt-aging-track" aria-label="Distribuição da inadimplência por idade">
      <i className="fresh" style={{ width: `${width(finance.aging.upTo7)}%` }} title={`Até 7 dias: ${money(finance.aging.upTo7)}`} />
      <i className="attention" style={{ width: `${width(finance.aging.from8To30)}%` }} title={`8 a 30 dias: ${money(finance.aging.from8To30)}`} />
      <i className="warning" style={{ width: `${width(finance.aging.from31To60)}%` }} title={`31 a 60 dias: ${money(finance.aging.from31To60)}`} />
      <i className="danger" style={{ width: `${width(finance.aging.over60)}%` }} title={`Mais de 60 dias: ${money(finance.aging.over60)}`} />
    </div>
    <div className="mgmt-aging-legend">
      <div><i className="fresh" /><span>Até 7 dias</span><strong>{money(finance.aging.upTo7)}</strong></div>
      <div><i className="attention" /><span>8–30 dias</span><strong>{money(finance.aging.from8To30)}</strong></div>
      <div><i className="warning" /><span>31–60 dias</span><strong>{money(finance.aging.from31To60)}</strong></div>
      <div><i className="danger" /><span>60+ dias</span><strong>{money(finance.aging.over60)}</strong></div>
    </div>
  </div>
}

export default function Dashboard({ office, sync, onNavigate }) {
  const day = today()
  const data = useMemo(() => buildManagementDashboard(office, { day }), [office, day])
  const { portfolio, operation, finance, clientsAttention, alerts, completionTrend } = data
  const maxRegime = Math.max(1, ...portfolio.regimes.map(row => row.value))

  return <div className="mgmt-dashboard">
    <header className="mgmt-hero">
      <div><span>Gestão do escritório</span><h1>Painel do Escritório</h1><p>Saúde, receita e capacidade operacional em uma visão para decisão.</p></div>
      <div><span className="sync-indicator">{sync}</span><button type="button" onClick={() => onNavigate?.('meu-dia')}><Icon name="dashboard" size={16} /> Abrir Meu Dia</button></div>
    </header>

    <section className="mgmt-metrics" aria-label="Resumo executivo">
      <Metric label="Receita recorrente" value={money(portfolio.monthlyFees)} detail={`${money(portfolio.averageTicket)} de ticket médio`} icon="finance" onClick={() => onNavigate?.('clientes')} />
      <Metric label="Taxa de recebimento" value={percent(finance.current.collectionRate)} detail={`${finance.receivingDelta > 0 ? '↑ ' : finance.receivingDelta < 0 ? '↓ ' : ''}${Math.abs(finance.receivingDelta)} pontos vs. mês anterior`} tone={finance.receivingDelta < -5 ? 'danger' : finance.receivingDelta < 0 ? 'warning' : 'ok'} icon="finance" onClick={() => onNavigate?.('honorarios')} />
      <Metric label="Operação atrasada" value={operation.overdueWork} detail={`${percent(operation.workOnTimePercent)} do trabalho com prazo está em dia`} tone={operation.overdueWork ? 'warning' : 'ok'} icon="clock" onClick={() => onNavigate?.('meu-dia')} />
      <Metric label="Clientes em atenção" value={clientsAttention.length} detail={`${operation.criticalWork} item(ns) crítico(s) no escritório`} tone={clientsAttention.length ? 'warning' : 'ok'} icon="clients" onClick={() => onNavigate?.('clientes')} />
    </section>

    <div className="mgmt-focus-grid">
      <Section eyebrow="Decisão" title="O que merece sua atenção" className="mgmt-attention-panel">
        <div className="mgmt-alert-list">{alerts.slice(0, 3).map((alert, index) => <button type="button" className={`mgmt-alert ${alert.tone}`} key={`${alert.title}-${index}`} onClick={() => alert.target !== 'dashboard' && onNavigate?.(alert.target)}>
          <i />
          <div><strong>{alert.title}</strong><small>{alert.detail}{alert.amount ? ` · ${money(alert.amount)}` : ''}</small></div>
          {alert.target !== 'dashboard' ? <span>Ver ›</span> : null}
        </button>)}</div>
      </Section>

      <Section eyebrow="Carteira" title="Clientes em atenção" action={<button type="button" onClick={() => onNavigate?.('clientes')}>Ver todos</button>} className="mgmt-clients-panel">
        <div className="mgmt-client-attention-list">
          {clientsAttention.length ? clientsAttention.slice(0, 5).map(client => <AttentionClient key={client.id} client={client} onNavigate={onNavigate} />) : <p className="mgmt-empty">Nenhum cliente exige atenção gerencial no momento.</p>}
        </div>
      </Section>
    </div>

    <div className="mgmt-grid two mgmt-core-grid">
      <Section eyebrow="Financeiro" title="Visão gerencial" action={<button type="button" onClick={() => onNavigate?.('honorarios')}>Abrir financeiro</button>} className="mgmt-finance-panel">
        <div className={`mgmt-finance-result ${finance.cashResult < 0 ? 'danger' : 'ok'}`}>
          <span>Resultado de caixa no mês</span>
          <strong>{money(finance.cashResult)}</strong>
          <small>Recebimentos menos pagamentos efetivamente registrados</small>
        </div>
        <div className="mgmt-finance-summary">
          <article><span>A receber</span><strong>{money(finance.receivableOpen)}</strong><small>{money(finance.receivableOverdue)} vencido</small></article>
          <article><span>A pagar</span><strong>{money(finance.payableOpen)}</strong><small>{money(finance.payableOverdue)} vencido</small></article>
          <article><span>Resultado da competência</span><strong>{money(finance.competenceResult)}</strong><small>faturado menos despesas lançadas</small></article>
        </div>
        <FinanceAging finance={finance} />
      </Section>

      <Section eyebrow="Operação" title="Saúde por departamento" action={<button type="button" onClick={() => onNavigate?.('meu-dia')}>Abrir Meu Dia</button>} className="mgmt-operation-panel">
        <div className="mgmt-department-health">
          {operation.departments.length ? operation.departments.map(row => <button type="button" key={row.label} onClick={() => onNavigate?.('meu-dia')}>
            <div className="mgmt-department-title"><strong>{row.label}</strong><span>{percent(row.onTimePercent)} no prazo</span></div>
            <div className="mgmt-health-track"><i className={row.onTimePercent < 80 ? 'warning' : 'ok'} style={{ width: `${row.onTimePercent}%` }} /></div>
            <small>{row.open} aberto(s) · {row.overdue} atraso(s){row.waiting ? ` · ${row.waiting} aguardando` : ''}{row.critical ? ` · ${row.critical} crítico(s)` : ''}</small>
          </button>) : <p className="mgmt-empty">Nenhum trabalho aberto no momento.</p>}
        </div>
      </Section>
    </div>

    <div className="mgmt-grid two mgmt-insight-grid">
      <Section eyebrow="Carteira" title="Qualidade da receita" action={<button type="button" onClick={() => onNavigate?.('clientes')}>Clientes</button>}>
        <div className="mgmt-portfolio-summary"><div><strong>{portfolio.recurring.length}</strong><span>recorrentes</span></div><div><strong>{money(portfolio.averageTicket)}</strong><span>ticket médio</span></div><div><strong>{percent(portfolio.concentration)}</strong><span>maior cliente / receita recorrente</span></div><div><strong>{portfolio.avulsos.length}</strong><span>avulsos ativos</span></div></div>
        <div className="mgmt-bars">{portfolio.regimes.length ? portfolio.regimes.map(row => <BarRow key={row.label} label={row.label} value={row.value} max={maxRegime} />) : <p className="mgmt-empty">Nenhum cliente recorrente ativo cadastrado.</p>}</div>
        <p className="mgmt-note">A concentração usa o maior honorário mensal cadastrado sobre a receita recorrente total.</p>
      </Section>

      <Section eyebrow="Tendência" title="Faturado × recebido — 6 meses" className="mgmt-finance-trend-panel">
        <div className="mgmt-trend-legend"><span><i className="billed" /> Faturado</span><span><i className="received" /> Recebido</span></div>
        <FinanceTrend rows={finance.trend} />
      </Section>
    </div>

    <Section eyebrow="Produtividade" title="Conclusões registradas — 6 meses" className="mgmt-completion-panel">
      <CompletionTrend rows={completionTrend} />
      <p className="mgmt-note">Usa o histórico de conclusões registrado pelo MED. Não representa horas trabalhadas.</p>
    </Section>
  </div>
}
