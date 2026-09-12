const clone = value => value == null ? value : structuredClone(value)
const unique = values => [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))]

const INTERNAL_ROLES = new Set(['admin', 'collaborator'])
const WORK_VISIBILITY_ALL = 'all_allowed'
const WORK_VISIBILITY_MINE = 'mine_and_unassigned'

const OFFICE_KEYS = {
  clients: 'med_clientes',
  linkedCompanies: 'med_cnpjs_vinculados',
  partners: 'med_parceiros_trabalho',
  tasks: 'med_tarefas',
  taskTemplates: 'med_tarefas_modelos',
  processes: 'med_processos',
  obligations: 'med_obrigacoes',
  processModels: 'med_processos_modelos',
  finance: 'med_financeiro',
  financeAccounts: 'med_financeiro_contas',
  financePayables: 'med_financeiro_pagar',
  financeMovements: 'med_financeiro_movimentos',
  financeCategories: 'med_financeiro_categorias',
  financeRecurrences: 'med_financeiro_recorrencias',
  financeClosings: 'med_financeiro_fechamentos',
  financeCollectionEvents: 'med_financeiro_cobrancas_eventos',
  financeConfig: 'med_financeiro_configuracoes',
  settings: 'med_configuracoes',
  departments: 'med_departamentos',
  ui: 'med_preferencias',
  history: 'med_historico_painel',
  meta: 'med_meta',
  lastBackup: 'med_last_backup',
}

const recordKey = (name, record = {}) => name === 'departments'
  ? String(record.name || '')
  : name === 'financeClosings'
    ? String(record.competencia || record.id || '')
    : String(record.id || '')

function workspaceOwnerId(membership = {}) {
  return String(
    membership?.office_workspaces?.owner_user_id ||
    membership?.workspace?.owner_user_id ||
    membership?.owner_user_id ||
    '',
  )
}

export function isOwnerMembership(membership = {}) {
  const ownerId = workspaceOwnerId(membership)
  const userId = String(membership?.user_id || '')
  return Boolean(ownerId && userId && ownerId === userId)
}

export function isInternalV2Membership(membership = {}) {
  if (!INTERNAL_ROLES.has(String(membership?.role || ''))) return false
  if (isOwnerMembership(membership)) return false
  return membership?.permissions?.access_v2 === true
}

export function internalV2Permissions(membership = {}) {
  const raw = membership?.permissions || {}
  const role = String(membership?.role || 'collaborator')
  const financeReceivables = Boolean(raw.finance_receivables)
  const financePayables = Boolean(raw.finance_payables)
  const financeCash = Boolean(raw.finance_cash)
  const financeReports = Boolean(raw.finance_reports)
  return {
    access_v2: true,
    client_ids: unique(raw.client_ids),
    clients: Boolean(raw.clients),
    tasks: Boolean(raw.tasks),
    processes: Boolean(raw.processes),
    obligations: Boolean(raw.obligations),
    manage_clients: Boolean(raw.clients && raw.manage_clients),
    work_visibility: raw.work_visibility === WORK_VISIBILITY_ALL ? WORK_VISIBILITY_ALL : WORK_VISIBILITY_MINE,
    finance_receivables: financeReceivables,
    finance_payables: financePayables,
    finance_cash: financeCash,
    finance_reports: financeReports,
    finance: financeReceivables,
    finance_edit: financeReceivables || financePayables || financeCash,
    team: role === 'admin',
    delete_records: role === 'admin',
  }
}

export function defaultInternalV2Permissions(role = 'collaborator') {
  return {
    access_v2: true,
    client_ids: [],
    clients: false,
    tasks: false,
    processes: false,
    obligations: false,
    manage_clients: false,
    work_visibility: WORK_VISIBILITY_MINE,
    finance: false,
    finance_edit: false,
    finance_receivables: false,
    finance_payables: false,
    finance_cash: false,
    finance_reports: false,
    team: role === 'admin',
    delete_records: role === 'admin',
  }
}

function clientIdFromRecord(record = {}) {
  return String(record.clientId || record.clienteId || record.cliente_id || '')
}

function allowedClientSet(membership = {}) {
  return new Set(internalV2Permissions(membership).client_ids)
}

function workVisible(record = {}, membership = {}) {
  const permissions = internalV2Permissions(membership)
  if (permissions.work_visibility === WORK_VISIBILITY_ALL) return true
  const responsible = String(record.responsavelUserId || '')
  const userId = String(membership.user_id || '')
  return !responsible || Boolean(userId && responsible === userId)
}

function recordInAllowedPortfolio(record = {}, membership = {}, { allowInternal = false } = {}) {
  const clientId = clientIdFromRecord(record)
  if (!clientId) return Boolean(allowInternal)
  return allowedClientSet(membership).has(clientId)
}

function minimalClient(client = {}) {
  const next = {
    id: client.id,
    razao: client.razao,
    nome: client.nome,
    fantasia: client.fantasia,
    documento: client.documento,
    cnpj: client.cnpj,
    cpf: client.cpf,
    status: client.status,
  }
  return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined))
}

function minimalSettings(settings = {}) {
  return {
    office: settings.office || 'Meu Escritório',
    system: settings.system || 'Meu Escritório Digital',
    visual: settings.visual || 'macos',
  }
}

function filterObligations(obligations = [], membership = {}) {
  const allowed = allowedClientSet(membership)
  return (Array.isArray(obligations) ? obligations : []).flatMap(obligation => {
    const links = (Array.isArray(obligation.clientes) ? obligation.clientes : []).filter(link => {
      const clientId = String(link.clienteId || '')
      return allowed.has(clientId) && workVisible(link, membership)
    })
    return links.length ? [{ ...clone(obligation), clientes: links }] : []
  })
}

export function filterInternalV2Payload(payload = {}, membership = {}) {
  if (!isInternalV2Membership(membership)) return clone(payload) || {}
  const permissions = internalV2Permissions(membership)
  const next = clone(payload) || {}
  const allClients = Array.isArray(payload.med_clientes) ? payload.med_clientes : []
  const allowed = new Set(permissions.client_ids)
  const allowedClients = allClients.filter(client => allowed.has(String(client.id)))
  const allCurrentClientsAllowed = allClients.every(client => allowed.has(String(client.id)))

  next.med_clientes = allowedClients.map(client => permissions.clients ? clone(client) : minimalClient(client))
  next.med_cnpjs_vinculados = permissions.clients
    ? (Array.isArray(payload.med_cnpjs_vinculados) ? payload.med_cnpjs_vinculados : []).filter(record => allowed.has(clientIdFromRecord(record)))
    : []
  next.med_parceiros_trabalho = []

  next.med_tarefas = permissions.tasks
    ? (Array.isArray(payload.med_tarefas) ? payload.med_tarefas : []).filter(task => recordInAllowedPortfolio(task, membership, { allowInternal: true }) && workVisible(task, membership))
    : []
  next.med_tarefas_modelos = permissions.tasks && membership.role === 'admin' ? clone(payload.med_tarefas_modelos || []) : []

  next.med_processos = permissions.processes
    ? (Array.isArray(payload.med_processos) ? payload.med_processos : []).filter(process => recordInAllowedPortfolio(process, membership) && workVisible(process, membership))
    : []
  next.med_processos_modelos = permissions.processes && membership.role === 'admin' ? clone(payload.med_processos_modelos || []) : []

  next.med_obrigacoes = permissions.obligations ? filterObligations(payload.med_obrigacoes, membership) : []

  next.med_financeiro = permissions.finance_receivables
    ? (Array.isArray(payload.med_financeiro) ? payload.med_financeiro : []).filter(charge => allowed.has(String(charge.clienteId || '')))
    : []
  next.med_financeiro_cobrancas_eventos = permissions.finance_receivables
    ? (Array.isArray(payload.med_financeiro_cobrancas_eventos) ? payload.med_financeiro_cobrancas_eventos : []).filter(event => {
        const directClient = clientIdFromRecord(event)
        if (directClient) return allowed.has(directClient)
        const chargeId = String(event.cobrancaId || event.financeId || event.receivableId || '')
        if (!chargeId) return false
        return next.med_financeiro.some(charge => String(charge.id) === chargeId)
      })
    : []
  next.med_financeiro_pagar = permissions.finance_payables ? clone(payload.med_financeiro_pagar || []) : []
  next.med_financeiro_contas = permissions.finance_cash ? clone(payload.med_financeiro_contas || []) : []
  next.med_financeiro_movimentos = permissions.finance_cash ? clone(payload.med_financeiro_movimentos || []) : []
  next.med_financeiro_categorias = (permissions.finance_receivables || permissions.finance_payables || permissions.finance_cash || permissions.finance_reports)
    ? clone(payload.med_financeiro_categorias || [])
    : []
  next.med_financeiro_recorrencias = []
  next.med_financeiro_fechamentos = permissions.finance_reports && allCurrentClientsAllowed ? clone(payload.med_financeiro_fechamentos || []) : []
  next.med_financeiro_configuracoes = permissions.finance_cash && allCurrentClientsAllowed ? clone(payload.med_financeiro_configuracoes || {}) : {}

  next.med_configuracoes = minimalSettings(payload.med_configuracoes || {})
  next.med_departamentos = clone(payload.med_departamentos || [])
  next.med_preferencias = {}
  next.med_historico_painel = []
  next.med_last_backup = ''
  next.med_meta = clone(payload.med_meta || { version: '11.1' })
  return next
}

function auditEntry(name, id, action = 'update') {
  const labels = {
    clients: 'cliente', linkedCompanies: 'empresa vinculada', tasks: 'tarefa', taskTemplates: 'modelo de tarefa',
    processes: 'processo', obligations: 'obrigação', processModels: 'modelo de processo', finance: 'cobrança',
    financeAccounts: 'conta financeira', financePayables: 'conta a pagar', financeMovements: 'movimentação financeira',
    financeCollectionEvents: 'contato de cobrança',
  }
  return { action, entity_type: name, entity_id: String(id || ''), summary: `${labels[name] || name} ${action === 'delete' ? 'removido(a)' : 'alterado(a)'}` }
}

function canOperateWork(record = {}, membership = {}, { allowInternal = false } = {}) {
  return recordInAllowedPortfolio(record, membership, { allowInternal }) && workVisible(record, membership)
}

function safeResponsibleValue(incoming = {}, existing = {}, membership = {}) {
  if (membership.role === 'admin') return incoming
  if (!Object.prototype.hasOwnProperty.call(incoming, 'responsavelUserId')) return incoming
  const requested = String(incoming.responsavelUserId || '')
  const userId = String(membership.user_id || '')
  if (!requested || requested === userId) return incoming
  return { ...incoming, responsavelUserId: existing.responsavelUserId || '' }
}

function mergeCollection(records = [], change = {}, name = '', membership = {}, canTouch = () => false, normalizeIncoming = value => value) {
  const map = new Map((Array.isArray(records) ? records : []).map(record => [recordKey(name, record), clone(record)]).filter(([key]) => key))
  const audit = []
  const allowDelete = membership.role === 'admin'

  for (const rawIncoming of Array.isArray(change?.upserts) ? change.upserts : []) {
    const key = recordKey(name, rawIncoming)
    if (!key) continue
    const existing = map.get(key)
    if (existing) {
      if (!canTouch(existing, false)) continue
      const incoming = normalizeIncoming(clone(rawIncoming), existing)
      map.set(key, incoming)
      audit.push(auditEntry(name, key))
      continue
    }
    if (!canTouch(rawIncoming, true)) continue
    const incoming = normalizeIncoming(clone(rawIncoming), {})
    map.set(key, incoming)
    audit.push(auditEntry(name, key, 'upsert'))
  }

  if (allowDelete) {
    for (const key of Array.isArray(change?.deletes) ? change.deletes : []) {
      const existing = map.get(String(key))
      if (!existing || !canTouch(existing, false)) continue
      map.delete(String(key))
      audit.push(auditEntry(name, key, 'delete'))
    }
  }
  return { records: [...map.values()], audit }
}

function patchObligations(payload = {}, change = {}, membership = {}) {
  const allowed = allowedClientSet(membership)
  const map = new Map((Array.isArray(payload.med_obrigacoes) ? payload.med_obrigacoes : []).map(item => [String(item.id), clone(item)]))
  const audit = []
  const canDelete = membership.role === 'admin'

  for (const incoming of Array.isArray(change?.upserts) ? change.upserts : []) {
    const id = String(incoming.id || '')
    if (!id) continue
    const existing = map.get(id)
    if (!existing) {
      const links = Array.isArray(incoming.clientes) ? incoming.clientes : []
      if (!links.length || !links.every(link => allowed.has(String(link.clienteId || '')) && workVisible(link, membership))) continue
      map.set(id, clone(incoming))
      audit.push(auditEntry('obligations', id, 'upsert'))
      continue
    }

    const existingLinks = Array.isArray(existing.clientes) ? existing.clientes : []
    const incomingByClient = new Map((Array.isArray(incoming.clientes) ? incoming.clientes : []).map(link => [String(link.clienteId || ''), link]))
    let touched = false
    const mergedLinks = existingLinks.map(link => {
      const clientId = String(link.clienteId || '')
      const source = incomingByClient.get(clientId)
      if (!source || !allowed.has(clientId) || !workVisible(link, membership)) return link
      touched = true
      return safeResponsibleValue(clone(source), link, membership)
    })
    if (!touched) continue

    const allExistingLinksAllowed = existingLinks.every(link => allowed.has(String(link.clienteId || '')) && workVisible(link, membership))
    const base = allExistingLinksAllowed ? { ...clone(incoming), id } : { ...existing }
    base.clientes = mergedLinks
    map.set(id, base)
    audit.push(auditEntry('obligations', id))
  }

  if (canDelete) {
    for (const id of Array.isArray(change?.deletes) ? change.deletes : []) {
      const existing = map.get(String(id))
      if (!existing) continue
      const links = Array.isArray(existing.clientes) ? existing.clientes : []
      if (!links.length || !links.every(link => allowed.has(String(link.clienteId || '')) && workVisible(link, membership))) continue
      map.delete(String(id))
      audit.push(auditEntry('obligations', id, 'delete'))
    }
  }

  payload.med_obrigacoes = [...map.values()]
  return audit
}

function clientCanBeTouched(record = {}, membership = {}) {
  return allowedClientSet(membership).has(String(record.id || clientIdFromRecord(record)))
}

function canWriteFinanceName(name, permissions, membership) {
  if (name === 'finance' || name === 'financeCollectionEvents') return permissions.finance_receivables
  if (name === 'financePayables') return permissions.finance_payables
  if (name === 'financeAccounts' || name === 'financeMovements') return permissions.finance_cash
  if (name === 'financeCategories') return membership.role === 'admin' && (permissions.finance_receivables || permissions.finance_payables || permissions.finance_cash || permissions.finance_reports)
  return false
}

function financeCollectionEventAllowed(record = {}, payload = {}, membership = {}) {
  const allowed = allowedClientSet(membership)
  const directClient = clientIdFromRecord(record)
  if (directClient) return allowed.has(directClient)
  const chargeId = String(record.cobrancaId || record.financeId || record.receivableId || '')
  if (!chargeId) return false
  const charge = (Array.isArray(payload.med_financeiro) ? payload.med_financeiro : []).find(item => String(item.id || '') === chargeId)
  return Boolean(charge && allowed.has(String(charge.clienteId || '')))
}

export function applyInternalV2Patch(fullPayload = {}, patch = {}, membership = {}) {
  if (!isInternalV2Membership(membership)) return { payload: clone(fullPayload) || {}, audit: [] }
  const payload = clone(fullPayload) || {}
  const permissions = internalV2Permissions(membership)
  const audit = []

  for (const [name, change] of Object.entries(patch || {})) {
    const payloadKey = OFFICE_KEYS[name]
    if (!payloadKey || !change) continue

    if ((name === 'clients' || name === 'linkedCompanies') && permissions.clients && permissions.manage_clients) {
      const source = payload[payloadKey]
      const result = mergeCollection(source, change, name, membership, record => {
        if (name === 'clients') return clientCanBeTouched(record, membership)
        return allowedClientSet(membership).has(clientIdFromRecord(record))
      })
      payload[payloadKey] = result.records
      audit.push(...result.audit)
      continue
    }

    if ((name === 'tasks' || name === 'taskTemplates') && permissions.tasks) {
      if (name === 'taskTemplates') {
        if (membership.role !== 'admin') continue
        const result = mergeCollection(payload[payloadKey], change, name, membership, () => true)
        payload[payloadKey] = result.records; audit.push(...result.audit); continue
      }
      const result = mergeCollection(payload[payloadKey], change, name, membership,
        record => canOperateWork(record, membership, { allowInternal: true }),
        (incoming, existing) => safeResponsibleValue(incoming, existing, membership))
      payload[payloadKey] = result.records; audit.push(...result.audit); continue
    }

    if ((name === 'processes' || name === 'processModels') && permissions.processes) {
      if (name === 'processModels') {
        if (membership.role !== 'admin') continue
        const result = mergeCollection(payload[payloadKey], change, name, membership, () => true)
        payload[payloadKey] = result.records; audit.push(...result.audit); continue
      }
      const result = mergeCollection(payload[payloadKey], change, name, membership,
        record => canOperateWork(record, membership),
        (incoming, existing) => safeResponsibleValue(incoming, existing, membership))
      payload[payloadKey] = result.records; audit.push(...result.audit); continue
    }

    if (name === 'obligations' && permissions.obligations) {
      audit.push(...patchObligations(payload, change, membership))
      continue
    }

    if (canWriteFinanceName(name, permissions, membership)) {
      const result = mergeCollection(payload[payloadKey], change, name, membership, record => {
        if (name === 'finance') return allowedClientSet(membership).has(String(record.clienteId || ''))
        if (name === 'financeCollectionEvents') return financeCollectionEventAllowed(record, payload, membership)
        return true
      })
      payload[payloadKey] = result.records; audit.push(...result.audit); continue
    }

    if (name === 'history' && Array.isArray(change?.upserts)) {
      const result = mergeCollection(payload[payloadKey], { upserts: change.upserts, deletes: [] }, name, { ...membership, role: 'collaborator' }, () => true)
      payload[payloadKey] = result.records
      audit.push(...result.audit)
    }
  }

  return { payload, audit }
}

export function internalV2CanManageTeam(membership = {}) {
  return isOwnerMembership(membership) || (isInternalV2Membership(membership) && membership.role === 'admin')
}
