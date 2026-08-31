const toNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0
const money = value => Math.round(Math.max(0, toNumber(value)) * 100) / 100
const cents = value => Math.round(money(value) * 100)
const fromCents = value => Math.round(value) / 100
const isReceived = value => String(value || '').toLowerCase() === 'recebido'
const isCanceled = value => String(value || '').toLowerCase() === 'cancelado'

export const FINANCE_STATUSES = ['Pendente', 'Parcial', 'Recebido', 'Atrasado', 'Cancelado']

export function normalizePayment(payment = {}, index = 0) {
  return {
    id: String(payment.id || `pay-${index}`),
    data: String(payment.data || payment.recebidoEm || ''),
    valorRecebido: money(payment.valorRecebido ?? payment.valor ?? 0),
    desconto: money(payment.desconto),
    acrescimo: money(payment.acrescimo),
    observacao: String(payment.observacao || '').trim(),
    createdAt: payment.createdAt || '',
    legacy: Boolean(payment.legacy),
  }
}

export function chargePayments(charge = {}) {
  if (Array.isArray(charge.pagamentos) && charge.pagamentos.length) return charge.pagamentos.map(normalizePayment)
  const value = money(charge.valor)
  if (isReceived(charge.status) && value > 0) {
    return [normalizePayment({
      id: `legacy-${charge.id || 'charge'}`,
      data: charge.recebidoEm || charge.vencimento || '',
      valorRecebido: value,
      observacao: 'Recebimento anterior ao controle de baixas',
      legacy: true,
    })]
  }
  return []
}

export function paymentSummary(charge = {}) {
  const total = money(charge.valor)
  const payments = chargePayments(charge)
  const receivedCash = money(payments.reduce((sum, item) => sum + money(item.valorRecebido), 0))
  const discounts = money(payments.reduce((sum, item) => sum + money(item.desconto), 0))
  const surcharges = money(payments.reduce((sum, item) => sum + money(item.acrescimo), 0))
  const appliedRaw = money(receivedCash + discounts - surcharges)
  const applied = Math.min(total, appliedRaw)
  const balance = money(Math.max(0, total - applied))
  const lastPaymentDate = payments.map(item => item.data).filter(Boolean).sort().at(-1) || ''
  return { total, payments, receivedCash, discounts, surcharges, applied, balance, lastPaymentDate }
}

export function effectiveChargeStatus(charge = {}, day = '') {
  if (isCanceled(charge.status)) return 'Cancelado'
  const summary = paymentSummary(charge)
  if (summary.total > 0 && summary.balance <= 0.009) return 'Recebido'
  const hasPayment = summary.payments.length > 0 && summary.applied > 0
  if (hasPayment) return 'Parcial'
  if (day && charge.vencimento && String(charge.vencimento) < String(day)) return 'Atrasado'
  return 'Pendente'
}

export function paymentError(charge = {}, payment = {}) {
  const current = paymentSummary(charge)
  const received = money(payment.valorRecebido)
  const discount = money(payment.desconto)
  const surcharge = money(payment.acrescimo)
  if (received <= 0) return 'Informe o valor efetivamente recebido.'
  const applied = money(received + discount - surcharge)
  if (applied <= 0) return 'A baixa precisa reduzir o saldo da cobrança.'
  if (applied - current.balance > 0.009) return 'O valor abatido não pode ser maior que o saldo da cobrança.'
  if (!payment.data) return 'Informe a data do recebimento.'
  return ''
}

export function addPaymentToCharge(charge = {}, payment = {}, makeId = () => `pay-${Date.now()}`) {
  const error = paymentError(charge, payment)
  if (error) throw new Error(error)
  const existing = Array.isArray(charge.pagamentos) ? charge.pagamentos.map(normalizePayment) : []
  const record = normalizePayment({ ...payment, id: payment.id || makeId(), createdAt: payment.createdAt || new Date().toISOString() }, existing.length)
  const next = { ...charge, pagamentos: [...existing, record] }
  const summary = paymentSummary(next)
  next.status = summary.balance <= 0.009 ? 'Recebido' : 'Parcial'
  next.recebidoEm = summary.balance <= 0.009 ? summary.lastPaymentDate : ''
  next.valorRecebido = summary.receivedCash
  next.saldo = summary.balance
  return next
}

export function removePaymentFromCharge(charge = {}, paymentId = '', day = '') {
  const next = { ...charge, pagamentos: (charge.pagamentos || []).filter(item => String(item.id) !== String(paymentId)) }
  const summary = paymentSummary(next)
  next.status = effectiveChargeStatus({ ...next, status: summary.balance <= 0.009 && summary.total > 0 ? 'Recebido' : 'Pendente' }, day)
  next.recebidoEm = next.status === 'Recebido' ? summary.lastPaymentDate : ''
  next.valorRecebido = summary.receivedCash
  next.saldo = summary.balance
  return next
}

export function splitMoney(total, count) {
  const safeCount = Math.max(1, Math.floor(toNumber(count) || 1))
  const totalCents = cents(total)
  const base = Math.floor(totalCents / safeCount)
  let remainder = totalCents - base * safeCount
  return Array.from({ length: safeCount }, () => {
    const value = base + (remainder > 0 ? 1 : 0)
    remainder -= remainder > 0 ? 1 : 0
    return fromCents(value)
  })
}

export function addMonths(dateValue = '', offset = 0) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ''))
  if (!match) return dateValue
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const target = new Date(year, month - 1 + offset, 1)
  const targetYear = target.getFullYear(), targetMonth = target.getMonth()
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
  const finalDay = Math.min(day, lastDay)
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`
}

function sharedInstallmentMatrix(base = {}, installmentValues = []) {
  const shares = Array.isArray(base.compartilhadoPartesParceiros) ? base.compartilhadoPartesParceiros : []
  const participants = [
    { type: 'office', valor: money(base.compartilhadoMinhaParte) },
    ...shares.map(item => ({ type: `partner:${item.parceiroId}`, parceiroId: String(item.parceiroId), valor: money(item.valor) })),
  ]
  const remaining = participants.map(item => cents(item.valor))
  const totalCents = installmentValues.reduce((sum, value) => sum + cents(value), 0)
  return installmentValues.map((installment, index) => {
    const installmentCents = cents(installment)
    let row
    if (index === installmentValues.length - 1) {
      row = remaining.slice()
    } else {
      let rowRemaining = installmentCents
      row = participants.map((participant, participantIndex) => {
        if (participantIndex === participants.length - 1) return rowRemaining
        const calculated = totalCents > 0 ? Math.round(cents(participant.valor) * installmentCents / totalCents) : 0
        const value = Math.min(remaining[participantIndex], Math.max(0, calculated), rowRemaining)
        rowRemaining -= value
        return value
      })
    }
    row.forEach((value, participantIndex) => { remaining[participantIndex] -= value })
    return {
      mine: fromCents(row[0] || 0),
      shares: participants.slice(1).map((participant, partnerIndex) => ({ parceiroId: participant.parceiroId, valor: fromCents(row[partnerIndex + 1] || 0) })),
    }
  })
}

export function buildInstallmentCharges(base = {}, count = 1, makeId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`) {
  const safeCount = Math.max(1, Math.min(60, Math.floor(toNumber(count) || 1)))
  if (safeCount === 1) return [{ ...base, parcelaNumero: 1, parcelaTotal: 1 }]
  const values = splitMoney(base.valor, safeCount)
  const groupId = makeId('grp')
  const sharedRows = base.compartilhado ? sharedInstallmentMatrix(base, values) : []
  return values.map((value, index) => {
    const shared = sharedRows[index]
    return {
      ...base,
      id: makeId('fin'),
      valor: value,
      vencimento: addMonths(base.vencimento, index),
      competencia: base.competencia && /^\d{4}-\d{2}$/.test(base.competencia)
        ? addMonths(`${base.competencia}-01`, index).slice(0, 7)
        : String(addMonths(base.vencimento, index)).slice(0, 7),
      grupoParcelamentoId: groupId,
      parcelaNumero: index + 1,
      parcelaTotal: safeCount,
      pagamentos: [],
      status: 'Pendente',
      recebidoEm: '',
      ...(shared ? {
        compartilhadoMinhaParte: shared.mine,
        compartilhadoPartesParceiros: shared.shares,
        compartilhadoParceiroParte: shared.shares[0]?.valor || 0,
      } : {}),
    }
  })
}

export function previousCompetence(competence = '') {
  const match = /^(\d{4})-(\d{2})$/.exec(String(competence || ''))
  if (!match) return ''
  const date = new Date(Number(match[1]), Number(match[2]) - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function financeMetrics(finance = [], { competence = '', clientId = '', day = '' } = {}) {
  return (finance || []).reduce((result, charge) => {
    if (competence && String(charge.competencia || '') !== competence) return result
    if (clientId && String(charge.clienteId || '') !== String(clientId)) return result
    if (isCanceled(charge.status)) return result
    const summary = paymentSummary(charge)
    result.billed += summary.total
    result.received += summary.receivedCash
    result.open += summary.balance
    if (summary.balance > 0.009 && day && charge.vencimento && String(charge.vencimento) < day) result.overdue += summary.balance
    if (charge.origem === 'recorrente') result.recurring += summary.total
    else result.single += summary.total
    return result
  }, { billed: 0, received: 0, open: 0, overdue: 0, recurring: 0, single: 0 })
}

export function forecast30Days(finance = [], day = '') {
  if (!day) return 0
  const start = new Date(`${day}T12:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 30)
  const endString = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  return money((finance || []).reduce((sum, charge) => {
    if (isCanceled(charge.status)) return sum
    const balance = paymentSummary(charge).balance
    if (balance <= 0.009 || !charge.vencimento) return sum
    return String(charge.vencimento) >= day && String(charge.vencimento) <= endString ? sum + balance : sum
  }, 0))
}

export function delinquencyByClient(finance = [], clients = [], day = '') {
  const clientsById = new Map((clients || []).map(client => [String(client.id), client]))
  const grouped = new Map()
  ;(finance || []).forEach(charge => {
    if (isCanceled(charge.status) || !charge.vencimento || !day || String(charge.vencimento) >= day) return
    const balance = paymentSummary(charge).balance
    if (balance <= 0.009) return
    const id = String(charge.clienteId || '')
    const current = grouped.get(id) || { clienteId: id, cliente: clientsById.get(id), total: 0, cobrancas: 0, maisAntiga: charge.vencimento }
    current.total = money(current.total + balance)
    current.cobrancas += 1
    if (String(charge.vencimento) < String(current.maisAntiga)) current.maisAntiga = charge.vencimento
    grouped.set(id, current)
  })
  return [...grouped.values()].sort((a, b) => b.total - a.total)
}
