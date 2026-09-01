import { addMonths, buildInstallmentCharges, chargePayments, paymentSummary } from './financePro.js'

const toNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0
export const moneyValue = value => Math.round(Math.max(0, toNumber(value)) * 100) / 100
const cents = value => Math.round(moneyValue(value) * 100)
const fromCents = value => Math.round(value) / 100
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const dateOk = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
const monthOk = value => /^\d{4}-\d{2}$/.test(String(value || ''))

export const PAYABLE_STATUSES = ['Pendente', 'Parcial', 'Pago', 'Atrasado', 'Cancelado']
export const MOVEMENT_TYPES = ['entrada', 'saida', 'transferencia']

export const DEFAULT_FINANCE_CATEGORIES = [
  { id: 'rec-honorarios', nome: 'Honorários contábeis', tipo: 'receita', grupo: 'Receita operacional', ativo: true },
  { id: 'rec-servicos', nome: 'Serviços avulsos', tipo: 'receita', grupo: 'Receita operacional', ativo: true },
  { id: 'rec-outras', nome: 'Outras receitas', tipo: 'receita', grupo: 'Outras receitas', ativo: true },
  { id: 'desp-sistemas', nome: 'Sistemas e assinaturas', tipo: 'despesa', grupo: 'Despesas operacionais', ativo: true },
  { id: 'desp-marketing', nome: 'Marketing', tipo: 'despesa', grupo: 'Despesas operacionais', ativo: true },
  { id: 'desp-pessoal', nome: 'Pessoal e prestadores', tipo: 'despesa', grupo: 'Pessoal', ativo: true },
  { id: 'desp-prolabore', nome: 'Pró-labore', tipo: 'despesa', grupo: 'Pessoal', ativo: true },
  { id: 'desp-tributos', nome: 'Tributos', tipo: 'despesa', grupo: 'Tributos', ativo: true },
  { id: 'desp-administrativo', nome: 'Administrativo', tipo: 'despesa', grupo: 'Despesas operacionais', ativo: true },
  { id: 'desp-fornecedores', nome: 'Fornecedores', tipo: 'despesa', grupo: 'Despesas operacionais', ativo: true },
  { id: 'desp-outras', nome: 'Outras despesas', tipo: 'despesa', grupo: 'Outras despesas', ativo: true },
]

export function defaultFinanceAccount(makeId = () => 'conta-principal') {
  return { id: makeId('conta'), nome: 'Conta principal', tipo: 'Banco', saldoInicial: 0, dataSaldoInicial: '', ativo: true, observacao: '' }
}

export function normalizeAccount(account = {}) {
  return {
    id: String(account.id || ''),
    nome: String(account.nome || 'Conta').trim(),
    tipo: String(account.tipo || 'Banco'),
    saldoInicial: Number(account.saldoInicial || 0),
    dataSaldoInicial: String(account.dataSaldoInicial || ''),
    ativo: account.ativo !== false,
    observacao: String(account.observacao || '').trim(),
  }
}

export function normalizePayablePayment(payment = {}, index = 0) {
  return {
    id: String(payment.id || `ppay-${index}`),
    data: String(payment.data || ''),
    valorPago: moneyValue(payment.valorPago ?? payment.valor ?? 0),
    desconto: moneyValue(payment.desconto),
    acrescimo: moneyValue(payment.acrescimo),
    contaId: String(payment.contaId || ''),
    formaPagamento: String(payment.formaPagamento || ''),
    observacao: String(payment.observacao || '').trim(),
    createdAt: String(payment.createdAt || ''),
  }
}

export function payablePayments(payable = {}) {
  if (Array.isArray(payable.pagamentos)) return payable.pagamentos.map(normalizePayablePayment)
  if (normalize(payable.status) === 'pago' && moneyValue(payable.valor) > 0) {
    return [normalizePayablePayment({
      id: `legacy-${payable.id || 'payable'}`,
      data: payable.pagoEm || payable.vencimento || '',
      valorPago: payable.valor,
      observacao: 'Pagamento anterior ao controle detalhado',
    })]
  }
  return []
}

export function payableSummary(payable = {}) {
  const total = moneyValue(payable.valor)
  const payments = payablePayments(payable)
  const paidCash = moneyValue(payments.reduce((sum, item) => sum + moneyValue(item.valorPago), 0))
  const discounts = moneyValue(payments.reduce((sum, item) => sum + moneyValue(item.desconto), 0))
  const surcharges = moneyValue(payments.reduce((sum, item) => sum + moneyValue(item.acrescimo), 0))
  const appliedRaw = moneyValue(paidCash + discounts - surcharges)
  const applied = Math.min(total, appliedRaw)
  const balance = moneyValue(Math.max(0, total - applied))
  const lastPaymentDate = payments.map(item => item.data).filter(Boolean).sort().at(-1) || ''
  return { total, payments, paidCash, discounts, surcharges, applied, balance, lastPaymentDate }
}

export function effectivePayableStatus(payable = {}, day = '') {
  if (normalize(payable.status) === 'cancelado') return 'Cancelado'
  const summary = payableSummary(payable)
  if (summary.total > 0 && summary.balance <= 0.009) return 'Pago'
  if (summary.applied > 0) return 'Parcial'
  if (day && payable.vencimento && String(payable.vencimento) < day) return 'Atrasado'
  return 'Pendente'
}

export function payablePaymentError(payable = {}, payment = {}) {
  const current = payableSummary(payable)
  const paid = moneyValue(payment.valorPago)
  const discount = moneyValue(payment.desconto)
  const surcharge = moneyValue(payment.acrescimo)
  if (!payment.data) return 'Informe a data do pagamento.'
  if (paid <= 0) return 'Informe o valor efetivamente pago.'
  const applied = moneyValue(paid + discount - surcharge)
  if (applied <= 0) return 'O pagamento precisa reduzir o saldo da conta.'
  if (applied - current.balance > 0.009) return 'O valor abatido não pode ser maior que o saldo da conta.'
  return ''
}

export function addPaymentToPayable(payable = {}, payment = {}, makeId = () => `ppay-${Date.now()}`) {
  const error = payablePaymentError(payable, payment)
  if (error) throw new Error(error)
  const existing = payablePayments(payable)
  const record = normalizePayablePayment({ ...payment, id: payment.id || makeId(), createdAt: payment.createdAt || new Date().toISOString() }, existing.length)
  const next = { ...payable, pagamentos: [...existing, record] }
  const summary = payableSummary(next)
  next.status = summary.balance <= 0.009 ? 'Pago' : 'Parcial'
  next.pagoEm = summary.balance <= 0.009 ? summary.lastPaymentDate : ''
  next.valorPago = summary.paidCash
  next.saldo = summary.balance
  return next
}

export function removePaymentFromPayable(payable = {}, paymentId = '', day = '') {
  const next = { ...payable, pagamentos: payablePayments(payable).filter(item => String(item.id) !== String(paymentId)), pagoEm: '' }
  next.status = effectivePayableStatus({ ...next, status: 'Pendente' }, day)
  const summary = payableSummary(next)
  next.valorPago = summary.paidCash
  next.saldo = summary.balance
  next.pagoEm = next.status === 'Pago' ? summary.lastPaymentDate : ''
  return next
}

function splitMoney(total, count) {
  const safeCount = Math.max(1, Math.min(120, Math.floor(toNumber(count) || 1)))
  const totalCents = cents(total)
  const base = Math.floor(totalCents / safeCount)
  let remainder = totalCents - base * safeCount
  return Array.from({ length: safeCount }, () => {
    const value = base + (remainder > 0 ? 1 : 0)
    remainder -= remainder > 0 ? 1 : 0
    return fromCents(value)
  })
}

export function buildPayableInstallments(base = {}, count = 1, makeId = prefix => `${prefix}-${Date.now()}`) {
  const safeCount = Math.max(1, Math.min(120, Math.floor(toNumber(count) || 1)))
  if (safeCount === 1) return [{ ...base, parcelaNumero: 1, parcelaTotal: 1 }]
  const values = splitMoney(base.valor, safeCount)
  const groupId = makeId('pgrp')
  return values.map((value, index) => ({
    ...base,
    id: makeId('pagar'),
    valor: value,
    vencimento: addMonths(base.vencimento, index),
    competencia: monthOk(base.competencia)
      ? addMonths(`${base.competencia}-01`, index).slice(0, 7)
      : String(addMonths(base.vencimento, index)).slice(0, 7),
    grupoParcelamentoId: groupId,
    parcelaNumero: index + 1,
    parcelaTotal: safeCount,
    pagamentos: [],
    status: 'Pendente',
    pagoEm: '',
  }))
}

export function normalizeMovement(movement = {}) {
  const type = MOVEMENT_TYPES.includes(String(movement.tipo || '').toLowerCase()) ? String(movement.tipo).toLowerCase() : 'entrada'
  return {
    id: String(movement.id || ''),
    tipo: type,
    data: String(movement.data || ''),
    competencia: String(movement.competencia || '').slice(0, 7),
    descricao: String(movement.descricao || '').trim(),
    categoriaId: String(movement.categoriaId || ''),
    contaId: String(movement.contaId || ''),
    contaDestinoId: String(movement.contaDestinoId || ''),
    valor: moneyValue(movement.valor),
    realizado: movement.realizado !== false,
    observacao: String(movement.observacao || '').trim(),
    createdAt: String(movement.createdAt || ''),
  }
}

export function cashMovements(office = {}) {
  const rows = []
  ;(office.finance || []).forEach(charge => {
    if (normalize(charge.status) === 'cancelado') return
    chargePayments(charge).forEach(payment => {
      if (!payment.data || moneyValue(payment.valorRecebido) <= 0) return
      rows.push({
        id: `receivable:${charge.id}:${payment.id}`,
        sourceType: 'receivable', sourceId: String(charge.id || ''), sourcePaymentId: String(payment.id || ''),
        data: payment.data, competencia: String(charge.competencia || payment.data.slice(0, 7)), tipo: 'entrada',
        descricao: charge.descricao || 'Recebimento', categoriaId: charge.categoriaId || 'rec-honorarios',
        contaId: String(payment.contaId || ''), valor: moneyValue(payment.valorRecebido), realizado: true,
        clienteId: String(charge.clienteId || ''),
      })
    })
  })
  ;(office.financePayables || []).forEach(payable => {
    if (normalize(payable.status) === 'cancelado') return
    payablePayments(payable).forEach(payment => {
      if (!payment.data || moneyValue(payment.valorPago) <= 0) return
      rows.push({
        id: `payable:${payable.id}:${payment.id}`,
        sourceType: 'payable', sourceId: String(payable.id || ''), sourcePaymentId: String(payment.id || ''),
        data: payment.data, competencia: String(payable.competencia || payment.data.slice(0, 7)), tipo: 'saida',
        descricao: payable.descricao || 'Pagamento', categoriaId: payable.categoriaId || 'desp-outras',
        contaId: String(payment.contaId || ''), valor: moneyValue(payment.valorPago), realizado: true,
        fornecedor: payable.fornecedor || '',
      })
    })
  })
  ;(office.financeMovements || []).map(normalizeMovement).forEach(movement => {
    if (movement.valor <= 0 || !movement.data) return
    if (movement.tipo === 'transferencia') {
      rows.push({ ...movement, id: `manual:${movement.id}:out`, sourceType: 'manual', sourceId: movement.id, tipo: 'saida', categoriaId: '', contaId: movement.contaId, descricao: movement.descricao || 'Transferência', transfer: true })
      rows.push({ ...movement, id: `manual:${movement.id}:in`, sourceType: 'manual', sourceId: movement.id, tipo: 'entrada', categoriaId: '', contaId: movement.contaDestinoId, descricao: movement.descricao || 'Transferência', transfer: true })
    } else {
      rows.push({ ...movement, id: `manual:${movement.id}`, sourceType: 'manual', sourceId: movement.id })
    }
  })
  return rows.sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.id).localeCompare(String(a.id)))
}

export function accountBalances(office = {}, day = '') {
  const accounts = (office.financeAccounts || []).map(normalizeAccount)
  const rows = cashMovements(office).filter(row => row.realizado !== false && (!day || row.data <= day))
  return accounts.map(account => {
    let balance = Number(account.saldoInicial || 0)
    rows.forEach(row => {
      if (String(row.contaId || '') !== String(account.id)) return
      if (account.dataSaldoInicial && row.data < account.dataSaldoInicial) return
      balance += row.tipo === 'entrada' ? Number(row.valor || 0) : -Number(row.valor || 0)
    })
    return { ...account, saldoAtual: Math.round(balance * 100) / 100 }
  })
}

export function unassignedCash(office = {}) {
  return cashMovements(office).filter(row => row.realizado !== false && !row.contaId).reduce((result, row) => {
    if (row.tipo === 'entrada') result.entradas += moneyValue(row.valor)
    else result.saidas += moneyValue(row.valor)
    result.liquido = Math.round((result.entradas - result.saidas) * 100) / 100
    result.quantidade += 1
    return result
  }, { entradas: 0, saidas: 0, liquido: 0, quantidade: 0 })
}

function endDateFromDays(day, days) {
  if (!dateOk(day)) return ''
  const date = new Date(`${day}T12:00:00`)
  date.setDate(date.getDate() + Number(days || 0))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function financeOverview(office = {}, { day = '', competence = '' } = {}) {
  const month = competence || String(day || '').slice(0, 7)
  const realized = cashMovements(office).filter(row => row.realizado !== false && (!month || row.data.slice(0, 7) === month) && !row.transfer)
  const entriesMonth = moneyValue(realized.filter(row => row.tipo === 'entrada').reduce((sum, row) => sum + moneyValue(row.valor), 0))
  const exitsMonth = moneyValue(realized.filter(row => row.tipo === 'saida').reduce((sum, row) => sum + moneyValue(row.valor), 0))
  let receivableOpen = 0, receivableOverdue = 0, receivableMonth = 0
  ;(office.finance || []).forEach(charge => {
    if (normalize(charge.status) === 'cancelado') return
    const summary = paymentSummary(charge)
    receivableOpen += summary.balance
    if (day && charge.vencimento && charge.vencimento < day && summary.balance > 0.009) receivableOverdue += summary.balance
    if (month && String(charge.competencia || '') === month) receivableMonth += summary.total
  })
  let payableOpen = 0, payableOverdue = 0, payableMonth = 0
  ;(office.financePayables || []).forEach(payable => {
    if (normalize(payable.status) === 'cancelado') return
    const summary = payableSummary(payable)
    payableOpen += summary.balance
    if (day && payable.vencimento && payable.vencimento < day && summary.balance > 0.009) payableOverdue += summary.balance
    if (month && String(payable.competencia || '') === month) payableMonth += summary.total
  })
  const balances = accountBalances(office, day)
  const cashBalance = Math.round(balances.reduce((sum, account) => sum + Number(account.saldoAtual || 0), 0) * 100) / 100
  return {
    cashBalance,
    entriesMonth,
    exitsMonth,
    cashResultMonth: Math.round((entriesMonth - exitsMonth) * 100) / 100,
    receivableOpen: moneyValue(receivableOpen), receivableOverdue: moneyValue(receivableOverdue), receivableMonth: moneyValue(receivableMonth),
    payableOpen: moneyValue(payableOpen), payableOverdue: moneyValue(payableOverdue), payableMonth: moneyValue(payableMonth),
    projectedOperationalResult: Math.round((receivableMonth - payableMonth) * 100) / 100,
  }
}

export function forecastCash(office = {}, { day = '', days = 30 } = {}) {
  const end = endDateFromDays(day, days)
  const current = accountBalances(office, day).reduce((sum, account) => sum + Number(account.saldoAtual || 0), 0)
  let incoming = 0, outgoing = 0
  ;(office.finance || []).forEach(charge => {
    if (normalize(charge.status) === 'cancelado' || !charge.vencimento || !day || charge.vencimento < day || charge.vencimento > end) return
    incoming += paymentSummary(charge).balance
  })
  ;(office.financePayables || []).forEach(payable => {
    if (normalize(payable.status) === 'cancelado' || !payable.vencimento || !day || payable.vencimento < day || payable.vencimento > end) return
    outgoing += payableSummary(payable).balance
  })
  ;(office.financeMovements || []).map(normalizeMovement).filter(row => row.realizado === false && row.data >= day && row.data <= end).forEach(row => {
    if (row.tipo === 'entrada') incoming += row.valor
    if (row.tipo === 'saida') outgoing += row.valor
  })
  return {
    startBalance: Math.round(current * 100) / 100,
    incoming: moneyValue(incoming), outgoing: moneyValue(outgoing),
    projectedBalance: Math.round((current + incoming - outgoing) * 100) / 100,
    end,
  }
}

export function cashFlowByDay(office = {}, { start = '', end = '' } = {}) {
  const map = new Map()
  cashMovements(office).filter(row => row.realizado !== false && (!start || row.data >= start) && (!end || row.data <= end)).forEach(row => {
    const current = map.get(row.data) || { date: row.data, entries: 0, exits: 0, net: 0 }
    if (row.tipo === 'entrada') current.entries += row.valor
    else current.exits += row.valor
    current.entries = moneyValue(current.entries)
    current.exits = moneyValue(current.exits)
    current.net = Math.round((current.entries - current.exits) * 100) / 100
    map.set(row.data, current)
  })
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function managerialDre(office = {}, competence = '') {
  const categories = new Map((office.financeCategories || DEFAULT_FINANCE_CATEGORIES).map(item => [String(item.id), item]))
  const revenueGroups = new Map(), expenseGroups = new Map()
  let revenue = 0, expense = 0
  ;(office.finance || []).forEach(charge => {
    if (normalize(charge.status) === 'cancelado' || (competence && String(charge.competencia || '') !== competence)) return
    const value = moneyValue(charge.valor)
    const category = categories.get(String(charge.categoriaId || 'rec-honorarios')) || { grupo: 'Receita operacional' }
    const group = category.grupo || 'Receitas'
    revenue += value
    revenueGroups.set(group, moneyValue((revenueGroups.get(group) || 0) + value))
  })
  ;(office.financePayables || []).forEach(payable => {
    if (normalize(payable.status) === 'cancelado' || (competence && String(payable.competencia || '') !== competence)) return
    const value = moneyValue(payable.valor)
    const category = categories.get(String(payable.categoriaId || 'desp-outras')) || { grupo: 'Outras despesas' }
    const group = category.grupo || 'Despesas'
    expense += value
    expenseGroups.set(group, moneyValue((expenseGroups.get(group) || 0) + value))
  })
  return {
    competence,
    revenue: moneyValue(revenue), expense: moneyValue(expense), result: Math.round((revenue - expense) * 100) / 100,
    revenueGroups: [...revenueGroups].map(([group, value]) => ({ group, value })),
    expenseGroups: [...expenseGroups].map(([group, value]) => ({ group, value })),
  }
}

function dueDateForCompetence(competence, dueDay = 1) {
  if (!monthOk(competence)) return ''
  const [year, month] = competence.split('-').map(Number)
  const last = new Date(year, month, 0).getDate()
  return `${competence}-${String(Math.min(Math.max(1, Number(dueDay) || 1), last)).padStart(2, '0')}`
}

export function buildRecurringEntries(office = {}, competence = '', makeId = prefix => `${prefix}-${Date.now()}`) {
  if (!monthOk(competence)) return { receivables: [], payables: [] }
  const receivables = [], payables = []
  ;(office.financeRecurrences || []).filter(item => item.ativo !== false).forEach(recurrence => {
    const start = String(recurrence.inicioCompetencia || '')
    const end = String(recurrence.fimCompetencia || '')
    if (start && competence < start) return
    if (end && competence > end) return
    const due = dueDateForCompetence(competence, recurrence.diaVencimento || 1)
    if (recurrence.tipo === 'receita') {
      const exists = (office.finance || []).some(row => String(row.recorrenciaId || '') === String(recurrence.id) && String(row.competencia || '') === competence)
      if (exists) return
      const base = {
        id: makeId('fin'), clienteId: String(recurrence.clienteId || ''), descricao: recurrence.descricao || 'Receita recorrente',
        competencia, vencimento: due, valor: moneyValue(recurrence.valor), categoriaId: recurrence.categoriaId || 'rec-outras',
        status: 'Pendente', pagamentos: [], origem: 'recorrencia_financeira', recorrenciaId: String(recurrence.id || ''),
      }
      receivables.push(...buildInstallmentCharges(base, 1, makeId))
    } else {
      const exists = (office.financePayables || []).some(row => String(row.recorrenciaId || '') === String(recurrence.id) && String(row.competencia || '') === competence)
      if (exists) return
      payables.push({
        id: makeId('pagar'), descricao: recurrence.descricao || 'Despesa recorrente', fornecedor: recurrence.fornecedor || '',
        competencia, vencimento: due, valor: moneyValue(recurrence.valor), categoriaId: recurrence.categoriaId || 'desp-outras',
        status: 'Pendente', pagamentos: [], origem: 'recorrencia_financeira', recorrenciaId: String(recurrence.id || ''), parcelaNumero: 1, parcelaTotal: 1,
      })
    }
  })
  return { receivables, payables }
}

export function collectionEventsForCharge(events = [], chargeId = '') {
  return (events || []).filter(item => String(item.chargeId || '') === String(chargeId)).sort((a, b) => String(b.data || b.createdAt || '').localeCompare(String(a.data || a.createdAt || '')))
}

export function collectionStatus(events = [], chargeId = '') {
  const rows = collectionEventsForCharge(events, chargeId)
  const promise = rows.find(item => item.tipo === 'promessa' && item.promessaData)
  return { last: rows[0] || null, promise: promise || null, count: rows.length }
}

export function monthlyClosingSnapshot(office = {}, competence = '', createdAt = new Date().toISOString()) {
  const lastDay = monthOk(competence) ? new Date(Number(competence.slice(0, 4)), Number(competence.slice(5, 7)), 0).getDate() : 1
  const day = monthOk(competence) ? `${competence}-${String(lastDay).padStart(2, '0')}` : ''
  const overview = financeOverview(office, { day, competence })
  const dre = managerialDre(office, competence)
  return {
    competencia: competence,
    createdAt,
    gerencial: true,
    overview,
    dre,
    contas: accountBalances(office, day).map(account => ({ id: account.id, nome: account.nome, saldo: account.saldoAtual })),
    observacao: 'Fechamento gerencial. Não substitui escrituração contábil oficial.',
  }
}

export function payableAging(payables = [], day = '') {
  return (payables || []).map(payable => ({ payable, summary: payableSummary(payable), status: effectivePayableStatus(payable, day) }))
    .filter(item => item.summary.balance > 0.009 && item.status !== 'Cancelado')
    .sort((a, b) => String(a.payable.vencimento || '').localeCompare(String(b.payable.vencimento || '')))
}

export function receivableAging(finance = [], day = '') {
  return (finance || []).map(charge => ({ charge, summary: paymentSummary(charge) }))
    .filter(item => normalize(item.charge.status) !== 'cancelado' && item.summary.balance > 0.009)
    .map(item => ({ ...item, overdue: Boolean(day && item.charge.vencimento && item.charge.vencimento < day) }))
    .sort((a, b) => String(a.charge.vencimento || '').localeCompare(String(b.charge.vencimento || '')))
}
