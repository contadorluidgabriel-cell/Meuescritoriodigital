import * as base from './accessInternalV2.js'

const clone = value => value == null ? value : structuredClone(value)
const id = value => String(value || '')

export const defaultInternalV2Permissions = base.defaultInternalV2Permissions
export const internalV2CanManageTeam = base.internalV2CanManageTeam
export const internalV2Permissions = base.internalV2Permissions
export const isInternalV2Membership = base.isInternalV2Membership
export const isOwnerMembership = base.isOwnerMembership

function clientsById(payload = {}) {
  return new Map((Array.isArray(payload.med_clientes) ? payload.med_clientes : []).map(client => [id(client.id), client]))
}

function principalForClient(map, clientId = '') {
  return id(map.get(id(clientId))?.responsavelPrincipalUserId)
}

function inheritedResponsible(record = {}, clientMap = new Map()) {
  const clientId = id(record.clientId || record.clienteId || record.cliente_id)
  const principal = principalForClient(clientMap, clientId)
  return principal && id(record.responsavelUserId) === principal ? principal : ''
}

export function filterInternalV2Payload(payload = {}, membership = {}) {
  const next = base.filterInternalV2Payload(payload, membership)
  if (!base.isInternalV2Membership(membership)) return next
  const source = clientsById(payload)
  next.med_clientes = (Array.isArray(next.med_clientes) ? next.med_clientes : []).map(client => {
    const original = source.get(id(client.id))
    if (!original?.responsavelPrincipalUserId) return client
    return { ...client, responsavelPrincipalUserId: id(original.responsavelPrincipalUserId) }
  })
  return next
}

export function applyInternalV2Patch(fullPayload = {}, patch = {}, membership = {}) {
  if (!base.isInternalV2Membership(membership)) return base.applyInternalV2Patch(fullPayload, patch, membership)

  const clientMap = clientsById(fullPayload)
  const safePatch = clone(patch) || {}
  const restore = { tasks: new Map(), processes: new Map(), obligations: new Map() }
  const existingTasks = new Set((fullPayload.med_tarefas || []).map(item => id(item.id)))
  const existingProcesses = new Set((fullPayload.med_processos || []).map(item => id(item.id)))
  const existingObligations = new Set((fullPayload.med_obrigacoes || []).map(item => id(item.id)))

  if (safePatch.tasks?.upserts) safePatch.tasks.upserts = safePatch.tasks.upserts.map(item => {
    const key = id(item.id)
    if (!key || existingTasks.has(key)) return item
    const principal = inheritedResponsible(item, clientMap)
    if (!principal) return item
    restore.tasks.set(key, principal)
    return { ...item, responsavelUserId: '' }
  })

  if (safePatch.processes?.upserts) safePatch.processes.upserts = safePatch.processes.upserts.map(item => {
    const key = id(item.id)
    if (!key || existingProcesses.has(key)) return item
    const principal = inheritedResponsible(item, clientMap)
    if (!principal) return item
    restore.processes.set(key, principal)
    return { ...item, responsavelUserId: '' }
  })

  if (safePatch.obligations?.upserts) safePatch.obligations.upserts = safePatch.obligations.upserts.map(obligation => {
    const obligationId = id(obligation.id)
    if (!obligationId || existingObligations.has(obligationId)) return obligation
    const links = (Array.isArray(obligation.clientes) ? obligation.clientes : []).map(link => {
      const principal = inheritedResponsible(link, clientMap)
      if (!principal) return link
      restore.obligations.set(`${obligationId}:${id(link.clienteId)}`, principal)
      return { ...link, responsavelUserId: '' }
    })
    return { ...obligation, clientes: links }
  })

  const result = base.applyInternalV2Patch(fullPayload, safePatch, membership)

  for (const [recordId, principal] of restore.tasks) {
    const item = (result.payload.med_tarefas || []).find(record => id(record.id) === recordId)
    if (item && !id(item.responsavelUserId)) item.responsavelUserId = principal
  }
  for (const [recordId, principal] of restore.processes) {
    const item = (result.payload.med_processos || []).find(record => id(record.id) === recordId)
    if (item && !id(item.responsavelUserId)) item.responsavelUserId = principal
  }
  for (const [key, principal] of restore.obligations) {
    const [obligationId, clientId] = key.split(':')
    const obligation = (result.payload.med_obrigacoes || []).find(record => id(record.id) === obligationId)
    const link = obligation?.clientes?.find(record => id(record.clienteId) === clientId)
    if (link && !id(link.responsavelUserId)) link.responsavelUserId = principal
  }

  return result
}
