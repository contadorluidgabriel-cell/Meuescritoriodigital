import { chargePayments, paymentSummary } from './financePro.js'
import { normalizeSharedCharge, partnerShares, settlementEntries } from './sharedWork.js'
import { partnerAllocation, partnerSettlementCash } from './partnerAccounting.js'

const cents = value => Math.round(Math.max(0, Number(value) || 0) * 100)
const amount = value => cents(value) / 100
const isCanceled = value => String(value || '').toLowerCase() === 'cancelado'
const isReceived = value => String(value || '').toLowerCase() === 'recebido'
const nameOf = client => client?.razao || client?.nome || client?.fantasia || 'Cliente não identificado'

/** Extrato operacional, derivado dos registros existentes. Nunca cria lançamentos. */
export function buildPartnerFlow(office = {}, { partnerId = '', month = '' } = {}) {
  const clients = new Map((office.clients || []).map(client => [String(client.id), client]))
  const accounts = new Map((office.financeAccounts || []).map(account => [String(account.id), account.nome]))
  const partners = (office.partners || []).filter(partner => !partnerId || String(partner.id) === String(partnerId))
  const selectedIds = new Set(partners.map(partner => String(partner.id)))
  const events = []
  const totals = { gross: 0, partnerShare: 0, customerPaidShare: 0, customerOpenShare: 0, settlementsToOffice: 0, settlementsToPartner: 0, unverified: 0 }
  const seenGross = new Set()

  for (const charge of office.finance || []) {
    const client = clients.get(String(charge.clienteId)) || {}
    const allocation = partnerAllocation(charge, client)
    if (!allocation.shared || allocation.total <= 0) continue
    const normalized = normalizeSharedCharge(charge, client)
    const relevantShares = partnerShares(normalized, client).filter(share => selectedIds.has(String(share.parceiroId)) && cents(share.valor) > 0)
    if (!relevantShares.length) continue
    const summary = paymentSummary(charge)
    const paidCents = Math.min(cents(allocation.total), cents(summary.applied))
    const totalCents = cents(allocation.total)
    const chargeId = String(charge.id)
    const clientLabel = nameOf(client)
    const processLabel = String(charge.origemTipo || '').toLowerCase() === 'processo' ? 'Processo' : 'Cobrança'
    const source = { chargeId, clientId: String(charge.clienteId || ''), client: clientLabel, description: charge.descricao || 'Serviço', processId: processLabel === 'Processo' ? String(charge.origemId || '') : '', origin: processLabel }
    if (!isCanceled(charge.status) && !seenGross.has(chargeId)) {
      totals.gross += amount(charge.valor)
      seenGross.add(chargeId)
    }

    for (const share of relevantShares) {
      const id = String(share.parceiroId)
      const partnerCents = cents(share.valor)
      const paidPartCents = Math.round(partnerCents * paidCents / totalCents)
      const pendingPartCents = isCanceled(charge.status) ? 0 : Math.max(0, partnerCents - paidPartCents)
      if (!isCanceled(charge.status)) totals.partnerShare += partnerCents / 100
      totals.customerPaidShare += paidPartCents / 100
      totals.customerOpenShare += pendingPartCents / 100
      const base = { ...source, partnerId: id }
      events.push({ ...base, id: `${chargeId}:${id}:billing`, kind: 'billing', date: charge.vencimento || (charge.competencia ? `${charge.competencia}-01` : ''), value: partnerCents / 100, gross: amount(charge.valor), status: isCanceled(charge.status) ? 'Cancelada' : summary.balance <= 0.009 ? 'Quitada' : 'Em aberto', note: isCanceled(charge.status) ? 'Cobrança cancelada; baixas históricas preservadas.' : `${processLabel} · participação contratada do parceiro (não é entrada bancária).` })
      let applied = 0
      let prior = 0
      const payments = chargePayments(charge)
      payments.forEach((payment, index) => {
        const net = cents(payment.valorRecebido) + cents(payment.desconto) - cents(payment.acrescimo)
        applied = Math.min(totalCents, Math.max(0, applied + net))
        const allocated = Math.round(partnerCents * applied / totalCents)
        const portion = Math.max(0, allocated - prior)
        prior = allocated
        if (portion === 0 && cents(payment.valorRecebido) === 0) return
        const receiverText = allocation.receiver === 'Escritorio' ? 'escritório' : allocation.receiver === 'CadaUm' ? 'cada parte diretamente' : 'parceiro'
        events.push({ ...base, id: `${chargeId}:${id}:payment:${payment.id || index}`, kind: 'payment', date: payment.data || '', value: portion / 100, gross: amount(payment.valorRecebido), status: 'Cliente quitou', note: `Baixa do cliente; recebedor: ${receiverText}. Parcela econômica do parceiro, não um repasse.`, receiver: allocation.receiver })
      })

      const expected = settlementEntries(charge, client).find(item => String(item.parceiroId) === id)
      if (expected) events.push({ ...base, id: `${chargeId}:${id}:pending`, kind: 'pending', date: summary.lastPaymentDate || charge.recebidoEm || '', value: amount(expected.valor), status: expected.tipo === 'aPagar' ? 'A pagar ao parceiro' : 'A receber do parceiro', note: 'Acerto pendente após a quitação do cliente.' })

      if (isReceived(charge.status) && charge.compartilhadoAcertoStatus === 'Liquidado') {
        const settlement = partnerSettlementCash(charge, client)
        const isOfficeReceiver = allocation.receiver === 'Escritorio'
        const partnerReceiver = allocation.receiver === `partner:${id}`
        const settlementValue = isOfficeReceiver ? partnerCents / 100 : partnerReceiver ? amount(allocation.mine) : 0
        if (settlementValue > 0 && settlement) {
          const joint = isOfficeReceiver && partnerShares(normalized, client).filter(item => cents(item.valor) > 0).length > 1
          if (settlement.tipo === 'entrada') totals.settlementsToOffice += settlementValue
          else totals.settlementsToPartner += settlementValue
          events.push({ ...base, id: `${chargeId}:${id}:settlement`, kind: 'settlement', date: settlement.data, value: settlementValue, status: settlement.tipo === 'entrada' ? 'Repasse recebido pelo escritório' : 'Repasse pago pelo escritório', account: accounts.get(String(settlement.contaId)) || 'Conta não identificada', note: joint ? 'Repasse conjunto registrado; não há confirmação bancária individual por parceiro.' : 'Movimentação registrada no caixa do escritório.' })
        } else if (settlementValue > 0 && !settlement) {
          totals.unverified += 1
          events.push({ ...base, id: `${chargeId}:${id}:unverified`, kind: 'unverified', date: charge.compartilhadoAcertoEm || '', value: settlementValue, status: 'Acerto liquidado sem caixa conciliado', note: 'Status informado sem data, conta e valor bancário validados. Confira o extrato; não há entrada ou saída presumida.' })
        }
      }
    }
  }
  const allEvents = events.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(a.id).localeCompare(String(b.id)))
  const visibleEvents = month ? allEvents.filter(item => String(item.date || '').slice(0, 7) === month) : allEvents
  return { events: visibleEvents, totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, key === 'unverified' ? value : amount(value)])), partners, month }
}
