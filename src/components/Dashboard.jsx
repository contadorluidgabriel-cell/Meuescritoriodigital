import { useMemo } from 'react'
import { buildOperationalMetrics, collectOperationalWork } from '../lib/operationalIntelligence.js'
import { isDone, today } from '../lib/storage.js'
import { normalizeText } from '../lib/textUtils.js'
import { Icon } from './ui/SaasUI.jsx'
import '../management-dashboard.css'

// MED_MANAGEMENT_DASHBOARD
// Compatibility marker for the V12 build patch: completeTask } from '../lib/taskExecution.js'

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const percent = value => `${Math.max(0, Math.min(100, Number(value) || 0))}%`

function Metric({ label, value, detail, tone = '', icon }) {
  return <article className={`mgmt-metric ${tone}`}>
    <div className="mgmt-metric-icon"><Icon name={icon} size={20} /></div>
    <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
  </article>
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

export default function Dashboard({ office, sync, onNavigate }) {
  const day = today()
  const metrics = useMemo(() => buildOperationalMetrics(office, { day }), [office, day])
  const work = useMemo(() => collectOperationalWork(office, { day }), [office, day])

  const portfolio = useMemo(() => {
    const clients = office.clients || []
    const active = clients.filter(client => client.status !== 'Inativo')
    const recurring = active.filter(client => client.relacionamento !== 'Avulso')
    const avulsos = active.filter(client => client.relacionamento === 'Avulso')
    const inactive = clients.filter(client => client.status === 'Inativo')
    const monthlyFees = recurring.reduce((sum, client) => sum + Number(client.mensalidade || 0), 0)
    const regimeMap = new Map()
    recurring.forEach(client => {
      const key = client.tributacao || 'Não informado'
      regimeMap.set(key, (regimeMap.get(key) || 0) + 1)
    })
    const regimes = [...regimeMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'pt-BR'))
    return {
      recurring,
      avulsos,
      inactive,
      linked: (office.linkedCompanies || []).filter(company => company.status !== 'Inativo'),
      monthlyFees,
      regimes,
    }
  }, [office.clients, office.linkedCompanies])

  const departmentLoad = useMemo(() => {
    const counts = new Map()
    const add = (name, amount = 1) => counts.set(name || 'Geral', (counts.get(name || 'Geral') || 0) + amount)

    ;(office.tasks || []).forEach(task => { if (!isDone(task.status)) add(task.departamento || 'Geral') })
    ;(office.processes || []).forEach(process => { if (!isDone(process.status)) add(process.departamento || 'Societário') })
    ;(office.obligations || []).forEach(obligation => {
      const openLinks = (obligation.clientes || []).filter(link => !isDone(link.status) && normalizeText(link.status) !== 'nao se aplica').length
      if (openLinks) add(obligation.categoria || 'Outros', openLinks)
    })

    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'pt-BR')).slice(0, 8)
  }, [office.obligations, office.processes, office.tasks])

  const workTypes = useMemo(() => ({
    tasks: work.filter(item => item.type === 'task').length,
    processes: work.filter(item => item.type === 'process').length,
    obligations: work.filter(item => item.type === 'obligation').length,
  }), [work])

  const maxDepartment = Math.max(1, ...departmentLoad.map(row => row.value))
  const maxRegime = Math.max(1, ...portfolio.regimes.map(row => row.value))

  return <div className="mgmt-dashboard">
    <header className="mgmt-hero">
      <div><span>Gestão do escritório</span><h1>Painel do Escritório</h1><p>Uma visão gerencial da carteira, operação e financeiro. Para executar o trabalho do dia, use o Meu Dia.</p></div>
      <div><span className="sync-indicator">{sync}</span><button type="button" onClick={() => onNavigate?.('meu-dia')}><Icon name="dashboard" size={17} /> Abrir Meu Dia</button></div>
    </header>

    <section className="mgmt-metrics" aria-label="Resumo gerencial">
      <Metric label="Clientes recorrentes" value={portfolio.recurring.length} detail={`${portfolio.avulsos.length} avulso(s) ativo(s)`} icon="clients" />
      <Metric label="Honorários contratados" value={money(portfolio.monthlyFees)} detail="mensalidades da carteira ativa" icon="finance" />
      <Metric label="Pendências no prazo" value={percent(metrics.pendingOnTimePercent)} detail={`${metrics.overdueWork} item(ns) atrasado(s)`} tone={metrics.overdueWork ? 'warning' : 'ok'} icon="clock" />
      <Metric label="Financeiro vencido" value={money(metrics.financeOverdue)} detail={`${money(metrics.financeOpen)} em aberto`} tone={metrics.financeOverdue ? 'danger' : 'ok'} icon="warning" />
    </section>

    <div className="mgmt-grid two">
      <Section eyebrow="Operação" title="Saúde operacional" action={<button type="button" onClick={() => onNavigate?.('meu-dia')}>Meu Dia</button>}>
        <div className="mgmt-stat-grid">
          <article><span>Itens abertos</span><strong>{metrics.openWork}</strong><small>{workTypes.tasks} tarefas · {workTypes.processes} processos · {workTypes.obligations} obrigações</small></article>
          <article><span>Vencem hoje</span><strong>{metrics.dueToday}</strong><small>pedem revisão no expediente</small></article>
          <article><span>Aguardando cliente</span><strong>{metrics.waitingClient}</strong><small>dependem de retorno externo</small></article>
          <article><span>Clientes em risco</span><strong>{metrics.clientsAtRisk}</strong><small>com 2+ itens críticos</small></article>
          <article><span>Concluídos em 30 dias</span><strong>{metrics.completed30}</strong><small>histórico registrado</small></article>
          <article><span>No prazo</span><strong>{percent(metrics.pendingOnTimePercent)}</strong><small>entre itens com vencimento</small></article>
        </div>
      </Section>

      <Section eyebrow="Financeiro" title="Honorários e recebimentos" action={<button type="button" onClick={() => onNavigate?.('honorarios')}>Abrir financeiro</button>}>
        <div className="mgmt-finance-grid">
          <article><span>Faturado no mês</span><strong>{money(metrics.billedMonth)}</strong></article>
          <article><span>Recebido no mês</span><strong>{money(metrics.receivedMonth)}</strong></article>
          <article><span>Total em aberto</span><strong>{money(metrics.financeOpen)}</strong></article>
          <article className={metrics.financeOverdue ? 'danger' : ''}><span>Vencido</span><strong>{money(metrics.financeOverdue)}</strong></article>
        </div>
        <p className="mgmt-note">O painel resume o financeiro. Cobranças, baixas e edição continuam concentradas no módulo Financeiro.</p>
      </Section>
    </div>

    <div className="mgmt-grid two">
      <Section eyebrow="Carteira" title="Composição dos clientes" action={<button type="button" onClick={() => onNavigate?.('clientes')}>Clientes</button>}>
        <div className="mgmt-portfolio-summary"><div><strong>{portfolio.recurring.length}</strong><span>recorrentes</span></div><div><strong>{portfolio.avulsos.length}</strong><span>avulsos</span></div><div><strong>{portfolio.linked.length}</strong><span>CNPJs vinculados</span></div><div><strong>{portfolio.inactive.length}</strong><span>inativos</span></div></div>
        <div className="mgmt-bars">{portfolio.regimes.length ? portfolio.regimes.map(row => <BarRow key={row.label} label={row.label} value={row.value} max={maxRegime} />) : <p className="mgmt-empty">Nenhum cliente recorrente ativo cadastrado.</p>}</div>
      </Section>

      <Section eyebrow="Capacidade" title="Carga por departamento">
        <div className="mgmt-bars">{departmentLoad.length ? departmentLoad.map(row => <BarRow key={row.label} label={row.label} value={row.value} max={maxDepartment} />) : <p className="mgmt-empty">Nenhum trabalho aberto no momento.</p>}</div>
        <p className="mgmt-note">A carga considera tarefas, processos e vínculos de obrigações ainda abertos.</p>
      </Section>
    </div>
  </div>
}
