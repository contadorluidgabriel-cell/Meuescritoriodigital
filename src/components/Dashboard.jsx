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
    <div className="mgmt-metric-icon"><Icon name={icon} size={20} /></div>
    <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
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
    {rows.map(row => <div className="mgmt-trend-column" key={row.month}>
      <div className="mgmt-trend-bars"><i className="billed" style={{ height: `${Math.max(3, row.billed * 100 / max)}%` }} title={`Faturado ${money(row.billed)}`} /><i className="received" style={{ height: `${Math.max(3, row.received * 100 / max)}%` }} title={`Recebido ${money(row.received)}`} /></div>
      <span>{monthLabel(row.month)}</span>
    </div>)}
  </div>
}

function CompletionTrend({ rows }) {
  const max = Math.max(1, ...rows.map(row => row.completed))
  return <div className="mgmt-completion-chart" aria-label="Conclusões registradas nos últimos seis meses">
    {rows.map(row => <div key={row.month}><b style={{ width: `${Math.max(4, row.completed * 100 / max)}%` }} /><span>{monthLabel(row.month)}</span><strong>{row.completed}</strong></div>)}
  </div>
}

function AttentionClient({ client, onNavigate }) {
  const bits = []
  if (client.overdue) bits.push(`${client.overdue} atraso(s)`)
  if (client.waiting) bits.push(`${client.waiting} aguardando retorno`)
  if (client.critical) bits.push(`${client.critical} crítico(s)`)
  if (client.financeOverdue) bits.push(`${money(client.financeOverdue)} vencido`)
  return <button type="button" className="mgmt-client-attention" onClick={() => onNavigate?.('clientes')}>
    <div><strong>{client.name}</strong><small>{bits.join(' · ') || `${client.open} item(ns) em aberto`}</small></div>
    <span>Abrir cliente</span>
  </button>
}

export default function Dashboard({ office, sync, onNavigate }) {
  const day = today()
  const data = useMemo(() => buildManagementDashboard(office, { day }), [office, day])
  const { portfolio, operation, finance, clientsAttention, alerts, completionTrend } = data
  const maxRegime = Math.max(1, ...portfolio.regimes.map(row => row.value))

  return <div className="mgmt-dashboard">
    <header className="mgmt-hero">
      <div><span>Gestão do escritório</span><h1>Painel do Escritório</h1><p>Saúde financeira, carteira e capacidade operacional em uma visão de decisão. A execução do trabalho continua concentrada no Meu Dia.</p></div>
      <div><span className="sync-indicator">{sync}</span><button type="button" onClick={() => onNavigate?.('meu-dia')}><Icon name="dashboard" size={17} /> Abrir Meu Dia</button></div>
    </header>

    <section className="mgmt-metrics" aria-label="Resumo executivo">
      <Metric label="Receita recorrente mensal" value={money(portfolio.monthlyFees)} detail={`ticket médio ${money(portfolio.averageTicket)}`} icon="finance" onClick={() => onNavigate?.('clientes')} />
      <Metric label="Taxa de recebimento" value={percent(finance.current.collectionRate)} detail={`${finance.receivingDelta > 0 ? '+' : ''}${finance.receivingDelta} p.p. vs. mês anterior`} tone={finance.receivingDelta < -5 ? 'danger' : finance.receivingDelta < 0 ? 'warning' : 'ok'} icon="finance" onClick={() => onNavigate?.('honorarios')} />
      <Metric label="Operação atrasada" value={operation.overdueWork} detail={`${percent(operation.workOnTimePercent)} do trabalho com prazo está em dia`} tone={operation.overdueWork ? 'warning' : 'ok'} icon="clock" onClick={() => onNavigate?.('meu-dia')} />
      <Metric label="Clientes em atenção" value={clientsAttention.length} detail={`${operation.criticalWork} item(ns) crítico(s) no escritório`} tone={clientsAttention.length ? 'warning' : 'ok'} icon="clients" onClick={() => onNavigate?.('clientes')} />
    </section>

    <Section eyebrow="Decisão" title="O que merece sua atenção" className="mgmt-attention-panel">
      <div className="mgmt-alert-grid">{alerts.map((alert, index) => <button type="button" className={`mgmt-alert ${alert.tone}`} key={`${alert.title}-${index}`} onClick={() => alert.target !== 'dashboard' && onNavigate?.(alert.target)}>
        <i />
        <div><strong>{alert.title}</strong><small>{alert.detail}{alert.amount ? ` · ${money(alert.amount)}` : ''}</small></div>
        {alert.target !== 'dashboard' ? <span>Ver</span> : null}
      </button>)}</div>
    </Section>

    <div className="mgmt-grid two mgmt-decision-grid">
      <Section eyebrow="Carteira" title="Clientes que precisam de atenção" action={<button type="button" onClick={() => onNavigate?.('clientes')}>Ver clientes</button>}>
        <div className="mgmt-client-attention-list">
          {clientsAttention.length ? clientsAttention.map(client => <AttentionClient key={client.id} client={client} onNavigate={onNavigate} />) : <p className="mgmt-empty">Nenhum cliente concentra atraso, criticidade ou cobrança vencida no momento.</p>}
        </div>
      </Section>

      <Section eyebrow="Financeiro" title="Visão gerencial" action={<button type="button" onClick={() => onNavigate?.('honorarios')}>Abrir financeiro</button>}>
        <div className="mgmt-finance-grid mgmt-finance-grid-v2">
          <article><span>A receber</span><strong>{money(finance.receivableOpen)}</strong><small>{money(finance.receivableOverdue)} vencido</small></article>
          <article><span>A pagar</span><strong>{money(finance.payableOpen)}</strong><small>{money(finance.payableOverdue)} vencido</small></article>
          <article className={finance.cashResult < 0 ? 'danger' : ''}><span>Resultado de caixa</span><strong>{money(finance.cashResult)}</strong><small>recebido menos pago no mês</small></article>
          <article><span>Resultado da competência</span><strong>{money(finance.competenceResult)}</strong><small>faturado menos despesas lançadas</small></article>
        </div>
        <div className="mgmt-aging">
          <header><strong>Inadimplência por idade</strong><span>{percent(finance.overdueRatio)} do saldo aberto já venceu</span></header>
          <div><article><span>Até 7 dias</span><strong>{money(finance.aging.upTo7)}</strong></article><article><span>8–30 dias</span><strong>{money(finance.aging.from8To30)}</strong></article><article><span>31–60 dias</span><strong>{money(finance.aging.from31To60)}</strong></article><article className={finance.aging.over60 ? 'danger' : ''}><span>60+ dias</span><strong>{money(finance.aging.over60)}</strong></article></div>
        </div>
      </Section>
    </div>

    <div className="mgmt-grid two">
      <Section eyebrow="Operação" title="Saúde por departamento" action={<button type="button" onClick={() => onNavigate?.('meu-dia')}>Meu Dia</button>}>
        <div className="mgmt-department-health">
          {operation.departments.length ? operation.departments.map(row => <button type="button" key={row.label} onClick={() => onNavigate?.('meu-dia')}>
            <div><strong>{row.label}</strong><small>{row.open} aberto(s) · {row.critical} crítico(s) · {row.waiting} aguardando</small></div>
            <div className="mgmt-department-score"><b className={row.onTimePercent < 80 ? 'warning' : 'ok'}>{percent(row.onTimePercent)}</b><span>{row.overdue} atraso(s)</span></div>
          </button>) : <p className="mgmt-empty">Nenhum trabalho aberto no momento.</p>}
        </div>
      </Section>

      <Section eyebrow="Carteira" title="Qualidade da receita" action={<button type="button" onClick={() => onNavigate?.('clientes')}>Clientes</button>}>
        <div className="mgmt-portfolio-summary"><div><strong>{portfolio.recurring.length}</strong><span>recorrentes</span></div><div><strong>{money(portfolio.averageTicket)}</strong><span>ticket médio</span></div><div><strong>{percent(portfolio.concentration)}</strong><span>maior cliente / MRR</span></div><div><strong>{portfolio.avulsos.length}</strong><span>avulsos ativos</span></div></div>
        <div className="mgmt-bars">{portfolio.regimes.length ? portfolio.regimes.map(row => <BarRow key={row.label} label={row.label} value={row.value} max={maxRegime} />) : <p className="mgmt-empty">Nenhum cliente recorrente ativo cadastrado.</p>}</div>
        <p className="mgmt-note">A concentração usa o maior honorário mensal cadastrado sobre o total recorrente da carteira.</p>
      </Section>
    </div>

    <div className="mgmt-grid two mgmt-trends-grid">
      <Section eyebrow="Tendência" title="Faturado × recebido — 6 meses">
        <div className="mgmt-trend-legend"><span><i className="billed" /> Faturado</span><span><i className="received" /> Recebido</span></div>
        <FinanceTrend rows={finance.trend} />
      </Section>
      <Section eyebrow="Tendência" title="Conclusões registradas — 6 meses">
        <CompletionTrend rows={completionTrend} />
        <p className="mgmt-note">Usa o histórico de conclusões registrado pelo MED; não mede horas trabalhadas.</p>
      </Section>
    </div>
  </div>
}
