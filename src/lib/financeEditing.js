import { addMonths, chargePayments, effectiveChargeStatus, paymentSummary } from './financePro.js'
import { SETTLEMENT_PENDING } from './sharedWork.js'

const money = value => Math.round(Math.max(0, Number(value) || 0) * 100) / 100
const cents = value => Math.round(money(value) * 100)
const fromCents = value => Math.round(value) / 100

export function settledPrincipal(charge = {}) {
  const summary = paymentSummary(charge)
  return money(Math.max(0, summary.receivedCash + summary.discounts - summary.surcharges))
}

function materializeLegacyPayment(charge = {}) {
  if (Array.isArray(charge.pagamentos) && charge.pagamentos.length) return charge
  const payments = chargePayments(charge)
  if (!payments.length) return charge
  return { ...charge, pagamentos: payments, status: 'Pendente', recebidoEm: '' }
}

function scaleParts(mine, shares, oldTotal, newTotal) {
  const participants = [
    { type: 'mine', value: cents(mine) },
    ...(Array.isArray(shares) ? shares : []).map(item => ({ type: 'partner', parceiroId: String(item.parceiroId || ''), value: cents(item.valor) })),
  ]
  const target = cents(newTotal)
  const known = participants.reduce((sum, item) => sum + item.value, 0)
  if (!participants.length || known <= 0 || cents(oldTotal) <= 0) {
    return { mine: fromCents(target), shares: participants.filter(item => item.type === 'partner').map(item => ({ parceiroId: item.parceiroId, valor: 0 })) }
  }
  let remaining = target
  const scaled = participants.map((item, index) => {
    if (index === participants.length - 1) return { ...item, value: remaining }
    const value = Math.min(remaining, Math.max(0, Math.round(item.value * target / known)))
    remaining -= value
    return { ...item, value }
  })
  return {
    mine: fromCents(scaled.find(item => item.type === 'mine')?.value || 0),
    shares: scaled.filter(item => item.type === 'partner').map(item => ({ parceiroId: item.parceiroId, valor: fromCents(item.value) })),
  }
}

function rescaleShared(record = {}, newTotal = 0) {
  if (!record.compartilhado && !Array.isArray(record.compartilhadoPartesParceiros)) return record
  const scaled = scaleParts(record.compartilhadoMinhaParte, record.compartilhadoPartesParceiros, record.valor ?? record.mensalidade, newTotal)
  return {
    ...record,
    compartilhadoMinhaParte: scaled.mine,
    compartilhadoPartesParceiros: scaled.shares,
    compartilhadoParceiroParte: scaled.shares[0]?.valor || 0,
  }
}

export function editChargeRecord(charge = {}, values = {}, day = '') {
  const nextValue = money(values.valor ?? charge.valor)
  if (nextValue <= 0) throw new Error('O valor da cobrança precisa ser maior que zero.')
  const minimum = settledPrincipal(charge)
  if (nextValue + 0.009 < minimum) throw new Error(`O valor não pode ficar abaixo de R$ ${minimum.toFixed(2)} já liquidado. Estorne a baixa antes de reduzir além disso.`)

  const before = {
    descricao: charge.descricao || '',
    valor: money(charge.valor),
    vencimento: charge.vencimento || '',
    competencia: charge.competencia || '',
  }
  const changedValue = Math.abs(nextValue - before.valor) > 0.009
  let next = materializeLegacyPayment(charge)
  next = {
    ...next,
    descricao: String(values.descricao ?? charge.descricao ?? '').trim() || 'Cobrança',
    valor: nextValue,
    vencimento: String(values.vencimento ?? charge.vencimento ?? ''),
    competencia: String(values.competencia ?? charge.competencia ?? ''),
  }
  if (changedValue) next = rescaleShared(next, nextValue)

  const summary = paymentSummary(next)
  next.status = effectiveChargeStatus({ ...next, status: next.status === 'Cancelado' ? 'Cancelado' : 'Pendente' }, day)
  next.recebidoEm = next.status === 'Recebido' ? summary.lastPaymentDate : ''
  next.valorRecebido = summary.receivedCash
  next.saldo = summary.balance
  if (changedValue && next.compartilhado && next.status !== 'Recebido') {
    next.compartilhadoAcertoStatus = SETTLEMENT_PENDING
    next.compartilhadoAcertoEm = ''
  }

  const after = { descricao: next.descricao, valor: next.valor, vencimento: next.vencimento, competencia: next.competencia }
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    next.historicoEdicoesFinanceiras = [
      ...(Array.isArray(charge.historicoEdicoesFinanceiras) ? charge.historicoEdicoesFinanceiras : []),
      { em: new Date().toISOString(), antes: before, depois: after },
    ]
  }
  return next
}

export function editChargeCollection(finance = [], chargeId = '', values = {}, scope = 'single', day = '') {
  const target = (finance || []).find(item => String(item.id) === String(chargeId))
  if (!target) throw new Error('Cobrança não encontrada.')
  const groupId = String(target.grupoParcelamentoId || '')
  const targetNumber = Number(target.parcelaNumero) || 1
  const candidates = scope === 'future' && groupId
    ? (finance || []).filter(item => String(item.grupoParcelamentoId || '') === groupId && (Number(item.parcelaNumero) || 1) >= targetNumber)
    : [target]

  const byId = new Map()
  candidates.forEach(item => {
    const offset = Math.max(0, (Number(item.parcelaNumero) || targetNumber) - targetNumber)
    const itemValues = {
      descricao: values.descricao,
      valor: values.valor,
      vencimento: values.vencimento ? addMonths(values.vencimento, offset) : item.vencimento,
      competencia: values.competencia && /^\d{4}-\d{2}$/.test(values.competencia)
        ? addMonths(`${values.competencia}-01`, offset).slice(0, 7)
        : item.competencia,
    }
    byId.set(String(item.id), editChargeRecord(item, itemValues, day))
  })

  return {
    finance: (finance || []).map(item => byId.get(String(item.id)) || item),
    count: byId.size,
  }
}

export function monthlyFeeForCompetence(client = {}, competence = '') {
  const history = (Array.isArray(client.honorariosHistorico) ? client.honorariosHistorico : [])
    .filter(item => /^\d{4}-\d{2}$/.test(String(item?.competenciaInicio || '')) && money(item?.valor) > 0)
    .slice()
    .sort((a, b) => String(a.competenciaInicio).localeCompare(String(b.competenciaInicio)))
  const eligible = history.filter(item => String(item.competenciaInicio) <= String(competence || ''))
  if (eligible.length) return money(eligible.at(-1).valor)
  if (history.length && money(history[0].valorAnterior) > 0) return money(history[0].valorAnterior)
  return money(client.mensalidade ?? client.honorario ?? 0)
}

function previousCompetence(value = '') {
  if (!/^\d{4}-\d{2}$/.test(String(value))) return ''
  const [year, month] = value.split('-').map(Number)
  const date = new Date(year, month - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function applyFeeAdjustment(client = {}, { valor, competenciaInicio, observacao = '' } = {}) {
  const nextValue = money(valor)
  if (nextValue <= 0) throw new Error('Informe um novo honorário maior que zero.')
  if (!/^\d{4}-\d{2}$/.test(String(competenciaInicio || ''))) throw new Error('Informe a competência inicial do reajuste.')
  const previousValue = monthlyFeeForCompetence(client, previousCompetence(competenciaInicio)) || money(client.mensalidade ?? client.honorario ?? 0)
  const history = (Array.isArray(client.honorariosHistorico) ? client.honorariosHistorico : [])
    .filter(item => String(item?.competenciaInicio || '') !== String(competenciaInicio))
  history.push({
    id: `hon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    competenciaInicio,
    valorAnterior: previousValue,
    valor: nextValue,
    observacao: String(observacao || '').trim(),
    criadoEm: new Date().toISOString(),
  })
  history.sort((a, b) => String(a.competenciaInicio).localeCompare(String(b.competenciaInicio)))
  let next = { ...client, honorariosHistorico: history, mensalidade: money(history.at(-1)?.valor || nextValue) }
  if (client.perfilAtendimento === 'Compartilhado') next = rescaleShared({ ...next, valor: client.mensalidade }, next.mensalidade)
  delete next.valor
  return next
}

export function applyAdjustmentToGeneratedCharge(finance = [], clientId = '', competence = '', newValue = 0, day = '') {
  let updated = false
  let blocked = false
  const next = (finance || []).map(charge => {
    if (String(charge.clienteId) !== String(clientId) || charge.origem !== 'recorrente' || charge.competencia !== competence) return charge
    const summary = paymentSummary(charge)
    if (summary.receivedCash > 0.009 || summary.discounts > 0.009 || summary.surcharges > 0.009 || charge.status === 'Cancelado') {
      blocked = true
      return charge
    }
    updated = true
    return editChargeRecord(charge, { valor: newValue }, day)
  })
  return { finance: next, updated, blocked }
}
