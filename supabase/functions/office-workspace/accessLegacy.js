const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const unique = values => [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))]
const clone = value => value == null ? value : structuredClone(value)

export const ROLE_ADMIN = 'admin'
export const ROLE_COLLABORATOR = 'collaborator'
export const ROLE_PARTNER = 'partner'

export const DEFAULT_PERMISSIONS = {
  admin: { clients: true, tasks: true, processes: true, obligations: true, finance: true, finance_edit: true, team: true, delete_records: true, manage_clients: true },
  collaborator: { clients: true, tasks: true, processes: true, obligations: true, finance: false, finance_edit: false, team: false, delete_records: false, manage_clients: false },
  partner: { clients: true, tasks: true, processes: true, obligations: true, finance_shared: true, team: false, delete_records: false, manage_clients: false },
}

export function permissionsFor(membership = {}) {
  const role = [ROLE_ADMIN, ROLE_COLLABORATOR, ROLE_PARTNER].includes(membership.role) ? membership.role : ROLE_COLLABORATOR
  return { ...DEFAULT_PERMISSIONS[role], ...(membership.permissions || {}) }
}

export function clientPartnerIds(client = {}) {
  return unique([...(Array.isArray(client.parceiroIds) ? client.parceiroIds : []), client.parceiroId])
}

function responsibilityFor(client = {}, department = '') {
  if (client.perfilAtendimento !== 'Compartilhado') return { responsavel: 'Escritorio', parceiroId: '' }
  const partnerIds = clientPartnerIds(client)
  const raw = client.responsabilidadesCompartilhadas?.[department]
  if (!raw) return { responsavel: 'Escritorio', parceiroId: '' }
  const value = typeof raw === 'string' ? { responsavel: raw, parceiroId: '' } : raw
  const responsavel = ['Escritorio', 'Parceiro', 'Ambos'].includes(value?.responsavel) ? value.responsavel : 'Escritorio'
  const partnerId = partnerIds.includes(String(value?.parceiroId || '')) ? String(value.parceiroId) : (partnerIds[0] || '')
  return { responsavel, parceiroId: responsavel === 'Escritorio' ? '' : partnerId }
}

export function partnerCanAccessWork(record = {}, client = {}, partnerId = '', department = '') {
  const target = String(partnerId || '')
  if (!target || !clientPartnerIds(client).includes(target)) return false
  const explicitResponsibility = ['Escritorio', 'Parceiro', 'Ambos'].includes(record.compartilhadoResponsavel)
    ? record.compartilhadoResponsavel
    : ''
  const fallback = responsibilityFor(client, department || record.departamento || record.categoria || '')
  const responsavel = explicitResponsibility || fallback.responsavel
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

function paymentSummary(charge = {}) {
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
  if (direct) return Number(direct.valor || 0)
  if (String(charge.parceiroId || client.parceiroId || '') === target) return Number(charge.compartilhadoParceiroParte ?? client.compartilhadoParceiroParte ?? 0)
  return 0
}

function sanitizePartnerFinance(charge = {}, client = {}, partnerId = '') {
  const summary = paymentSummary(charge)
  const share = partnerShare(charge, client, partnerId)
  const result = {
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
  return result
}

function linkedCompanyClientId(record = {}) {
  return String(record.clienteId || record.clientId || record.cliente_id || '')
}

export function filterPayloadForMembership(payload = {}, membership = {}) {
  const role = membership.role || ROLE_COLLABORATOR
  const permissions = permissionsFor(membership)
  if (role === ROLE_ADMIN) return clone(payload) || {}

  const next = clone(payload) || {}
  if (role === ROLE_COLLABORATOR) {
    if (!permissions.clients) next.med_clientes = []
    if (!permissions.tasks) { next.med_tarefas = []; next.med_tarefas_modelos = [] }
    if (!permissions.processes) { next.med_processos = []; next.med_processos_modelos = [] }
    if (!permissions.obligations) next.med_obrigacoes = []
    if (!permissions.finance) next.med_financeiro = []
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
    const chargePartnerIds = unique([...(Array.isArray(charge.parceiroIds) ? charge.parceiroIds : []), charge.parceiroId, ...(Array.isArray(charge.compartilhadoPartesParceiros) ? charge.compartilhadoPartesParceiros.map(item => item?.parceiroId) : [])])
    if (!chargePartnerIds.includes(partnerId) && partnerShare(charge, client, partnerId) <= 0) return []
    return [sanitizePartnerFinance(charge, client, partnerId)]
  })

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
  settings: 'med_configuracoes',
  departments: 'med_departamentos',
  ui: 'med_preferencias',
  history: 'med_historico_painel',
  meta: 'med_meta',
  lastBackup: 'med_last_backup',
}

const ARRAY_KEYS = new Set(['clients', 'linkedCompanies', 'partners', 'tasks', 'taskTemplates', 'processes', 'obligations', 'processModels', 'finance', 'departments', 'history'])
const keyForRecord = (name, record = {}) => name === 'departments' ? String(record.name || '') : String(record.id || '')

function applyArrayPatch(records = [], change = {}, name = '', allowDelete = true) {
  const current = Array.isArray(records) ? records.map(item => clone(item)) : []
  const map = new Map(current.map(item => [keyForRecord(name, item), item]).filter(([key]) => key))
  ;(Array.isArray(change.upserts) ? change.upserts : []).forEach(item => {
    const key = keyForRecord(name, item)
    if (key) map.set(key, clone(item))
  })
  if (allowDelete) (Array.isArray(change.deletes) ? change.deletes : []).forEach(id => map.delete(String(id)))
  return [...map.values()]
}

function patchAudit(name, change = {}, allowDelete = true) {
  const labels = { clients: 'cliente', linkedCompanies: 'empresa terceirizada', partners: 'parceiro', tasks: 'tarefa', taskTemplates: 'modelo de tarefa', processes: 'processo', obligations: 'obrigação', processModels: 'modelo de processo', finance: 'cobrança', departments: 'departamento', history: 'histórico' }
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
  const tasks = Array.isArray(payload.med_tarefas) ? payload.med_tarefas.map(item => clone(item)) : []
  const map = new Map(tasks.map(item => [String(item.id), item]))
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
  const records = Array.isArray(payload.med_processos) ? payload.med_processos.map(item => clone(item)) : []
  const map = new Map(records.map(item => [String(item.id), item]))
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
  const records = Array.isArray(payload.med_obrigacoes) ? payload.med_obrigacoes.map(item => clone(item)) : []
  const map = new Map(records.map(item => [String(item.id), item]))
  const audit = []
  const fields = ['status', 'observacao', 'observacoes', 'concluidoEm', 'updatedAt']
  ;(change?.upserts || []).forEach(incoming => {
    const existing = map.get(String(incoming.id || ''))
    if (!existing) return
    const links = Array.isArray(existing.clientes) ? existing.clientes.map(item => clone(item)) : []
    const incomingLinks = new Map((Array.isArray(incoming.clientes) ? incoming.clientes : []).map(link => [String(link.clienteId), link]))
    let touched = false
    existing.clientes = links.map(link => {
      const client = clients.get(String(link.clienteId || ''))
      const source = incomingLinks.get(String(link.clienteId || ''))
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

export function applyOfficePatch(fullPayload = {}, patch = {}, membership = {}) {
  const payload = clone(fullPayload) || {}
  const role = membership.role || ROLE_COLLABORATOR
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

    let allowed = role === ROLE_ADMIN
    if (role === ROLE_COLLABORATOR) {
      if (name === 'clients' || name === 'linkedCompanies') allowed = Boolean(permissions.clients && permissions.manage_clients)
      else if (name === 'tasks' || name === 'taskTemplates') allowed = Boolean(permissions.tasks)
      else if (name === 'processes' || name === 'processModels') allowed = Boolean(permissions.processes)
      else if (name === 'obligations') allowed = Boolean(permissions.obligations)
      else if (name === 'finance') allowed = Boolean(permissions.finance && permissions.finance_edit)
      else if (name === 'history') allowed = true
      else allowed = false
    }
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
  return membership.role === ROLE_ADMIN && permissionsFor(membership).team !== false
}
