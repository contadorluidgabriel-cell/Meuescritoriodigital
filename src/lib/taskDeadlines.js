import { isDone } from './storage.js'
import { addDays, daysBetween } from './operationalIntelligence.js'

export const TASK_DEADLINE_FILTERS = [
  ['all', 'Todas'],
  ['overdue', 'Atrasadas'],
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

const dueDate = task => String(task?.prazo || '')
const plannedDate = task => String(task?.planejadoPara || '')

export function isWaitingClient(task = {}) {
  return normalize(task.status) === 'aguardando cliente'
}

export function taskMatchesDeadline(task = {}, scope = 'all', day) {
  if (isDone(task.status)) return false
  const due = dueDate(task)
  if (scope === 'all') return true
  if (scope === 'waiting') return isWaitingClient(task)
  if (!due) return false

  if (scope === 'overdue') return due < day
  if (scope === 'today') return due === day
  if (scope === 'tomorrow') return due === addDays(day, 1)
  if (scope === 'week') return due >= day && due <= addDays(day, 6)
  if (scope === 'month') return due >= day && due <= addDays(day, 29)
  return true
}

function matchesContext(task, { clientId = '', responsible = '', department = '' } = {}) {
  if (clientId && String(task.clientId || '') !== String(clientId)) return false
  if (responsible && String(task.responsavel || '') !== String(responsible)) return false
  if (department && String(task.departamento || '') !== String(department)) return false
  return true
}

function priorityWeight(value) {
  const priority = normalize(value)
  if (priority === 'urgente') return 4
  if (priority === 'alta') return 3
  if (priority === 'media') return 2
  if (priority === 'baixa') return 1
  return 0
}

export function sortTasksByDeadline(tasks = [], day) {
  return [...tasks].sort((a, b) => {
    const aDue = dueDate(a)
    const bDue = dueDate(b)
    if (!aDue && bDue) return 1
    if (aDue && !bDue) return -1
    if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue)
    const priority = priorityWeight(b.prioridade) - priorityWeight(a.prioridade)
    if (priority) return priority
    return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR')
  })
}

export function buildTaskDeadlineView(tasks = [], { day, scope = 'all', clientId = '', responsible = '', department = '' } = {}) {
  const contextTasks = (tasks || []).filter(task => !isDone(task.status) && matchesContext(task, { clientId, responsible, department }))
  const counts = Object.fromEntries(TASK_DEADLINE_FILTERS.map(([id]) => [id, contextTasks.filter(task => taskMatchesDeadline(task, id, day)).length]))
  const visible = sortTasksByDeadline(contextTasks.filter(task => taskMatchesDeadline(task, scope, day)), day)

  return {
    scope,
    counts,
    tasks: visible,
    total: visible.length,
    pendingTotal: contextTasks.length,
  }
}

export function taskDeadlineMeta(task = {}, day) {
  const due = dueDate(task)
  const planned = plannedDate(task)
  if (!due) return { due: '', planned, days: null, tone: 'neutral', label: 'Sem prazo definido' }
  const days = daysBetween(day, due)
  if (days === null) return { due, planned, days, tone: 'neutral', label: `Prazo ${due}` }
  if (days < 0) return { due, planned, days, tone: 'danger', label: `${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'} em atraso` }
  if (days === 0) return { due, planned, days, tone: 'warning', label: 'Vence hoje' }
  if (days === 1) return { due, planned, days, tone: 'attention', label: 'Vence amanhã' }
  return { due, planned, days, tone: days <= 7 ? 'attention' : 'neutral', label: `Vence em ${days} dias` }
}
