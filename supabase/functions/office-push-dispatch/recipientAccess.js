const clone = value => value == null ? value : structuredClone(value)
const unique = values => [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))]

function clientPartnerIds(client = {}) {
  return unique([...(Array.isArray(client.parceiroIds) ? client.parceiroIds : []), client.parceiroId])
}

function responsibilityFor(client = {}, department = '') {
  if (client.perfilAtendimento !== 'Compartilhado') return { responsavel: 'Escritorio', parceiroId: '' }
  const ids = clientPartnerIds(client)
  const raw = client.responsabilidadesCompartilhadas?.[department]
  if (!raw) return { responsavel: 'Escritorio', parceiroId: '' }
  const value = typeof raw === 'string' ? { responsavel: raw, parceiroId: '' } : raw
  const responsavel = ['Escritorio', 'Parceiro', 'Ambos'].includes(value?.responsavel) ? value.responsavel : 'Escritorio'
  const parceiroId = ids.includes(String(value?.parceiroId || '')) ? String(value.parceiroId) : (ids[0] || '')
  return { responsavel, parceiroId: responsavel === 'Escritorio' ? '' : parceiroId }
}

function partnerCanAccessWork(record = {}, client = {}, partnerId = '', department = '') {
  const target = String(partnerId || '')
  if (!target || !clientPartnerIds(client).includes(target)) return false
  const fallback = responsibilityFor(client, department || record.departamento || record.categoria || '')
  const responsavel = ['Escritorio', 'Parceiro', 'Ambos'].includes(record.compartilhadoResponsavel)
    ? record.compartilhadoResponsavel
    : fallback.responsavel
  const selectedPartner = String(record.compartilhadoParceiroId || fallback.parceiroId || '')
  return (responsavel === 'Parceiro' || responsavel === 'Ambos') && selectedPartner === target
}

function partnerShare(charge = {}, client = {}, partnerId = '') {
  const target = String(partnerId || '')
  const source = Array.isArray(charge.compartilhadoPartesParceiros) && charge.compartilhadoPartesParceiros.length
    ? charge.compartilhadoPartesParceiros
    : Array.isArray(client.compartilhadoPartesParceiros) ? client.compartilhadoPartesParceiros : []
  const direct = source.find(item => String(item?.parceiroId || '') === target)
  if (direct) return Math.max(0, Number(direct.valor || 0))
  if (String(charge.parceiroId || client.parceiroId || '') === target) return Math.max(0, Number(charge.compartilhadoParceiroParte ?? client.compartilhadoParceiroParte ?? 0))
  return 0
}

function partnerFinance(charge = {}, client = {}, partnerId = '') {
  const share = partnerShare(charge, client, partnerId)
  if (share <= 0) return null
  const received = String(charge.status || '').toLowerCase() === 'recebido'
  return {
    id: charge.id,
    clienteId: charge.clienteId,
    descricao: charge.descricao || 'Cobrança compartilhada',
    competencia: charge.competencia || '',
    vencimento: charge.vencimento || '',
    valor: share,
    status: charge.status || '',
    recebidoEm: charge.recebidoEm || '',
    pagamentos: received ? [{ data: charge.recebidoEm || charge.vencimento || '', valorRecebido: share }] : [],
  }
}

export function filterPushPayload(payload = {}, membership = {}, userId = '') {
  const role = membership?.role || 'admin'
  if (role === 'admin') return clone(payload) || {}

  const next = clone(payload) || {}
  const clients = Array.isArray(payload.med_clientes) ? payload.med_clientes : []
  const clientsById = new Map(clients.map(client => [String(client.id), client]))

  if (role === 'collaborator') {
    const target = String(userId || membership.user_id || '')
    next.med_tarefas = (Array.isArray(payload.med_tarefas) ? payload.med_tarefas : []).filter(item => String(item.responsavelUserId || '') === target)
    next.med_processos = (Array.isArray(payload.med_processos) ? payload.med_processos : []).filter(item => String(item.responsavelUserId || '') === target)
    next.med_obrigacoes = (Array.isArray(payload.med_obrigacoes) ? payload.med_obrigacoes : []).flatMap(obligation => {
      const links = (Array.isArray(obligation.clientes) ? obligation.clientes : []).filter(link => String(link.responsavelUserId || '') === target)
      return links.length ? [{ ...clone(obligation), clientes: links }] : []
    })
    if (!membership.permissions?.finance) next.med_financeiro = []
    return next
  }

  const partnerId = String(membership.partner_id || '')
  const allowedClients = clients.filter(client => clientPartnerIds(client).includes(partnerId))
  const allowedClientIds = new Set(allowedClients.map(client => String(client.id)))
  next.med_clientes = allowedClients
  next.med_tarefas = (Array.isArray(payload.med_tarefas) ? payload.med_tarefas : []).filter(task => {
    const client = clientsById.get(String(task.clientId || ''))
    return client && partnerCanAccessWork(task, client, partnerId, task.departamento || '')
  })
  next.med_processos = (Array.isArray(payload.med_processos) ? payload.med_processos : []).filter(process => {
    const client = clientsById.get(String(process.clientId || ''))
    return client && partnerCanAccessWork(process, client, partnerId, process.departamento || 'Societário')
  })
  next.med_obrigacoes = (Array.isArray(payload.med_obrigacoes) ? payload.med_obrigacoes : []).flatMap(obligation => {
    const links = (Array.isArray(obligation.clientes) ? obligation.clientes : []).filter(link => {
      const client = clientsById.get(String(link.clienteId || ''))
      return client && partnerCanAccessWork(link, client, partnerId, obligation.categoria || '')
    })
    return links.length ? [{ ...clone(obligation), clientes: links }] : []
  })
  next.med_financeiro = membership.permissions?.finance_shared === false ? [] : (Array.isArray(payload.med_financeiro) ? payload.med_financeiro : []).flatMap(charge => {
    if (!allowedClientIds.has(String(charge.clienteId || ''))) return []
    const client = clientsById.get(String(charge.clienteId || '')) || {}
    const row = partnerFinance(charge, client, partnerId)
    return row ? [row] : []
  })
  return next
}
