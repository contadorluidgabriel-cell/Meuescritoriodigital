import { isDone } from './storage.js'
import { normalizeText } from './textUtils.js'
import { entityDisplayName, obligationLinkEntityType } from './entityUtils.js'

const normalize = value => normalizeText(value || '')

function maps(office = {}) {
  return {
    clients: new Map((office.clients || []).map(item => [String(item.id), item])),
    linked: new Map((office.linkedCompanies || []).map(item => [String(item.id), item])),
  }
}

export function obligationProgress(office = {}, obligationId = '') {
  const obligation = (office.obligations || []).find(item => String(item.id) === String(obligationId))
  if (!obligation) return null
  const { clients, linked } = maps(office)
  const links = obligation.clientes || []
  const doneLinks = links.filter(link => isDone(link.status) || normalize(link.status) === 'nao se aplica')
  const openLinks = links.filter(link => !(isDone(link.status) || normalize(link.status) === 'nao se aplica'))
  const first = openLinks[0] || links[0] || null
  let firstEntity = null
  let firstEntityType = 'client'
  if (first) {
    firstEntityType = obligationLinkEntityType(first, clients, linked)
    firstEntity = firstEntityType === 'linkedCompany' ? linked.get(String(first.clienteId)) : clients.get(String(first.clienteId))
  }
  return {
    obligation,
    total: links.length,
    done: doneLinks.length,
    open: openLinks.length,
    firstPendingClientId: first?.clienteId ? String(first.clienteId) : '',
    firstPendingEntityType: firstEntityType,
    firstPendingName: firstEntity ? entityDisplayName(firstEntity) : '',
    openLinks,
  }
}

export function operationalSource(office = {}, item = {}) {
  if (item.type === 'task') return (office.tasks || []).find(row => String(row.id) === String(item.id)) || null
  if (item.type === 'process') return (office.processes || []).find(row => String(row.id) === String(item.id)) || null
  if (item.type === 'obligation') return (office.obligations || []).find(row => String(row.id) === String(item.id)) || null
  return null
}

export function operationalResponsible(office = {}, item = {}) {
  const source = operationalSource(office, item)
  if (!source) return ''
  if (item.type === 'task') return source.responsavel || source.responsavelNome || ''
  if (item.type === 'process') return source.responsavel || source.responsavelNome || ''
  if (item.type === 'obligation') {
    const progress = obligationProgress(office, item.id)
    const shared = progress?.openLinks?.find(link => link.compartilhadoResponsavel)?.compartilhadoResponsavel
    return source.responsavel || source.responsavelNome || shared || ''
  }
  return ''
}

export function pendingReasonIds(item = {}, office = {}, day = '') {
  const reasons = new Set()
  const normalizedStatus = normalize(item.status)
  const actionDate = String(item.actionDate || item.effectiveDate || item.planned || item.due || '')
  const officialDue = String(item.due || '')
  const responsible = operationalResponsible(office, item)

  if ((actionDate && day && actionDate < day) || (officialDue && day && officialDue < day)) reasons.add('overdue')
  if (normalizedStatus.includes('aguardando') || (item.type === 'process' && item.dependency && item.dependency !== 'interno')) reasons.add('waiting')
  if (!actionDate && !officialDue) reasons.add('unscheduled')
  if (['task', 'process'].includes(item.type) && !responsible) reasons.add('unassigned')
  if (item.level === 'critical') reasons.add('critical')
  return reasons
}

export function pendingReasonLabel(id) {
  return ({
    critical: 'Crítico',
    overdue: 'Atrasado',
    waiting: 'Aguardando retorno',
    unscheduled: 'Sem prazo',
    unassigned: 'Sem responsável',
  })[id] || id
}
