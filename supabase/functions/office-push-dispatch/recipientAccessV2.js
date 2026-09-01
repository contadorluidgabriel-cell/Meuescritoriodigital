import { filterPushPayload as legacyFilter } from './recipientAccessLegacy.js'

const clearGeneralFinance = next => {
  next.med_financeiro_contas = []
  next.med_financeiro_pagar = []
  next.med_financeiro_movimentos = []
  next.med_financeiro_categorias = []
  next.med_financeiro_recorrencias = []
  next.med_financeiro_fechamentos = []
  next.med_financeiro_cobrancas_eventos = []
  next.med_financeiro_configuracoes = {}
  return next
}

export function filterPushPayload(payload = {}, membership = {}, userId = '') {
  const role = membership?.role || 'admin'
  if (role === 'admin') return structuredClone(payload) || {}
  const raw = membership.permissions || {}
  const receive = Boolean(raw.finance_receivables ?? raw.finance)
  const patchedMembership = { ...membership, permissions: { ...raw, finance: receive } }
  const next = legacyFilter(payload, patchedMembership, userId)
  if (role === 'partner') return clearGeneralFinance(next)
  if (!receive) {
    next.med_financeiro = []
    next.med_financeiro_cobrancas_eventos = []
  }
  if (!raw.finance_payables) next.med_financeiro_pagar = []
  if (!raw.finance_cash) {
    next.med_financeiro_contas = []
    next.med_financeiro_movimentos = []
  }
  const anyFinance = receive || raw.finance_payables || raw.finance_cash || raw.finance_reports
  if (!anyFinance) next.med_financeiro_categorias = []
  next.med_financeiro_recorrencias = []
  if (!raw.finance_reports) next.med_financeiro_fechamentos = []
  if (!(raw.finance_cash || raw.finance_reports)) next.med_financeiro_configuracoes = {}
  return next
}
