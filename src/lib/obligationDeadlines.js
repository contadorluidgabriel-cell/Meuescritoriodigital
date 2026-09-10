import { addDays } from './operationalIntelligence.js'
import { isDone } from './storage.js'

export const OBLIGATION_DEADLINE_FILTERS = [
  ['all', 'Todas'],
  ['overdue', 'Vencidas'],
  ['today', 'Hoje'],
  ['tomorrow', 'Amanhã'],
  ['week', 'Próximos 7 dias'],
  ['month', 'Próximos 30 dias'],
  ['waiting', 'Aguardando cliente'],
]

const normalize = value => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()

const isIgnored = status => normalize(status) === 'nao se aplica'
const isCompleted = status => isDone(status) || isIgnored(status)
const linkEntityType = link => link?.entityType === 'linkedCompany' || link?.entidadeTipo === 'terceirizado' ? 'linkedCompany' : 'client'

export function isObligationWaitingClient(status) {
  return normalize(status) === 'aguardando cliente'
}

export function obligationLinkMatchesDeadline(item = {}, scope = 'all', day) {
  if (isCompleted(item.status)) return false
  const due = String(item.vencimento || '')
  if (scope === 'all') return true
  if (scope === 'waiting') return isObligationWaitingClient(item.status)
  if (!due) return false

  if (scope === 'overdue') return due < day
  if (scope === 'today') return due === day
  if (scope === 'tomorrow') return due === addDays(day, 1)
  if (scope === 'week') return due >= day && due <= addDays(day, 6)
  if (scope === 'month') return due >= day && due <= addDays(day, 29)
  return true
}

export function flattenObligationDeadlines(obligations = []) {
  return (obligations || []).flatMap(obligation => (obligation.clientes || []).map(link => {
    const entityType = linkEntityType(link)
    const entityId = String(link.clienteId || '')
    return {
      key: entityType === 'linkedCompany' ? `${obligation.id}|linked|${entityId}` : `${obligation.id}|${entityId}`,
      obligationId: String(obligation.id || ''),
      clientId: entityId,
      entityType,
      nome: obligation.nome || 'Obrigação',
      tipo: obligation.tipo || '',
      competencia: obligation.competencia || '',
      categoria: obligation.categoria || 'Outros',
      terceirizado: entityType === 'linkedCompany' || Boolean(obligation.terceirizado),
      terceiroNome: obligation.terceiroNome || '',
      vencimento: link.vencimento || '',
      status: link.status || 'Pendente',
      concluidoEm: link.concluidoEm || '',
      observacao: link.observacao || '',
      recibo: link.recibo || '',
    }
  }))
}

function matchesContext(item, { clientId = '', category = '' } = {}) {
  if (clientId && String(item.clientId) !== String(clientId)) return false
  if (category && String(item.categoria || '') !== String(category)) return false
  return true
}

export function sortObligationDeadlines(items = []) {
  return [...items].sort((a, b) => {
    const aDue = String(a.vencimento || '')
    const bDue = String(b.vencimento || '')
    if (!aDue && bDue) return 1
    if (aDue && !bDue) return -1
    if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue)
    const category = String(a.categoria || '').localeCompare(String(b.categoria || ''), 'pt-BR')
    if (category) return category
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
  })
}

export function buildObligationDeadlineView(obligations = [], { day, scope = 'all', clientId = '', category = '' } = {}) {
  const contextItems = flattenObligationDeadlines(obligations)
    .filter(item => !isCompleted(item.status) && matchesContext(item, { clientId, category }))

  const counts = Object.fromEntries(OBLIGATION_DEADLINE_FILTERS.map(([id]) => [
    id,
    contextItems.filter(item => obligationLinkMatchesDeadline(item, id, day)).length,
  ]))

  const items = sortObligationDeadlines(contextItems.filter(item => obligationLinkMatchesDeadline(item, scope, day)))
  return { scope, counts, items, total: items.length, pendingTotal: contextItems.length }
}

export function obligationDeadlineMeta(item = {}, day) {
  const due = String(item.vencimento || '')
  if (!due) return { due: '', tone: 'neutral', label: 'Sem vencimento definido' }
  if (due < day) {
    const milliseconds = new Date(`${day}T12:00:00`).getTime() - new Date(`${due}T12:00:00`).getTime()
    const days = Math.max(1, Math.round(milliseconds / 86400000))
    return { due, tone: 'danger', label: `${days} dia${days === 1 ? '' : 's'} vencida` }
  }
  if (due === day) return { due, tone: 'warning', label: 'Vence hoje' }
  if (due === addDays(day, 1)) return { due, tone: 'attention', label: 'Vence amanhã' }

  const milliseconds = new Date(`${due}T12:00:00`).getTime() - new Date(`${day}T12:00:00`).getTime()
  const days = Math.max(0, Math.round(milliseconds / 86400000))
  return { due, tone: days <= 7 ? 'attention' : 'neutral', label: `Vence em ${days} dias` }
}
