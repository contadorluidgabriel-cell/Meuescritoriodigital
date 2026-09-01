const clone = value => value == null ? value : structuredClone(value)

export function personalOfficeForAccess(office = {}, access = {}) {
  const membership = access?.membership || {}
  if (!membership.role || membership.role === 'admin' || membership.role === 'partner') return office
  const userId = String(membership.user_id || '')
  if (!userId) return office

  const next = { ...office }
  next.tasks = (office.tasks || []).filter(item => String(item.responsavelUserId || '') === userId)
  next.processes = (office.processes || []).filter(item => String(item.responsavelUserId || '') === userId)
  next.obligations = (office.obligations || []).flatMap(obligation => {
    const links = (obligation.clientes || []).filter(link => String(link.responsavelUserId || '') === userId)
    return links.length ? [{ ...clone(obligation), clientes: links }] : []
  })
  return next
}

export function accessCanViewFinance(access = {}) {
  const membership = access?.membership || {}
  if (membership.role === 'admin') return true
  if (membership.role === 'partner') return Boolean(membership.permissions?.finance_shared !== false)
  return Boolean(membership.permissions?.finance)
}

export function accessCanManageTeam(access = {}) {
  return access?.membership?.role === 'admin' && access?.membership?.permissions?.team !== false
}
