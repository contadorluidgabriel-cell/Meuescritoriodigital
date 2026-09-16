import { isDone, today, uid } from './storage.js'
import { reconcileExternalTaskPayload, taskCompletionBlocker } from './taskProgress.js'

const normalizeRecurrence = value => String(value || '').trim().toLowerCase()
const COMPETENCIA_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

export function nextTaskDue(date, recurrence) {
  const source = date || today()
  const next = new Date(`${source}T12:00:00`)
  if (Number.isNaN(next.getTime())) return ''
  const value = normalizeRecurrence(recurrence)
  if (['daily', 'diaria', 'diária'].includes(value)) next.setDate(next.getDate() + 1)
  else if (['weekly', 'semanal'].includes(value)) next.setDate(next.getDate() + 7)
  else if (['biweekly', 'quinzenal'].includes(value)) next.setDate(next.getDate() + 15)
  else if (['monthly', 'mensal'].includes(value)) {
    const wantedDay = next.getDate()
    next.setDate(1)
    next.setMonth(next.getMonth() + 1)
    next.setDate(Math.min(wantedDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))
  } else if (value === 'bimestral') {
    const wantedDay = next.getDate()
    next.setDate(1); next.setMonth(next.getMonth() + 2)
    next.setDate(Math.min(wantedDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))
  } else if (['quarterly', 'trimestral'].includes(value)) {
    const wantedDay = next.getDate()
    next.setDate(1); next.setMonth(next.getMonth() + 3)
    next.setDate(Math.min(wantedDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))
  } else if (value === 'semestral') {
    const wantedDay = next.getDate()
    next.setDate(1); next.setMonth(next.getMonth() + 6)
    next.setDate(Math.min(wantedDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))
  } else if (['yearly', 'anual'].includes(value)) {
    const month = next.getMonth(), wantedDay = next.getDate()
    next.setDate(1); next.setFullYear(next.getFullYear() + 1); next.setMonth(month)
    next.setDate(Math.min(wantedDay, new Date(next.getFullYear(), month + 1, 0).getDate()))
  } else return ''
  return next.toISOString().slice(0, 10)
}

export function nextTaskCompetencia(competencia, currentDue, nextDue) {
  const match = String(competencia || '').match(COMPETENCIA_PATTERN)
  if (!match) return ''

  let deltaMonths = 1
  const currentMatch = String(currentDue || '').match(/^(\d{4})-(\d{2})-\d{2}$/)
  const nextMatch = String(nextDue || '').match(/^(\d{4})-(\d{2})-\d{2}$/)
  if (currentMatch && nextMatch) {
    const currentIndex = Number(currentMatch[1]) * 12 + Number(currentMatch[2]) - 1
    const nextIndex = Number(nextMatch[1]) * 12 + Number(nextMatch[2]) - 1
    deltaMonths = Math.max(0, nextIndex - currentIndex)
  }

  const sourceIndex = Number(match[1]) * 12 + Number(match[2]) - 1
  const targetIndex = sourceIndex + deltaMonths
  const year = Math.floor(targetIndex / 12)
  const month = targetIndex % 12 + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

function recurringClientIsActive(task, clients = []) {
  if (!task.clientId || !Array.isArray(clients) || !clients.length) return true
  const client = clients.find(item => String(item.id) === String(task.clientId))
  return Boolean(client && client.status !== 'Inativo')
}

export function appendNextRecurringTaskWithMeta(tasks = [], task = {}, clients = []) {
  const current = structuredClone(tasks || [])
  if (!task.recorrencia || !task.prazo || !recurringClientIsActive(task, clients)) return { tasks: current, generatedTaskId: '' }
  const nextDue = nextTaskDue(task.prazo, task.recorrencia)
  if (!nextDue) return { tasks: current, generatedTaskId: '' }
  const alreadyExists = current.some(item => String(item.id) !== String(task.id)
    && String(item.clientId || '') === String(task.clientId || '')
    && String(item.titulo || '') === String(task.titulo || '')
    && normalizeRecurrence(item.recorrencia) === normalizeRecurrence(task.recorrencia)
    && String(item.prazo || '') === nextDue
    && !isDone(item.status))
  if (alreadyExists) return { tasks: current, generatedTaskId: '' }

  const generatedTaskId = uid('tar')
  const now = new Date().toISOString()
  const nextCompetencia = task.usaCompetencia && task.competencia
    ? nextTaskCompetencia(task.competencia, task.prazo, nextDue)
    : ''
  const nextTask = {
    ...structuredClone(task),
    id: generatedTaskId,
    status: 'Pendente',
    prazo: nextDue,
    planejadoPara: '',
    completedAt: '',
    concluidoEm: '',
    usaCompetencia: Boolean(task.usaCompetencia),
    competencia: task.usaCompetencia ? (nextCompetencia || task.competencia || '') : '',
    observacao: '',
    comentarios: [],
    subtarefas: (task.subtarefas || []).map(item => ({ ...structuredClone(item), id: uid('sub'), concluida: false })),
    quantidadeConcluida: task.quantitativo ? 0 : task.quantidadeConcluida,
    createdAt: now,
    updatedAt: now,
  }
  return { tasks: [...current, nextTask], generatedTaskId }
}

export function appendNextRecurringTask(tasks, task, clients = []) {
  return appendNextRecurringTaskWithMeta(tasks, task, clients).tasks
}

export function reconcileGoogleTaskPayload(remoteTasks, currentTasks, clients) {
  const currentById = new Map((currentTasks || []).map(task => [String(task.id), task]))
  let nextTasks = reconcileExternalTaskPayload(remoteTasks, currentTasks)
  nextTasks = nextTasks.map(task => {
    const previous = currentById.get(String(task.id))
    if (previous && !isDone(previous.status) && isDone(task.status) && taskCompletionBlocker(task)) {
      return { ...task, status: previous.status }
    }
    return task
  })
  nextTasks.forEach(task => {
    const previous = currentById.get(String(task.id))
    if (previous && !isDone(previous.status) && isDone(task.status)) {
      nextTasks = appendNextRecurringTask(nextTasks, task, clients)
    }
  })
  return nextTasks
}
