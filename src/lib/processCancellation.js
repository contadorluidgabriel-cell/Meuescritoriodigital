import { effectiveChargeStatus, paymentSummary } from './financePro.js'

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


function linkedProcessCharge(charge = {}, process = {}) {
  return String(charge.origemTipo || '').toLowerCase() === 'processo'
    && String(charge.origemId || '') === String(process.id || '')
}

function allocateCancellationTotal(charges = [], total = 0) {
  const targetCents = Math.round(money(total) * 100)
  const originals = charges.map(charge => money(charge.cancelamentoValorOriginal ?? charge.valor))
  const originalCents = originals.map(value => Math.round(value * 100))
  const originalTotal = originalCents.reduce((sum, value) => sum + value, 0)
  if (!charges.length) return []
  if (targetCents <= 0) return charges.map(() => 0)
  if (originalTotal <= 0) {
    const base = Math.floor(targetCents / charges.length)
    let remainder = targetCents - base * charges.length
    return charges.map(() => {
      const cents = base + (remainder > 0 ? 1 : 0)
      remainder -= remainder > 0 ? 1 : 0
      return cents / 100
    })
  }

  let remaining = targetCents
  return charges.map((charge, index) => {
    if (index === charges.length - 1) return remaining / 100
    const cents = Math.min(remaining, Math.round(targetCents * originalCents[index] / originalTotal))
    remaining -= cents
    return cents / 100
  })
}

export function reconcileProcessCancellationFinance(finance = [], process = {}, day = '') {
  if (!processIsCancelled(process) || !process?.id) return { finance, changed: false }
  const linked = (finance || []).filter(charge => linkedProcessCharge(charge, process))
  if (!linked.length) return { finance, changed: false }

  const due = money(process.cancelamentoValorDevido)
  const allocated = allocateCancellationTotal(linked, due)
  const linkedIndexes = new Map(linked.map((charge, index) => [String(charge.id || ''), index]))
  let changed = false

  const next = (finance || []).map(charge => {
    if (!linkedProcessCharge(charge, process)) return charge
    const linkedIndex = linkedIndexes.get(String(charge.id || ''))
    if (linkedIndex == null) return charge

    const original = money(charge.cancelamentoValorOriginal ?? charge.valor)
    const value = money(allocated[linkedIndex] || 0)
    const cancellationKey = `${String(process.cancelamentoData || '')}:${due.toFixed(2)}`
    const alreadyAdjusted = String(charge.cancelamentoProcessoChave || '') === cancellationKey
      && money(charge.cancelamentoValorOriginal) === original
      && (value <= 0 ? String(charge.status || '').toLowerCase() === 'cancelado' : money(charge.valor) === value)
    if (alreadyAdjusted) return charge

    const nextCharge = {
      ...charge,
      cancelamentoValorOriginal: original,
      cancelamentoProcessoChave: cancellationKey,
      cancelamentoProcessoId: String(process.id || ''),
      cancelamentoProcessoEm: String(process.cancelamentoData || day || ''),
      cancelamentoProcessoMotivo: String(process.cancelamentoMotivo || ''),
    }

    if (value <= 0) {
      nextCharge.status = 'Cancelado'
      nextCharge.saldo = 0
      nextCharge.recebidoEm = ''
    } else {
      nextCharge.valor = value
      const summary = paymentSummary(nextCharge)
      nextCharge.status = effectiveChargeStatus({ ...nextCharge, status: 'Pendente' }, day)
      nextCharge.valorRecebido = summary.receivedCash
      nextCharge.saldo = summary.balance
      nextCharge.recebidoEm = nextCharge.status === 'Recebido' ? summary.lastPaymentDate : ''
    }
    changed = true
    return nextCharge
  })

  return { finance: next, changed }
}
