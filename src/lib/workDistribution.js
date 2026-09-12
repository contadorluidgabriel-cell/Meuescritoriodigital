export const WORK_KIND_LABELS = {
  task: 'Tarefa',
  process: 'Processo',
  obligation: 'Obrigação',
}

export function routineForWorkKind(kind = '') {
  if (kind === 'task') return 'tasks'
  if (kind === 'process') return 'processes'
  if (kind === 'obligation') return 'obligations'
  return ''
}

export function workAssignmentKey(row = {}) {
  return `${row.kind || ''}:${row.id || ''}:${row.clientId || ''}`
}

function isOwner(member = {}, ownerUserId = '') {
  return Boolean(member?.user_id && ownerUserId && String(member.user_id) === String(ownerUserId))
}

export function memberCanReceiveWork(member = {}, row = {}, ownerUserId = '') {
  if (!member || member.status !== 'active' || !member.user_id) return false
  if (member.role === 'partner') return false
  if (isOwner(member, ownerUserId)) return true
  if (!['admin', 'collaborator'].includes(String(member.role || ''))) return false

  const routine = routineForWorkKind(row.kind)
  if (!routine) return false
  const permissions = member.permissions || {}

  if (permissions.access_v2 === true) {
    if (!permissions[routine]) return false
    const clientId = String(row.clientId || '')
    if (!clientId) return row.kind === 'task'
    const allowed = new Set((Array.isArray(permissions.client_ids) ? permissions.client_ids : []).map(String))
    return allowed.has(clientId)
  }

  return permissions[routine] !== false
}

export function eligibleMembersForWork(members = [], row = {}, ownerUserId = '') {
  return (members || []).filter(member => memberCanReceiveWork(member, row, ownerUserId))
}

export function applyWorkResponsible(draft = {}, row = {}, userId = '', timestamp = new Date().toISOString()) {
  const nextUserId = String(userId || '')
  if (row.kind === 'task') {
    const item = (draft.tasks || []).find(record => String(record.id) === String(row.id))
    if (!item) return false
    item.responsavelUserId = nextUserId
    item.updatedAt = timestamp
    return true
  }
  if (row.kind === 'process') {
    const item = (draft.processes || []).find(record => String(record.id) === String(row.id))
    if (!item) return false
    item.responsavelUserId = nextUserId
    item.updatedAt = timestamp
    return true
  }
  if (row.kind === 'obligation') {
    const obligation = (draft.obligations || []).find(record => String(record.id) === String(row.id))
    const link = obligation?.clientes?.find(record => String(record.clienteId) === String(row.clientId))
    if (!link) return false
    link.responsavelUserId = nextUserId
    link.updatedAt = timestamp
    return true
  }
  return false
}
