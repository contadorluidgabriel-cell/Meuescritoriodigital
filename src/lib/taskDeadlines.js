import { isDone } from './storage.js'
import { daysBetween } from './operationalIntelligence.js'
import { deadlineMatchesScope } from './deadlineUtils.js'
import { normalizeText } from './textUtils.js'

export const TASK_DEADLINE_FILTERS = [
  ['all', 'Todas'],
  ['overdue', 'Atrasadas'],
  ['today', 'Hoje'],
  ['tomorrow', 'Amanhã'],
  ['week', 'Próximos 7 dias'],
  ['month', 'Próximos 30 dias'],
  ['waiting', 'Aguardando cliente'],
]

const dueDate = task => String(task?.prazo || '')
const plannedDate = task => String(task?.planejadoPara || '')

export function isWaitingClient(task = {}) {
  return normalizeText(task.status) === 'aguardando cliente'
}

export function taskMatchesDeadline(task = {}, scope = 'all', day) {
  return deadlineMatchesScope({
    due: dueDate(task),
    scope,
    day,
    waiting: isWaitingClient(task),
    completed: isDone(task.status),
  })
}

function matchesContext(task, { clientId = '', responsible = '', department = '' } = {}) {
  if (clientId && String(task.clientId || '') !== String(clientId)) return false
  if (responsible && String(task.responsavel || '') !== String(responsible)) return false
  if (department && String(task.departamento || '') !== String(department)) return false
  return true
}

function priorityWeight(value) {
  const priority = normalizeText(value)
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
