import { isDone, uid } from './storage.js'

const asId = value => String(value || '')
const sameResponsible = (value, expected) => asId(value) === asId(expected)
const obligationOpen = link => !isDone(link?.status) && String(link?.status || '') !== 'Não se aplica'

export function primaryResponsibleId(client = {}) {
  return asId(client?.responsavelPrincipalUserId)
}

export function countClientOpenWorkForResponsible(office = {}, clientId = '', userId = '') {
  const targetClient = asId(clientId)
  const targetUser = asId(userId)
  const result = { tasks: 0, processes: 0, obligations: 0, total: 0 }

  ;(office.tasks || []).forEach(item => {
    if (asId(item.clientId) === targetClient && !isDone(item.status) && sameResponsible(item.responsavelUserId, targetUser)) result.tasks += 1
  })
  ;(office.processes || []).forEach(item => {
    if (asId(item.clientId) === targetClient && !isDone(item.status) && sameResponsible(item.responsavelUserId, targetUser)) result.processes += 1
  })
  ;(office.obligations || []).forEach(obligation => (obligation.clientes || []).forEach(link => {
    if (asId(link.clienteId) === targetClient && obligationOpen(link) && sameResponsible(link.responsavelUserId, targetUser)) result.obligations += 1
  }))
  result.total = result.tasks + result.processes + result.obligations
  return result
}

export function transferClientOpenWork(draft = {}, clientId = '', fromUserId = '', toUserId = '', timestamp = new Date().toISOString()) {
  const targetClient = asId(clientId)
  const sourceUser = asId(fromUserId)
  const nextUser = asId(toUserId)
  const result = { tasks: 0, processes: 0, obligations: 0, total: 0 }

  ;(draft.tasks || []).forEach(item => {
    if (asId(item.clientId) !== targetClient || isDone(item.status) || !sameResponsible(item.responsavelUserId, sourceUser)) return
    item.responsavelUserId = nextUser
    item.updatedAt = timestamp
    result.tasks += 1
  })
  ;(draft.processes || []).forEach(item => {
    if (asId(item.clientId) !== targetClient || isDone(item.status) || !sameResponsible(item.responsavelUserId, sourceUser)) return
    item.responsavelUserId = nextUser
    item.updatedAt = timestamp
    result.processes += 1
  })
  ;(draft.obligations || []).forEach(obligation => (obligation.clientes || []).forEach(link => {
    if (asId(link.clienteId) !== targetClient || !obligationOpen(link) || !sameResponsible(link.responsavelUserId, sourceUser)) return
    link.responsavelUserId = nextUser
    link.updatedAt = timestamp
    result.obligations += 1
  }))
  result.total = result.tasks + result.processes + result.obligations
  return result
}

export function applyPrimaryResponsibilityInheritance(before = {}, after = {}, timestamp = new Date().toISOString()) {
  const clients = new Map((after.clients || []).map(client => [asId(client.id), client]))
  const beforeTaskIds = new Set((before.tasks || []).map(item => asId(item.id)))
  const beforeProcessIds = new Set((before.processes || []).map(item => asId(item.id)))
  const beforeObligationLinks = new Set()
  ;(before.obligations || []).forEach(obligation => (obligation.clientes || []).forEach(link => beforeObligationLinks.add(`${asId(obligation.id)}:${asId(link.clienteId)}`)))
  let applied = 0

  ;(after.tasks || []).forEach(item => {
    if (beforeTaskIds.has(asId(item.id)) || asId(item.responsavelUserId)) return
    const responsible = primaryResponsibleId(clients.get(asId(item.clientId)))
    if (!responsible) return
    item.responsavelUserId = responsible
    item.updatedAt = item.updatedAt || timestamp
    applied += 1
  })
  ;(after.processes || []).forEach(item => {
    if (beforeProcessIds.has(asId(item.id)) || asId(item.responsavelUserId)) return
    const responsible = primaryResponsibleId(clients.get(asId(item.clientId)))
    if (!responsible) return
    item.responsavelUserId = responsible
    item.updatedAt = item.updatedAt || timestamp
    applied += 1
  })
  ;(after.obligations || []).forEach(obligation => (obligation.clientes || []).forEach(link => {
    const key = `${asId(obligation.id)}:${asId(link.clienteId)}`
    if (beforeObligationLinks.has(key) || asId(link.responsavelUserId)) return
    const responsible = primaryResponsibleId(clients.get(asId(link.clienteId)))
    if (!responsible) return
    link.responsavelUserId = responsible
    link.updatedAt = link.updatedAt || timestamp
    applied += 1
  }))
  return applied
}

export function appendDistributionHistory(draft = {}, { actorUserId = '', actorName = 'Usuário', action = 'distribution', summary = '', details = {}, createdAt = new Date().toISOString() } = {}) {
  if (!summary) return null
  const entry = {
    id: uid('hist'),
    tipo: 'distribuicao',
    action,
    actorUserId: asId(actorUserId),
    actorName: String(actorName || 'Usuário'),
    summary: String(summary),
    details: details && typeof details === 'object' ? structuredClone(details) : {},
    createdAt,
  }
  draft.history = [entry, ...(Array.isArray(draft.history) ? draft.history : [])].slice(0, 500)
  return entry
}
