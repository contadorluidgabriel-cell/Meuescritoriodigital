const clone = value => value == null ? value : structuredClone(value)

function isOwner(access = {}) {
  const membership = access?.membership || {}
  const ownerId = String(access?.workspace?.owner_user_id || membership?.workspace?.owner_user_id || '')
  return Boolean(ownerId && membership.user_id && String(membership.user_id) === ownerId)
}

function isV2Internal(membership = {}) {
  return (membership.role === 'admin' || membership.role === 'collaborator') && membership.permissions?.access_v2 === true
}

function mineOrUnassigned(record = {}, userId = '') {
  const responsible = String(record.responsavelUserId || '')
  return !responsible || responsible === userId
}

export function personalOfficeForAccess(office = {}, access = {}) {
  const membership = access?.membership || {}
  if (!membership.role || membership.role === 'partner' || isOwner(access)) return office

  const v2 = isV2Internal(membership)
  if (membership.role === 'admin' && !v2) return office
  if (v2 && membership.permissions?.work_visibility === 'all_allowed') return office

  const userId = String(membership.user_id || '')
  if (!userId) return office
  const include = v2
    ? record => mineOrUnassigned(record, userId)
    : record => String(record.responsavelUserId || '') === userId

  const next = { ...office }
  next.tasks = (office.tasks || []).filter(include)
  next.processes = (office.processes || []).filter(include)
  next.obligations = (office.obligations || []).flatMap(obligation => {
    const links = (obligation.clientes || []).filter(include)
    return links.length ? [{ ...clone(obligation), clientes: links }] : []
  })
  return next
}

export function accessCanViewFinance(access = {}) {
  const membership = access?.membership || {}
  if (isOwner(access)) return true
  if (membership.role === 'partner') return Boolean(membership.permissions?.finance_shared !== false)
  if (membership.role === 'admin' && !isV2Internal(membership)) return true
  const permissions = membership.permissions || {}
  return Boolean(
    permissions.finance_receivables ?? permissions.finance ||
    permissions.finance_payables ||
    permissions.finance_cash ||
    permissions.finance_reports
  )
}

export function accessCanManageTeam(access = {}) {
  const membership = access?.membership || {}
  if (isOwner(access)) return true
  if (membership.role !== 'admin') return false
  if (isV2Internal(membership)) return true
  return membership.permissions?.team !== false
}
