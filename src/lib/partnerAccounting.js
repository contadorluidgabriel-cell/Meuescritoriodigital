import { normalizeSharedCharge, sharedReceiver, sharedSplit } from './sharedWork.js'
import { paymentSummary } from './financePro.js'

const cents = value => Math.round(Math.max(0, Number(value) || 0) * 100)
const money = value => cents(value) / 100
const received = status => String(status || '').toLowerCase() === 'recebido'
const canceled = status => String(status || '').toLowerCase() === 'cancelado'

export function partnerAllocation(charge = {}, client = {}) {
  const shared = Boolean(charge.compartilhado || (charge.origem === 'recorrente' && client?.perfilAtendimento === 'Compartilhado'))
  if (!shared) return { shared: false, total: money(charge.valor), mine: money(charge.valor), partnerTotal: 0, receiver: 'Escritorio' }
  const normalized = normalizeSharedCharge(charge, client)
  const split = sharedSplit(normalized, client)
  return { shared: true, total: money(split.total), mine: money(split.mine), partnerTotal: money(split.partnerTotal), receiver: sharedReceiver(normalized, client) }
}

// Uma baixa do cliente NÃO é necessariamente dinheiro recebido pelo escritório.
// CadaUm: a baixa informa o total quitado; só a fração do escritório integra seu caixa.
export function officeCustomerCash(charge = {}, client = {}, payment = {}) {
  const gross = money(payment.valorRecebido)
  const allocation = partnerAllocation(charge, client)
  if (!allocation.shared || allocation.receiver === 'Escritorio') return gross
  if (allocation.receiver.startsWith('partner:')) return 0
  if (allocation.receiver === 'CadaUm') return allocation.total > 0
    ? money(gross * allocation.mine / allocation.total)
    : 0
  return gross
}

export function expectedPartnerSettlement(charge = {}, client = {}) {
  const allocation = partnerAllocation(charge, client)
  if (!allocation.shared || allocation.receiver === 'CadaUm') return null
  if (allocation.receiver === 'Escritorio') return { tipo: 'saida', valor: allocation.partnerTotal }
  if (allocation.receiver.startsWith('partner:')) return { tipo: 'entrada', valor: allocation.mine }
  return null
}

// Projeção condicional: considera quitação futura pelo cliente e repasse proporcional.
// O vencimento do cliente não confirma a data em que o parceiro realizará o repasse.
export function projectedPartnerAmounts(charge = {}, client = {}, unpaidBalance = paymentSummary(charge).balance) {
  const balance = money(unpaidBalance)
  const allocation = partnerAllocation(charge, client)
  if (!allocation.shared || allocation.total <= 0) return { incoming: balance, outgoing: 0 }
  const officeShare = money(balance * allocation.mine / allocation.total)
  if (allocation.receiver === 'Escritorio') return { incoming: balance, outgoing: money(balance * allocation.partnerTotal / allocation.total) }
  return { incoming: officeShare, outgoing: 0 }
}

export function partnerForecast30Days(finance = [], clients = [], day = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 0
  const end = new Date(`${day}T12:00:00`)
  end.setDate(end.getDate() + 30)
  const endString = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  const clientsById = new Map((clients || []).map(client => [String(client.id), client]))
  return money((finance || []).reduce((total, charge) => {
    if (canceled(charge.status) || !charge.vencimento || charge.vencimento < day || charge.vencimento > endString) return total
    const amounts = projectedPartnerAmounts(charge, clientsById.get(String(charge.clienteId)) || {})
    return total + amounts.incoming - amounts.outgoing
  }, 0))
}

// Somente acertos com data, conta e valor expressamente registrados geram caixa.
// Acertos históricos marcados apenas como "Liquidado" continuam preservados,
// sem se inventar uma movimentação bancária retroativa.
export function partnerSettlementCash(charge = {}, client = {}) {
  if (!received(charge.status) || charge.compartilhadoAcertoStatus !== 'Liquidado') return null
  const expected = expectedPartnerSettlement(charge, client)
  const actual = charge.compartilhadoAcertoPagamento
  if (!expected || !expected.valor || !actual?.data || !actual?.contaId) return null
  if (cents(actual.valor) !== cents(expected.valor)) return null
  return {
    id: `partner-settlement:${charge.id}`,
    sourceType: 'partner-settlement',
    sourceId: String(charge.id || ''),
    data: String(actual.data),
    competencia: String(actual.data).slice(0, 7),
    tipo: expected.tipo,
    descricao: expected.tipo === 'entrada' ? 'Repasse recebido de parceiro' : 'Repasse pago a parceiros',
    categoriaId: '',
    contaId: String(actual.contaId),
    valor: expected.valor,
    clienteId: String(charge.clienteId || ''),
    realizado: true,
    partnerSettlement: true,
  }
}

export function missingPartnerSettlements(office = {}) {
  const clients = new Map((office.clients || []).map(client => [String(client.id), client]))
  return (office.finance || []).filter(charge => {
    if (!received(charge.status) || charge.compartilhadoAcertoStatus !== 'Liquidado') return false
    const client = clients.get(String(charge.clienteId)) || {}
    const expected = expectedPartnerSettlement(charge, client)
    return expected && expected.valor > 0 && !partnerSettlementCash(charge, client)
  })
}
