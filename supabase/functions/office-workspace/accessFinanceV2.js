import * as base from './accessLegacy.js'

export const ROLE_ADMIN = base.ROLE_ADMIN
export const ROLE_COLLABORATOR = base.ROLE_COLLABORATOR
export const ROLE_PARTNER = base.ROLE_PARTNER

const clone = value => value == null ? value : structuredClone(value)
const roleOf = membership => [ROLE_ADMIN, ROLE_COLLABORATOR, ROLE_PARTNER].includes(membership?.role) ? membership.role : ROLE_COLLABORATOR

export const DEFAULT_PERMISSIONS = {
  admin: {
    ...base.DEFAULT_PERMISSIONS.admin,
    finance_receivables: true,
    finance_payables: true,
    finance_cash: true,
    finance_reports: true,
  },
  collaborator: {
    ...base.DEFAULT_PERMISSIONS.collaborator,
    finance: false,
    finance_edit: false,
    finance_receivables: false,
    finance_payables: false,
    finance_cash: false,
    finance_reports: false,
  },
  partner: {
    ...base.DEFAULT_PERMISSIONS.partner,
    finance_receivables: false,
    finance_payables: false,
    finance_cash: false,
    finance_reports: false,
  },
}

export function permissionsFor(membership = {}) {
  const role = roleOf(membership)
  const raw = membership.permissions || {}
  const merged = { ...DEFAULT_PERMISSIONS[role], ...raw }
  if (role === ROLE_COLLABORATOR && raw.finance_receivables == null && raw.finance != null) merged.finance_receivables = Boolean(raw.finance)
  merged.finance = role === ROLE_ADMIN ? true : Boolean(merged.finance_receivables)
  merged.finance_edit = role === ROLE_ADMIN ? true : Boolean(merged.finance_receivables || merged.finance_payables || merged.finance_cash)
  return merged
}

function compatMembership(membership = {}) {
  const permissions = permissionsFor(membership)
  return { ...membership, permissions: { ...permissions, finance: Boolean(permissions.finance_receivables), finance_edit: Boolean(permissions.finance_receivables) } }
}

const FINANCE_V2_KEYS = {
  financeAccounts: 'med_financeiro_contas',
  financePayables: 'med_financeiro_pagar',
  financeMovements: 'med_financeiro_movimentos',
  financeCategories: 'med_financeiro_categorias',
  financeRecurrences: 'med_financeiro_recorrencias',
  financeClosings: 'med_financeiro_fechamentos',
  financeCollectionEvents: 'med_financeiro_cobrancas_eventos',
  financeConfig: 'med_financeiro_configuracoes',
}

function emptyFinanceV2(next = {}) {
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

export function filterPayloadForMembership(payload = {}, membership = {}) {
  const role = roleOf(membership)
  const permissions = permissionsFor(membership)
  const next = base.filterPayloadForMembership(payload, compatMembership(membership))
  if (role === ROLE_ADMIN) return next
  if (role === ROLE_PARTNER) return emptyFinanceV2(next)
  if (!permissions.finance_receivables) { next.med_financeiro = []; next.med_financeiro_cobrancas_eventos = [] }
  if (!permissions.finance_payables) next.med_financeiro_pagar = []
  if (!permissions.finance_cash) { next.med_financeiro_contas = []; next.med_financeiro_movimentos = [] }
  const anyFinance = permissions.finance_receivables || permissions.finance_payables || permissions.finance_cash || permissions.finance_reports
  if (!anyFinance) next.med_financeiro_categorias = []
  next.med_financeiro_recorrencias = []
  if (!permissions.finance_reports) next.med_financeiro_fechamentos = []
  if (!(permissions.finance_cash || permissions.finance_reports)) next.med_financeiro_configuracoes = {}
  return next
}

const arrayNames = new Set(['financeAccounts', 'financePayables', 'financeMovements', 'financeCategories', 'financeRecurrences', 'financeClosings', 'financeCollectionEvents'])
const recordKey = (name, record = {}) => name === 'financeClosings' ? String(record.competencia || record.id || '') : String(record.id || '')
function applyArrayPatch(records = [], change = {}, name = '', allowDelete = false) {
  const map = new Map((Array.isArray(records) ? records : []).map(item => [recordKey(name, item), clone(item)]).filter(([key]) => key))
  ;(Array.isArray(change.upserts) ? change.upserts : []).forEach(item => { const key = recordKey(name, item); if (key) map.set(key, clone(item)) })
  if (allowDelete) (Array.isArray(change.deletes) ? change.deletes : []).forEach(id => map.delete(String(id)))
  return [...map.values()]
}
function auditEntries(name, change = {}, allowDelete = false) {
  const labels = { financeAccounts: 'conta financeira', financePayables: 'conta a pagar', financeMovements: 'movimentação financeira', financeCategories: 'categoria financeira', financeRecurrences: 'recorrência financeira', financeClosings: 'fechamento financeiro', financeCollectionEvents: 'contato de cobrança', financeConfig: 'configuração financeira' }
  const result = []
  ;(change.upserts || []).forEach(item => result.push({ action: 'upsert', entity_type: name, entity_id: recordKey(name, item), summary: `${labels[name] || name} alterado(a)` }))
  if (allowDelete) (change.deletes || []).forEach(id => result.push({ action: 'delete', entity_type: name, entity_id: String(id), summary: `${labels[name] || name} removido(a)` }))
  return result
}
function canWriteFinanceV2(name, role, permissions) {
  if (role === ROLE_ADMIN) return true
  if (role !== ROLE_COLLABORATOR) return false
  if (name === 'financePayables') return Boolean(permissions.finance_payables)
  if (name === 'financeAccounts' || name === 'financeMovements') return Boolean(permissions.finance_cash)
  if (name === 'financeCollectionEvents') return Boolean(permissions.finance_receivables)
  return false
}

export function applyOfficePatch(fullPayload = {}, patch = {}, membership = {}) {
  const role = roleOf(membership)
  const permissions = permissionsFor(membership)
  const legacyPatch = { ...patch }
  Object.keys(FINANCE_V2_KEYS).forEach(name => delete legacyPatch[name])
  const baseResult = base.applyOfficePatch(fullPayload, legacyPatch, compatMembership(membership))
  const payload = baseResult.payload
  const audit = [...baseResult.audit]
  if (role === ROLE_PARTNER) return { payload, audit }
  for (const [name, payloadKey] of Object.entries(FINANCE_V2_KEYS)) {
    const change = patch?.[name]
    if (!change || !canWriteFinanceV2(name, role, permissions)) continue
    const allowDelete = role === ROLE_ADMIN || Boolean(permissions.delete_records)
    if (arrayNames.has(name)) {
      payload[payloadKey] = applyArrayPatch(payload[payloadKey], change, name, allowDelete)
      audit.push(...auditEntries(name, change, allowDelete))
    } else if (Object.prototype.hasOwnProperty.call(change || {}, 'replace')) {
      payload[payloadKey] = clone(change.replace)
      audit.push({ action: 'update', entity_type: name, entity_id: '', summary: 'configuração financeira atualizada' })
    }
  }
  return { payload, audit }
}

export const memberCanSeeTeam = base.memberCanSeeTeam
export const clientPartnerIds = base.clientPartnerIds
export const partnerCanAccessWork = base.partnerCanAccessWork
