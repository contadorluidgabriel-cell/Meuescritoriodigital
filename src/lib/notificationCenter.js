import { collectCalendarEvents } from './calendarEvents.js'
import { payableSummary } from './financeComplete.js'
import { paymentSummary } from './financePro.js'
import { partnerShares, sharedReceiver, sharedSplit, SETTLEMENT_DONE } from './sharedWork.js'
import { today } from './storage.js'

const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const partnerName = partner => partner?.nome || partner?.razao || partner?.fantasia || 'Parceiro'
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const levelWeight = { critical: 0, attention: 1, info: 2 }

export function daysBetween(baseDate, targetDate) {
  const parse = value => {
    const [year, month, day] = String(value || '').split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
  }
  const base = parse(baseDate)
  const target = parse(targetDate)
  if (!base || !target) return null
  return Math.round((target.getTime() - base.getTime()) / 86400000)
}

export function deadlineCopy(days) {
  if (days < 0) return `${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'} em atraso`
  if (days === 0) return 'Vence hoje'
  if (days === 1) return 'Vence amanhã'
  return `Vence em ${days} dias`
}

function deadlineLevel(days) {
  if (days < 0) return 'critical'
  if (days === 0) return 'attention'
  return 'info'
}

function operationTitle(event) {
  return String(event.label || '').replace(/^(Tarefa|Processo|Obrigação) · /, '')
}

function operationKind(type) {
  if (type === 'task') return 'Tarefa'
  if (type === 'process') return 'Processo'
  return 'Obrigação'
}

function collectOperationNotifications(office, day, daysBefore) {
  return collectCalendarEvents(office)
    .filter(event => !event.done)
    .map(event => ({ ...event, days: daysBetween(day, event.date) }))
    .filter(event => event.days !== null && event.days <= daysBefore)
    .map(event => ({
      key: `operation:${event.key}`,
      type: event.type,
      category: 'operation',
      kindLabel: operationKind(event.type),
      title: operationTitle(event),
      subtitle: `${event.client} · ${deadlineCopy(event.days)}`,
      clientId: event.clientId || '',
      id: event.id,
      date: event.date,
      days: event.days,
      level: deadlineLevel(event.days),
    }))
}

function collectFinanceNotifications(office, day, daysBefore) {
  const clients = new Map((office.clients || []).map(client => [String(client.id), client]))
  return (office.finance || []).flatMap(charge => {
    if (String(charge.status || '').toLowerCase() === 'cancelado' || !charge.vencimento) return []
    const summary = paymentSummary(charge)
    if (summary.balance <= 0.009) return []
    const days = daysBetween(day, charge.vencimento)
    if (days === null || days > daysBefore) return []
    const client = clients.get(String(charge.clienteId))
    const partial = summary.receivedCash > 0.009 || summary.discounts > 0.009
    return [{
      key: `finance:${charge.id}`,
      type: 'finance',
      category: 'finance',
      kindLabel: partial ? 'Pagamento parcial' : 'Financeiro',
      title: charge.descricao || 'Cobrança',
      subtitle: `${clientName(client)} · ${deadlineCopy(days)} · saldo ${money(summary.balance)}`,
      clientId: String(charge.clienteId || ''),
      id: String(charge.id || ''),
      date: charge.vencimento,
      days,
      level: deadlineLevel(days),
    }]
  })
}

function collectPayableNotifications(office, day, daysBefore) {
  return (office.financePayables || []).flatMap(payable => {
    if (String(payable.status || '').toLowerCase() === 'cancelado' || !payable.vencimento) return []
    const summary = payableSummary(payable)
    if (summary.balance <= 0.009) return []
    const days = daysBetween(day, payable.vencimento)
    if (days === null || days > daysBefore) return []
    const partial = summary.paidCash > 0.009 || summary.discounts > 0.009
    return [{
      key: `payable:${payable.id}`,
      type: 'payable',
      category: 'finance',
      kindLabel: partial ? 'Despesa parcial' : 'Conta a pagar',
      title: payable.descricao || 'Conta a pagar',
      subtitle: `${payable.fornecedor || 'Escritório'} · ${deadlineCopy(days)} · saldo ${money(summary.balance)}`,
      clientId: '',
      id: String(payable.id || ''),
      date: payable.vencimento,
      days,
      level: deadlineLevel(days),
    }]
  })
}

function collectPartnerNotifications(office, day) {
  const clients = new Map((office.clients || []).map(client => [String(client.id), client]))
  const partners = new Map((office.partners || []).map(partner => [String(partner.id), partner]))

  return (office.finance || []).flatMap(charge => {
    const client = clients.get(String(charge.clienteId)) || {}
    const summary = paymentSummary(charge)
    if (!charge.compartilhado || summary.total <= 0 || summary.balance > 0.009) return []
    if (charge.compartilhadoAcertoStatus === SETTLEMENT_DONE) return []

    const receiver = sharedReceiver(charge, client)
    if (receiver === 'CadaUm') return []
    const split = sharedSplit(charge, client)
    const shares = partnerShares(charge, client)
    const amount = receiver === 'Escritorio' ? split.partnerTotal : split.mine
    if (amount <= 0.009) return []

    let counterparty = 'parceiro'
    let direction = 'a repassar'
    if (receiver.startsWith('partner:')) {
      counterparty = partnerName(partners.get(receiver.slice(8)))
      direction = 'a receber'
    } else if (shares.length === 1) {
      counterparty = partnerName(partners.get(shares[0].parceiroId))
    } else if (shares.length > 1) {
      counterparty = `${shares.length} parceiros`
    }

    return [{
      key: `partner:${charge.id}`,
      type: 'partner',
      category: 'partner',
      kindLabel: 'Parceiro',
      title: `Acerto pendente · ${charge.descricao || 'Cobrança compartilhada'}`,
      subtitle: `${clientName(client)} · ${money(amount)} ${direction} · ${counterparty}`,
      clientId: String(charge.clienteId || ''),
      id: String(charge.id || ''),
      date: charge.recebidoEm || summary.lastPaymentDate || day,
      days: 0,
      level: 'attention',
    }]
  })
}

export function collectOfficeNotifications(office = {}, { daysBefore = 3, day = today() } = {}) {
  const safeDays = Math.max(0, Number(daysBefore) || 0)
  const items = [
    ...collectOperationNotifications(office, day, safeDays),
    ...collectFinanceNotifications(office, day, safeDays),
    ...collectPayableNotifications(office, day, safeDays),
    ...collectPartnerNotifications(office, day),
  ]

  return items.sort((a, b) => {
    const level = (levelWeight[a.level] ?? 9) - (levelWeight[b.level] ?? 9)
    if (level) return level
    const days = Number(a.days ?? 9999) - Number(b.days ?? 9999)
    if (days) return days
    return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR')
  })
}

export function summarizeNotifications(items = []) {
  return {
    critical: items.filter(item => item.level === 'critical').length,
    attention: items.filter(item => item.level === 'attention').length,
    info: items.filter(item => item.level === 'info').length,
    finance: items.filter(item => item.category === 'finance').length,
    operation: items.filter(item => item.category === 'operation').length,
    partner: items.filter(item => item.category === 'partner').length,
  }
}
