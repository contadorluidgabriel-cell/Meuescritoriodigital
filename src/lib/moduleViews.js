import { isDone } from './storage.js'
import { processActionState } from './processPlanning.js'

const normalize = value => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()

export const PROCESS_VIEW_OPTIONS = [
  ['active', 'Em andamento'],
  ['waiting', 'Aguardando terceiros/cliente'],
  ['completed', 'Concluídos'],
]

export const TASK_VIEW_OPTIONS = [
  ['mine', 'Minhas'],
  ['team', 'Equipe'],
  ['waiting', 'Aguardando cliente'],
  ['completed', 'Concluídas'],
]

export const OBLIGATION_VIEW_OPTIONS = [
  ['pending', 'Pendentes'],
  ['progress', 'Em andamento'],
  ['completed', 'Concluídas'],
  ['all', 'Todas'],
]

export const PARTNER_VIEW_OPTIONS = [
  ['active', 'Ativos'],
  ['inactive', 'Inativos'],
]

export function processViewOf(process = {}) {
  if (isDone(process?.status)) return 'completed'
  const dependency = processActionState(process).dependency
  return ['cliente', 'orgao', 'terceiro'].includes(String(dependency || '')) ? 'waiting' : 'active'
}

export function taskViewOf(task = {}, currentUserId = '') {
  if (isDone(task?.status)) return 'completed'
  if (normalize(task?.status) === 'aguardando cliente') return 'waiting'
  const assigned = String(task?.responsavelUserId || '')
  const current = String(currentUserId || '')
  const explicitTeam = Boolean(
    task?.compartilhadoParceiroId
    || task?.compartilhadoResponsavel
    || task?.equipeResponsavelId
    || task?.equipeId
  )
  if (!assigned && !explicitTeam) return 'mine'
  return current && assigned === current ? 'mine' : 'team'
}

export function obligationViewOf(obligation = {}) {
  const links = Array.isArray(obligation?.clientes) ? obligation.clientes : []
  if (links.length && links.every(link => ['concluida', 'nao se aplica'].includes(normalize(link?.status)))) return 'completed'

  const applicable = links.filter(link => normalize(link?.status) !== 'nao se aplica')
  const statuses = applicable.map(link => normalize(link?.status || 'Pendente'))
  const hasExecution = statuses.some(status =>
    status === 'em andamento'
    || status === 'aguardando cliente'
    || status === 'concluida'
  )
  return hasExecution ? 'progress' : 'pending'
}

export function partnerViewOf(partner = {}) {
  return normalize(partner?.status) === 'inativo' ? 'inactive' : 'active'
}

export function countByView(rows = [], classifier, options = []) {
  const counts = Object.fromEntries(options.map(([id]) => [id, 0]))
  ;(rows || []).forEach(row => {
    const view = classifier(row)
    if (Object.prototype.hasOwnProperty.call(counts, view)) counts[view] += 1
  })
  return counts
}
