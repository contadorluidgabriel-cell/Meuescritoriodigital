const unique = values => [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))]
const clone = value => value == null ? value : structuredClone(value)

export const ROLE_ADMIN = 'admin'
export const ROLE_COLLABORATOR = 'collaborator'
export const ROLE_PARTNER = 'partner'

export const DEFAULT_PERMISSIONS = {
  admin: {
    clients: true, tasks: true, processes: true, obligations: true,
    finance: true, finance_edit: true, finance_receivables: true, finance_payables: true, finance_cash: true, finance_reports: true,
    team: true, delete_records: true, manage_clients: true,
  },
  collaborator: {
    clients: true, tasks: true, processes: true, obligations: true,
    finance: false, finance_edit: false, finance_receivables: false, finance_payables: false, finance_cash: false, finance_reports: false,
    team: false, delete_records: false, manage_clients: false,
  },
  partner: {
    clients: true, tasks: true, processes: true, obligations: true,
    finance_shared: true, finance_receivables: false, finance_payables: false, finance_cash: false, finance_reports: false,
    team: false, delete_records: false, manage_clients: false,
  },
}

function roleOf(membership = {}) {
  return [ROLE_ADMIN, ROLE_COLLABORATOR, ROLE_PARTNER].includes(membership.role) ? membership.role : ROLE_COLLABORATOR
}

export function permissionsFor(membership = {}) {
  const role = roleOf(membership)
  const raw = membership.permissions || {}
  const permissions = { ...DEFAULT_PERMISSIONS[role], ...raw }
  if (role === ROLE_COLLABORATOR && raw.finance_receivables == null && raw.finance != null) {
    permissions.finance_receivables = Boolean(raw.finance)
  }
  permissions.finance = role === ROLE_ADMIN ? true : Boolean(permissions.finance_receivables)
  permissions.finance_edit = role === ROLE_ADMIN ? true : Boolean(raw.finance_edit)
  return permissions
}

export function clientPartnerIds(client = {}) {
  return unique([...(Array.isArray(client.parceiroIds) ? client.parceiroIds : []), client.parceiroId])
}

function responsibilityFor(client = {}, department = '') {
  if (client.perfilAtendimento !== 'Compartilhado') return { responsavel: 'Escritorio', parceiroId: '' }
  const ids = clientPartnerIds(client)
  const raw = client.responsabilidadesCompartilhadas?.[department]
  if (!raw) return { responsavel: 'Escritorio', parceiroId: '' }
  const item = typeof raw === 'string' ? { responsavel: raw, parceiroId: '' } : raw
  const responsavel = ['Escritorio', 'Parceiro', 'Ambos'].includes(item?.responsavel) ? item.responsavel : 'Escritorio'
  const parceiroId = ids.includes(String(item?.parceiroId || '')) ? String(item.parceiroId) : (ids[0] || '')
  return { responsavel, parceiroId: responsavel === 'Escritorio' ? '' : parceiroId }
}

export function partnerCanAccessWork(record = {}, client = {}, partnerId = '', department = '') {
  const target = String(partnerId || '')
  if (!target || !clientPartnerIds(client).includes(target)) return false
  const fallback = responsibilityFor(client, department || record.departamento || record.categoria || '')
  const responsavel = ['Escritorio', 'Parceiro', 'Ambos'].includes(record.compartilhadoResponsavel)
    ? record.compartilhadoResponsavel
    : fallback.responsavel
  const selectedPartner = String(record.compartilhadoParceiroId || fallback.parceiroId || '')
  return (responsavel === 'Parceiro' || responsavel === 'Ambos') && selectedPartner === target
}

function sanitizePartnerClient(client = {}) {
  const next = clone(client) || {}
  ;[
    'mensalidade', 'honorario', 'honorariosHistorico', 'compartilhadoMinhaParte',
    'compartilhadoPartesParceiros', 'compartilhadoParceiroParte', 'compartilhadoRecebedor',
  ].forEach(key => delete next[key])
  return next
}

function receivableSummary(charge = {}) {
  const payments = Array.isArray(charge.pagamentos) ? charge.pagamentos : []
  const total = Math.max(0, Number(charge.valor || 0))
  const received = payments.reduce((sum, payment) => sum + Number(payment.valorRecebido || payment.valor || 0), 0)
  const discounts = payments.reduce((sum, payment) => sum + Number(payment.desconto || 0), 0)
  const surcharges = payments.reduce((sum, payment) => sum + Number(payment.acrescimo || 0), 0)
  const applied = Math.max(0, received + discounts - surcharges)
  return { received, balance: Math.max(0, total - applied) }
}

function partnerShare(charge = {}, client = {}, partnerId = '') {
  const target = String(partnerId || '')
  const source = Array.isArray(charge.compartilhadoPartesParceiros) && charge.compartilhadoPartesParceiros.length
    ? charge.compartilhadoPartesParceiros
    : Array.isArray(client.compartilhadoPartesParceiros) ? client.compartilhadoPartesParceiros : []
  const direct = source.find(item => String(item?.parceiroId || '') === target)
  if (direct) return Math.max(0, Number(direct.valor || 0))
  if (String(charge.parceiroId || client.parceiroId || '') === target) {
    return Math.max(0, Number(charge.compartilhadoParceiroParte ?? client.compartilhadoParceiroParte ?? 0))
  }
  return 0
}

function sanitizePartnerFinance(charge = {}, client = {}, partnerId = '') {
  const summary = receivableSummary(charge)
  const share = partnerShare(charge, client, partnerId)
  return {
    id: charge.id,
    clienteId: charge.clienteId,
    descricao: charge.descricao || 'Cobrança compartilhada',
    competencia: charge.competencia || '',
    vencimento: charge.vencimento || '',
    valor: Number(charge.valor || 0),
    status: charge.status || '',
    recebidoEm: charge.recebidoEm || '',
    saldo: summary.balance,
    compartilhado: true,
    parceiroId: String(partnerId || ''),
    parceiroIds: [String(partnerId || '')],
    compartilhadoMinhaParte: Number(charge.compartilhadoMinhaParte ?? client.compartilhadoMinhaParte ?? 0),
    compartilhadoPartesParceiros: [{ parceiroId: String(partnerId || ''), valor: share }],
    compartilhadoParceiroParte: share,
    compartilhadoRecebedor: charge.compartilhadoRecebedor || client.compartilhadoRecebedor || 'Escritorio',
    compartilhadoAcertoStatus: charge.compartilhadoAcertoStatus || 'Pendente',
    compartilhadoAcertoEm: charge.compartilhadoAcertoEm || '',
    compartilhadoObservacao: charge.compartilhadoObservacao || '',
    pagamentos: summary.received > 0 ? [{ data: charge.recebidoEm || '', valorRecebido: summary.received }] : [],
  }
}

function linkedCompanyClientId(record = {}) {
  return String(record.clienteId || record.clientId || record.cliente_id || '')
}

function clearFinanceV2(next = {}) {
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
  if (role === ROLE_ADMIN) return clone(payload) || {}

  const next = clone(payload) || {}
  if (role === ROLE_COLLABORATOR) {
    if (!permissions.clients) next.med_clientes = []
    if (!permissions.tasks) { next.med_tarefas = []; next.med_tarefas_modelos = [] }
    if (!permissions.processes) { next.med_processos = []; next.med_processos_modelos = [] }
    if (!permissions.obligations) next.med_obrigacoes = []

    if (!permissions.finance_receivables) {
      next.med_financeiro = []
      next.med_financeiro_cobrancas_eventos = []
    }
    if (!permissions.finance_payables) next.med_financeiro_pagar = []
    if (!permissions.finance_cash) {
      next.med_financeiro_contas = []
      next.med_financeiro_movimentos = []
    }
    const anyFinance = permissions.finance_receivables || permissions.finance_payables || permissions.finance_cash || permissions.finance_reports
    if (!anyFinance) next.med_financeiro_categorias = []
    next.med_financeiro_recorrencias = []
    if (!permissions.finance_reports) next.med_financeiro_fechamentos = []
    if (!(permissions.finance_cash || permissions.finance_reports)) next.med_financeiro_configuracoes = {}

    next.med_preferencias = {}
    next.med_last_backup = ''
    return next
  }

  const partnerId = String(membership.partner_id || '')
  const clients = Array.isArray(payload.med_clientes) ? payload.med_clientes : []
  const allowedClients = clients.filter(client => clientPartnerIds(client).includes(partnerId))
  const allowedClientIds = new Set(allowedClients.map(client => String(client.id)))
  const clientsById = new Map(clients.map(client => [String(client.id), client]))

  next.med_clientes = allowedClients.map(sanitizePartnerClient)
  next.med_cnpjs_vinculados = (Array.isArray(payload.med_cnpjs_vinculados) ? payload.med_cnpjs_vinculados : [])
    .filter(record => allowedClientIds.has(linkedCompanyClientId(record)))
  next.med_parceiros_trabalho = (Array.isArray(payload.med_parceiros_trabalho) ? payload.med_parceiros_trabalho : [])
    .filter(partner => String(partner.id) === partnerId)

  next.med_tarefas = (Array.isArray(payload.med_tarefas) ? payload.med_tarefas : []).filter(task => {
    const client = clientsById.get(String(task.clientId || ''))
    return client && partnerCanAccessWork(task, client, partnerId, task.departamento || '')
  })
  next.med_tarefas_modelos = []
  next.med_processos = (Array.isArray(payload.med_processos) ? payload.med_processos : []).filter(process => {
    const client = clientsById.get(String(process.clientId || ''))
    return client && partnerCanAccessWork(process, client, partnerId, process.departamento || 'Societário')
  })
  next.med_processos_modelos = []
  next.med_obrigacoes = (Array.isArray(payload.med_obrigacoes) ? payload.med_obrigacoes : []).flatMap(obligation => {
    const links = (Array.isArray(obligation.clientes) ? obligation.clientes : []).filter(link => {
      const client = clientsById.get(String(link.clienteId || ''))
      return client && partnerCanAccessWork(link, client, partnerId, obligation.categoria || '')
    })
    return links.length ? [{ ...clone(obligation), clientes: links }] : []
  })

  next.med_financeiro = permissions.finance_shared === false ? [] : (Array.isArray(payload.med_financeiro) ? payload.med_financeiro : []).flatMap(charge => {
    const client = clientsById.get(String(charge.clienteId || ''))
    if (!client || !allowedClientIds.has(String(charge.clienteId || ''))) return []
    const chargePartnerIds = unique([
      ...(Array.isArray(charge.parceiroIds) ? charge.parceiroIds : []),
      charge.parceiroId,
      ...(Array.isArray(charge.compartilhadoPartesParceiros) ? charge.compartilhadoPartesParceiros.map(item => item?.parceiroId) : []),
    ])
    if (!chargePartnerIds.includes(partnerId) && partnerShare(charge, client, partnerId) <= 0) return []
    return [sanitizePartnerFinance(charge, client, partnerId)]
  })
  clearFinanceV2(next)

  const settings = payload.med_configuracoes || {}
  next.med_configuracoes = {
    office: settings.office || 'Meu Escritório',
    system: settings.system || 'Meu Escritório Digital',
    visual: settings.visual || 'macos',
  }
  next.med_departamentos = clone(payload.med_departamentos || [])
  next.med_preferencias = {}
  next.med_historico_painel = []
  next.med_last_backup = ''
  next.med_meta = clone(payload.med_meta || { version: '11.1' })
  return next
}

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
const ARRAY_KEYS = new Set([
  'clients', 'linkedCompanies', 'partners', 'tasks', 'taskTemplates', 'processes', 'obligations', 'processModels', 'finance',
  'financeAccounts', 'financePayables', 'financeMovements', 'financeCategories', 'financeRecurrences', 'financeClosings', 'financeCollectionEvents',
  'departments', 'history',
])
const keyForRecord = (name, record = {}) => name === 'departments'
  ? String(record.name || '')
  : name === 'financeClosings'
    ? String(record.competencia || record.id || '')
    : String(record.id || '')

function applyArrayPatch(records = [], change = {}, name = '', allowDelete = true) {
  const map = new Map((Array.isArray(records) ? records : []).map(item => [keyForRecord(name, item), clone(item)]).filter(([key]) => key))
  ;(Array.isArray(change.upserts) ? change.upserts : []).forEach(item => {
    const key = keyForRecord(name, item)
    if (key) map.set(key, clone(item))
  })
  if (allowDelete) (Array.isArray(change.deletes) ? change.deletes : []).forEach(id => map.delete(String(id)))
  return [...map.values()]
}

function patchAudit(name, change = {}, allowDelete = true) {
  const labels = {
    clients: 'cliente', linkedCompanies: 'empresa terceirizada', partners: 'parceiro', tasks: 'tarefa', taskTemplates: 'modelo de tarefa',
    processes: 'processo', obligations: 'obrigação', processModels: 'modelo de processo', finance: 'cobrança',
    financeAccounts: 'conta financeira', financePayables: 'conta a pagar', financeMovements: 'movimentação financeira',
    financeCategories: 'categoria financeira', financeRecurrences: 'recorrência financeira', financeClosings: 'fechamento financeiro',
    financeCollectionEvents: 'contato de cobrança', departments: 'departamento', history: 'histórico',
  }
  const entity = labels[name] || name
  const result = []
  ;(change.upserts || []).forEach(item => result.push({ action: 'upsert', entity_type: name, entity_id: keyForRecord(name, item), summary: `${entity} alterado(a)` }))
  if (allowDelete) (change.deletes || []).forEach(id => result.push({ action: 'delete', entity_type: name, entity_id: String(id), summary: `${entity} removido(a)` }))
  return result
}

function mergeAllowedFields(target = {}, incoming = {}, fields = []) {
  const next = clone(target) || {}
  fields.forEach(field => { if (field in incoming) next[field] = clone(incoming[field]) })
  return next
}

function partnerPatchTasks(payload, change, membership) {
  const partnerId = String(membership.partner_id || '')
  const clients = new Map((Array.isArray(payload.med_clientes) ? payload.med_clientes : []).map(client => [String(client.id), client]))
  const map = new Map((Array.isArray(payload.med_tarefas) ? payload.med_tarefas : []).map(item => [String(item.id), clone(item)]))
  const audit = []
  const fields = ['status', 'observacao', 'observacoes', 'quantidadeConcluida', 'subtarefas', 'planejadoPara', 'updatedAt']
  ;(change?.upserts || []).forEach(incoming => {
    const existing = map.get(String(incoming.id || ''))
    if (!existing) return
    const client = clients.get(String(existing.clientId || ''))
    if (!client || !partnerCanAccessWork(existing, client, partnerId, existing.departamento || '')) return
    map.set(String(existing.id), mergeAllowedFields(existing, incoming, fields))
    audit.push({ action: 'update', entity_type: 'tasks', entity_id: String(existing.id), summary: 'tarefa atualizada pelo parceiro' })
  })
  payload.med_tarefas = [...map.values()]
  return audit
}

function partnerPatchProcesses(payload, change, membership) {
  const partnerId = String(membership.partner_id || '')
  const clients = new Map((Array.isArray(payload.med_clientes) ? payload.med_clientes : []).map(client => [String(client.id), client]))
  const map = new Map((Array.isArray(payload.med_processos) ? payload.med_processos : []).map(item => [String(item.id), clone(item)]))
  const audit = []
  const fields = ['status', 'observacao', 'observacoes', 'protocolo', 'dataConclusao', 'etapas', 'updatedAt']
  ;(change?.upserts || []).forEach(incoming => {
    const existing = map.get(String(incoming.id || ''))
    if (!existing) return
    const client = clients.get(String(existing.clientId || ''))
    if (!client || !partnerCanAccessWork(existing, client, partnerId, existing.departamento || 'Societário')) return
    map.set(String(existing.id), mergeAllowedFields(existing, incoming, fields))
    audit.push({ action: 'update', entity_type: 'processes', entity_id: String(existing.id), summary: 'processo atualizado pelo parceiro' })
  })
  payload.med_processos = [...map.values()]
  return audit
}

function partnerPatchObligations(payload, change, membership) {
  const partnerId = String(membership.partner_id || '')
  const clients = new Map((Array.isArray(payload.med_clientes) ? payload.med_clientes : []).map(client => [String(client.id), client]))
  const map = new Map((Array.isArray(payload.med_obrigacoes) ? payload.med_obrigacoes : []).map(item => [String(item.id), clone(item)]))
  const audit = []
  const fields = ['status', 'observacao', 'observacoes', 'concluidoEm', 'updatedAt']
  ;(change?.upserts || []).forEach(incoming => {
    const existing = map.get(String(incoming.id || ''))
    if (!existing) return
    const incomingLinks = new Map((Array.isArray(incoming.clientes) ? incoming.clientes : []).map(link => [String(link.clienteId), link]))
    let touched = false
    existing.clientes = (Array.isArray(existing.clientes) ? existing.clientes : []).map(link => {
      const source = incomingLinks.get(String(link.clienteId || ''))
      const client = clients.get(String(link.clienteId || ''))
      if (!source || !client || !partnerCanAccessWork(link, client, partnerId, existing.categoria || '')) return link
      touched = true
      return mergeAllowedFields(link, source, fields)
    })
    if (touched) {
      map.set(String(existing.id), existing)
      audit.push({ action: 'update', entity_type: 'obligations', entity_id: String(existing.id), summary: 'obrigação atualizada pelo parceiro' })
    }
  })
  payload.med_obrigacoes = [...map.values()]
  return audit
}

function collaboratorCanWrite(name, permissions) {
  if (name === 'clients' || name === 'linkedCompanies') return Boolean(permissions.clients && permissions.manage_clients)
  if (name === 'tasks' || name === 'taskTemplates') return Boolean(permissions.tasks)
  if (name === 'processes' || name === 'processModels') return Boolean(permissions.processes)
  if (name === 'obligations') return Boolean(permissions.obligations)
  if (name === 'history') return true
  if (!permissions.finance_edit) return false
  if (name === 'finance' || name === 'financeCollectionEvents') return Boolean(permissions.finance_receivables)
  if (name === 'financePayables') return Boolean(permissions.finance_payables)
  if (name === 'financeAccounts' || name === 'financeMovements') return Boolean(permissions.finance_cash)
  return false
}

export function applyOfficePatch(fullPayload = {}, patch = {}, membership = {}) {
  const payload = clone(fullPayload) || {}
  const role = roleOf(membership)
  const permissions = permissionsFor(membership)
  const audit = []

  if (role === ROLE_PARTNER) {
    if (patch.tasks) audit.push(...partnerPatchTasks(payload, patch.tasks, membership))
    if (patch.processes) audit.push(...partnerPatchProcesses(payload, patch.processes, membership))
    if (patch.obligations) audit.push(...partnerPatchObligations(payload, patch.obligations, membership))
    return { payload, audit }
  }

  for (const [name, change] of Object.entries(patch || {})) {
    const payloadKey = OFFICE_KEYS[name]
    if (!payloadKey) continue
    const allowed = role === ROLE_ADMIN || (role === ROLE_COLLABORATOR && collaboratorCanWrite(name, permissions))
    if (!allowed) continue

    if (ARRAY_KEYS.has(name)) {
      const allowDelete = role === ROLE_ADMIN || Boolean(permissions.delete_records)
      payload[payloadKey] = applyArrayPatch(payload[payloadKey], change, name, allowDelete)
      audit.push(...patchAudit(name, change, allowDelete))
      continue
    }
    if (Object.prototype.hasOwnProperty.call(change || {}, 'replace')) {
      payload[payloadKey] = clone(change.replace)
      audit.push({ action: 'update', entity_type: name, entity_id: '', summary: `${name} atualizado` })
    }
  }
  return { payload, audit }
}

export function memberCanSeeTeam(membership = {}) {
  return roleOf(membership) === ROLE_ADMIN && permissionsFor(membership).team !== false
}
