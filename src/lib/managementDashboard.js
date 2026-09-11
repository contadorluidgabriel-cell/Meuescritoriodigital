import { paymentSummary } from './financePro.js'
import { payableSummary } from './financeComplete.js'
import { collectOperationalWork } from './operationalIntelligence.js'
import { normalizeText } from './textUtils.js'

const DAY_MS = 86400000
const cancelled = value => normalizeText(value) === 'cancelado'
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'

function monthOffset(day, offset) {
  const [year, month] = String(day || '').split('-').map(Number)
  const date = new Date(year || new Date().getFullYear(), (month || 1) - 1 + offset, 1, 12)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function daysLate(day, due) {
  if (!day || !due || due >= day) return 0
  const base = new Date(`${due}T12:00:00`)
  const target = new Date(`${day}T12:00:00`)
  if (Number.isNaN(base.getTime()) || Number.isNaN(target.getTime())) return 0
  return Math.max(0, Math.round((target.getTime() - base.getTime()) / DAY_MS))
}

function financeMonth(office, month) {
  const billed = (office.finance || [])
    .filter(charge => !cancelled(charge.status) && String(charge.competencia || charge.vencimento || '').startsWith(month))
    .reduce((sum, charge) => sum + paymentSummary(charge).total, 0)
  const received = (office.finance || []).reduce((sum, charge) => sum + paymentSummary(charge).payments
    .filter(payment => String(payment.data || '').startsWith(month))
    .reduce((inner, payment) => inner + Number(payment.valorRecebido || 0), 0), 0)
  const expenses = (office.financePayables || [])
    .filter(payable => !cancelled(payable.status) && String(payable.competencia || payable.vencimento || '').startsWith(month))
    .reduce((sum, payable) => sum + payableSummary(payable).total, 0)
  const paid = (office.financePayables || []).reduce((sum, payable) => sum + payableSummary(payable).payments
    .filter(payment => String(payment.data || '').startsWith(month))
    .reduce((inner, payment) => inner + Number(payment.valorPago || 0), 0), 0)
  return { month, billed, received, expenses, paid, collectionRate: billed > 0 ? received * 100 / billed : received > 0 ? 100 : 0 }
}

function departmentFor(item, sources) {
  if (item.type === 'task') return sources.tasks.get(String(item.id))?.departamento || 'Geral'
  if (item.type === 'process') return sources.processes.get(String(item.id))?.departamento || 'Societário'
  if (item.type === 'obligation') return sources.obligations.get(String(item.id))?.categoria || 'Outros'
  return 'Geral'
}

export function buildManagementDashboard(office = {}, { day = '' } = {}) {
  const clients = office.clients || []
  const active = clients.filter(client => client.status !== 'Inativo')
  const recurring = active.filter(client => client.relacionamento !== 'Avulso')
  const avulsos = active.filter(client => client.relacionamento === 'Avulso')
  const inactive = clients.filter(client => client.status === 'Inativo')
  const linked = (office.linkedCompanies || []).filter(company => company.status !== 'Inativo')
  const monthlyFees = recurring.reduce((sum, client) => sum + Number(client.mensalidade || 0), 0)
  const averageTicket = recurring.length ? monthlyFees / recurring.length : 0
  const largestFee = recurring.reduce((max, client) => Math.max(max, Number(client.mensalidade || 0)), 0)
  const concentration = monthlyFees > 0 ? largestFee * 100 / monthlyFees : 0
  const regimeMap = new Map()
  recurring.forEach(client => {
    const key = client.tributacao || 'Não informado'
    regimeMap.set(key, (regimeMap.get(key) || 0) + 1)
  })
  const regimes = [...regimeMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'pt-BR'))

  const work = collectOperationalWork(office, { day })
  const sourceMaps = {
    tasks: new Map((office.tasks || []).map(item => [String(item.id), item])),
    processes: new Map((office.processes || []).map(item => [String(item.id), item])),
    obligations: new Map((office.obligations || []).map(item => [String(item.id), item])),
  }
  const departmentMap = new Map()
  work.forEach(item => {
    const label = departmentFor(item, sourceMaps)
    const row = departmentMap.get(label) || { label, open: 0, overdue: 0, waiting: 0, critical: 0, withDeadline: 0, onTime: 0 }
    row.open += 1
    if (item.due) {
      row.withDeadline += 1
      if (typeof item.days === 'number' && item.days < 0) row.overdue += 1
      else row.onTime += 1
    }
    if (item.level === 'critical') row.critical += 1
    if (normalizeText(item.status).includes('aguardando')) row.waiting += 1
    departmentMap.set(label, row)
  })
  const departments = [...departmentMap.values()].map(row => ({
    ...row,
    onTimePercent: row.withDeadline ? Math.round(row.onTime * 100 / row.withDeadline) : 100,
  })).sort((a, b) => b.overdue - a.overdue || b.critical - a.critical || b.open - a.open || a.label.localeCompare(b.label, 'pt-BR'))

  const openReceivables = (office.finance || []).filter(charge => !cancelled(charge.status) && paymentSummary(charge).balance > 0.009)
  const overdueReceivables = openReceivables.filter(charge => charge.vencimento && String(charge.vencimento) < day)
  const openPayables = (office.financePayables || []).filter(payable => !cancelled(payable.status) && payableSummary(payable).balance > 0.009)
  const overduePayables = openPayables.filter(payable => payable.vencimento && String(payable.vencimento) < day)
  const receivableOpen = openReceivables.reduce((sum, charge) => sum + paymentSummary(charge).balance, 0)
  const receivableOverdue = overdueReceivables.reduce((sum, charge) => sum + paymentSummary(charge).balance, 0)
  const payableOpen = openPayables.reduce((sum, payable) => sum + payableSummary(payable).balance, 0)
  const payableOverdue = overduePayables.reduce((sum, payable) => sum + payableSummary(payable).balance, 0)

  const aging = { upTo7: 0, from8To30: 0, from31To60: 0, over60: 0 }
  overdueReceivables.forEach(charge => {
    const amount = paymentSummary(charge).balance
    const late = daysLate(day, String(charge.vencimento || ''))
    if (late <= 7) aging.upTo7 += amount
    else if (late <= 30) aging.from8To30 += amount
    else if (late <= 60) aging.from31To60 += amount
    else aging.over60 += amount
  })

  const months = Array.from({ length: 6 }, (_, index) => monthOffset(day, index - 5))
  const financeTrend = months.map(month => financeMonth(office, month))
  const currentFinance = financeTrend.at(-1) || financeMonth(office, monthOffset(day, 0))
  const previousFinance = financeTrend.at(-2) || financeMonth(office, monthOffset(day, -1))
  const completionTrend = months.map(month => ({
    month,
    completed: (office.history || []).filter(entry => String(entry.completedAt || '').startsWith(month)).length,
  }))

  const clientById = new Map(clients.map(client => [String(client.id), client]))
  const attentionMap = new Map()
  work.forEach(item => {
    if (!item.clientId) return
    const id = String(item.clientId)
    const row = attentionMap.get(id) || { id, name: clientName(clientById.get(id)), overdue: 0, critical: 0, waiting: 0, financeOverdue: 0, open: 0 }
    row.open += 1
    if (typeof item.days === 'number' && item.days < 0) row.overdue += 1
    if (item.level === 'critical') row.critical += 1
    if (normalizeText(item.status).includes('aguardando')) row.waiting += 1
    attentionMap.set(id, row)
  })
  overdueReceivables.forEach(charge => {
    const id = String(charge.clienteId || '')
    if (!id) return
    const row = attentionMap.get(id) || { id, name: clientName(clientById.get(id)), overdue: 0, critical: 0, waiting: 0, financeOverdue: 0, open: 0 }
    row.financeOverdue += paymentSummary(charge).balance
    attentionMap.set(id, row)
  })
  const clientsAttention = [...attentionMap.values()]
    .map(row => ({ ...row, score: row.overdue * 6 + row.critical * 4 + row.waiting * 2 + (row.financeOverdue > 0 ? 3 : 0) }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || b.financeOverdue - a.financeOverdue || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, 5)

  const overdueWork = work.filter(item => typeof item.days === 'number' && item.days < 0).length
  const criticalWork = new Set(work.filter(item => item.level === 'critical').map(item => item.type === 'obligation' ? `obligation:${item.id}` : item.key)).size
  const withDeadline = work.filter(item => item.due)
  const onTimeWork = withDeadline.filter(item => !(typeof item.days === 'number' && item.days < 0)).length
  const workOnTimePercent = withDeadline.length ? Math.round(onTimeWork * 100 / withDeadline.length) : 100
  const receivingDelta = Math.round(currentFinance.collectionRate - previousFinance.collectionRate)
  const overdueRatio = receivableOpen > 0 ? Math.round(receivableOverdue * 100 / receivableOpen) : 0
  const oldDebt = aging.from31To60 + aging.over60
  const worstDepartment = departments.find(row => row.overdue > 0) || null

  const alerts = []
  if (worstDepartment) alerts.push({ tone: 'warning', title: `${worstDepartment.label} concentra ${worstDepartment.overdue} atraso(s)`, detail: `${worstDepartment.onTimePercent}% do trabalho com prazo está em dia.`, target: 'meu-dia' })
  if (receivingDelta <= -5) alerts.push({ tone: 'danger', title: `Taxa de recebimento caiu ${Math.abs(receivingDelta)} p.p.`, detail: 'Compare cobranças e atrasos antes do fechamento do mês.', target: 'honorarios' })
  if (oldDebt > 0) alerts.push({ tone: 'danger', title: 'Há recebíveis vencidos há mais de 30 dias', detail: 'Priorize a régua de cobrança dos valores mais antigos.', target: 'honorarios', amount: oldDebt })
  if (clientsAttention[0]) alerts.push({ tone: 'warning', title: `${clientsAttention[0].name} exige atenção`, detail: `${clientsAttention[0].overdue} atraso(s), ${clientsAttention[0].waiting} aguardando retorno e ${clientsAttention[0].critical} crítico(s).`, target: 'clientes' })
  if (!alerts.length) alerts.push({ tone: 'ok', title: 'Nenhum desvio relevante detectado', detail: 'Operação, carteira e recebimentos não apresentam alerta gerencial pelas regras atuais.', target: 'dashboard' })

  return {
    portfolio: { recurring, avulsos, inactive, linked, monthlyFees, averageTicket, concentration, regimes },
    operation: { work, overdueWork, criticalWork, workOnTimePercent, departments },
    finance: {
      receivableOpen, receivableOverdue, payableOpen, payableOverdue, aging,
      current: currentFinance, previous: previousFinance,
      cashResult: currentFinance.received - currentFinance.paid,
      competenceResult: currentFinance.billed - currentFinance.expenses,
      overdueRatio,
      receivingDelta,
      trend: financeTrend,
    },
    completionTrend,
    clientsAttention,
    alerts: alerts.slice(0, 4),
  }
}
