import { buildInstallmentCharges } from './financePro.js'
import { clientPartnerIds, sharedChargeError } from './sharedWork.js'

const money = value => Math.round(Math.max(0, Number(value) || 0) * 100) / 100
const unique = values => [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))]

export function processFinancePartnerIds(process = {}, client = {}) {
  const explicit = Array.isArray(process.financeiroParceiroIds) ? process.financeiroParceiroIds : []
  return unique(explicit.length ? explicit : clientPartnerIds(client))
}

export function processFinanceShares(process = {}, client = {}) {
  const ids = processFinancePartnerIds(process, client)
  const raw = Array.isArray(process.financeiroPartesParceiros) ? process.financeiroPartesParceiros : []
  const byId = new Map(raw.map(item => [String(item?.parceiroId || ''), money(item?.valor)]))
  return ids.map(parceiroId => ({ parceiroId, valor: byId.get(parceiroId) || 0 }))
}

export function normalizedProcessFinance(process = {}, client = {}) {
  const charged = Boolean(process.cobradoAParte)
  const total = charged ? money(process.financeiroValor) : 0
  const installmentCount = Math.max(1, Math.min(60, Math.floor(Number(process.financeiroParcelas) || 1)))
  const shared = charged && client?.perfilAtendimento === 'Compartilhado'
  const partnerIds = shared ? processFinancePartnerIds(process, client) : []
  const shares = shared ? processFinanceShares(process, client) : []
  const receiver = shared ? String(process.financeiroRecebedor || 'Escritorio') : 'Escritorio'
  const mine = shared ? money(process.financeiroMinhaParte) : total

  return {
    cobradoAParte: charged,
    financeiroValor: total,
    financeiroParcelas: installmentCount,
    financeiroVencimento: charged ? String(process.financeiroVencimento || '') : '',
    financeiroDescricao: String(process.financeiroDescricao || process.tipo || 'Serviço do processo').trim(),
    gerarCobranca: charged && Boolean(process.gerarCobranca),
    financeiroParceiroIds: partnerIds,
    financeiroRecebedor: receiver,
    financeiroMinhaParte: mine,
    financeiroPartesParceiros: shares,
  }
}

export function processFinanceError(process = {}, client = {}) {
  const normalized = normalizedProcessFinance(process, client)
  if (!normalized.cobradoAParte) return ''
  if (normalized.financeiroValor <= 0) return 'Informe o valor do serviço cobrado à parte.'
  if (!normalized.financeiroVencimento) return 'Informe o primeiro vencimento da cobrança.'
  if (!normalized.financeiroDescricao) return 'Informe a descrição da cobrança.'
  if (client?.perfilAtendimento !== 'Compartilhado') return ''

  return sharedChargeError({
    valor: normalized.financeiroValor,
    compartilhado: true,
    parceiroIds: normalized.financeiroParceiroIds,
    parceiroId: normalized.financeiroParceiroIds[0] || '',
    compartilhadoRecebedor: normalized.financeiroRecebedor,
    compartilhadoMinhaParte: normalized.financeiroMinhaParte,
    compartilhadoPartesParceiros: normalized.financeiroPartesParceiros,
  }, client)
}

export function buildProcessFinanceCharges(process = {}, client = {}, makeId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`) {
  const normalized = normalizedProcessFinance(process, client)
  const error = processFinanceError(normalized, client)
  if (error) throw new Error(error)
  if (!normalized.cobradoAParte) return []

  const shared = client?.perfilAtendimento === 'Compartilhado'
  const base = {
    id: makeId('fin'),
    clienteId: String(process.clientId || ''),
    cliente: client?.razao || client?.nome || client?.fantasia || '',
    descricao: normalized.financeiroDescricao,
    competencia: String(normalized.financeiroVencimento).slice(0, 7),
    vencimento: normalized.financeiroVencimento,
    valor: normalized.financeiroValor,
    origem: 'avulso',
    origemTipo: 'Processo',
    origemId: String(process.id || ''),
    status: 'Pendente',
    pagamentos: [],
    recebidoEm: '',
    ...(shared ? {
      compartilhado: true,
      parceiroIds: normalized.financeiroParceiroIds,
      parceiroId: normalized.financeiroParceiroIds[0] || '',
      compartilhadoRecebedor: normalized.financeiroRecebedor,
      compartilhadoMinhaParte: normalized.financeiroMinhaParte,
      compartilhadoPartesParceiros: normalized.financeiroPartesParceiros,
      compartilhadoParceiroParte: normalized.financeiroPartesParceiros[0]?.valor || 0,
      compartilhadoPersonalizado: true,
      compartilhadoAcertoStatus: 'Pendente',
      compartilhadoAcertoEm: '',
    } : {}),
  }

  return buildInstallmentCharges(base, normalized.financeiroParcelas, makeId)
}

export function processHasFinanceCharge(process = {}, finance = []) {
  return (finance || []).some(charge => String(charge.origemTipo || '').toLowerCase() === 'processo'
    && String(charge.origemId || '') === String(process.id || '')
    && String(charge.status || '').toLowerCase() !== 'cancelado')
}
