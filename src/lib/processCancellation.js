import { paymentSummary } from './financePro.js'

const money = value => Math.round(Math.max(0, Number(value) || 0) * 100) / 100
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

export function processIsCancelled(process = {}) {
  return normalize(process.status) === 'cancelado'
}

export function processIsClosed(process = {}) {
  const status = normalize(process.status)
  return status === 'cancelado' || status === 'concluido' || status === 'concluida'
}

export function processCancellationSummary(process = {}, finance = []) {
  const contracted = money(process.financeiroValor)
  const due = processIsCancelled(process) ? money(process.cancelamentoValorDevido) : contracted
  const charges = (finance || []).filter(charge =>
    String(charge.origemTipo || '').toLowerCase() === 'processo'
    && String(charge.origemId || '') === String(process.id || '')
  )
  const paid = money(charges.reduce((sum, charge) => sum + paymentSummary(charge).receivedCash, 0))
  const balance = money(Math.max(0, due - paid))
  const overpaid = money(Math.max(0, paid - due))
  return { contracted, due, paid, balance, overpaid, charges }
}

export function processCancellationError(process = {}) {
  if (!processIsCancelled(process)) return ''
  if (!String(process.cancelamentoPor || '').trim()) return 'Informe quem solicitou o cancelamento.'
  if (!String(process.cancelamentoMotivo || '').trim()) return 'Informe o motivo do cancelamento.'
  if (!String(process.cancelamentoData || '').trim()) return 'Informe a data do cancelamento.'
  if (money(process.cancelamentoValorDevido) > money(process.financeiroValor) && money(process.financeiroValor) > 0) {
    return 'O valor devido no cancelamento não pode ser maior que o valor contratado.'
  }
  return ''
}
