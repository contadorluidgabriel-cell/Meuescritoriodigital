import { isDone, today, uid } from './storage.js'
import { reconcileExternalTaskPayload, taskCompletionBlocker } from './taskProgress.js'

const normalizeRecurrence = value => String(value || '').trim().toLowerCase()
const COMPETENCIA_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

export function competenciaStepMonths(recurrence) {
  const value = normalizeRecurrence(recurrence)
  if (['monthly', 'mensal'].includes(value)) return 1
  if (value === 'bimestral') return 2
  if (['quarterly', 'trimestral'].includes(value)) return 3
  if (value === 'semestral') return 6
  if (['yearly', 'anual'].includes(value)) return 12
  return 0
}

export function shouldAutoAdvanceCompetencia(task = {}) {
  if (!task.usaCompetencia || !COMPETENCIA_PATTERN.test(String(task.competencia || ''))) return false
  if (competenciaStepMonths(task.recorrencia) <= 0) return false
  return task.competenciaAvancoAutomatico !== false
}

export function taskCompetenciaError(task = {}) {
  if (!task.usaCompetencia) return ''
  if (!COMPETENCIA_PATTERN.test(String(task.competencia || ''))) return 'Informe uma competência válida.'
  return ''
}

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

export function nextTaskCompetencia(competencia, recurrence, autoAdvance = true) {
  const match = String(competencia || '').match(COMPETENCIA_PATTERN)
  if (!match) return ''
  const step = competenciaStepMonths(recurrence)
  if (!autoAdvance || step <= 0) return String(competencia)

  const sourceIndex = Number(match[1]) * 12 + Number(match[2]) - 1
  const targetIndex = sourceIndex + step
  const year = Math.floor(targetIndex / 12)
  const month = targetIndex % 12 + 1
  return `${year}-${String(month).padStart(2, '0')}`
}


function recurrenceSeriesId(task = {}) {
  return String(task.serieRecorrenciaId || task.id || '')
}

function recurringOccurrenceExists(tasks = [], source = {}, due = '', competencia = '') {
  const sourceSeries = recurrenceSeriesId(source)
  return (tasks || []).find(item => {
    if (String(item.id || '') === String(source.id || '')) return false
    if (String(item.prazo || '') !== String(due || '')) return false
    if (normalizeRecurrence(item.recorrencia) !== normalizeRecurrence(source.recorrencia)) return false
    const itemSeries = String(item.serieRecorrenciaId || '')
    if (sourceSeries && itemSeries && itemSeries === sourceSeries) return true
    return String(item.clientId || '') === String(source.clientId || '')
      && String(item.titulo || '') === String(source.titulo || '')
      && (!source.usaCompetencia || (Boolean(item.usaCompetencia) && String(item.competencia || '') === String(competencia || '')))
  }) || null
}

function recurrenceCutoff(recurrence, day = today()) {
  const current = new Date(`${day}T12:00:00`)
  if (Number.isNaN(current.getTime())) return day
  if (competenciaStepMonths(recurrence) > 0) {
    return new Date(current.getFullYear(), current.getMonth() + 1, 0, 12).toISOString().slice(0, 10)
  }
  return day
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

  const autoAdvanceCompetencia = shouldAutoAdvanceCompetencia(task)
  const nextCompetencia = task.usaCompetencia && task.competencia
    ? nextTaskCompetencia(task.competencia, task.recorrencia, autoAdvanceCompetencia)
    : ''
  const alreadyExists = recurringOccurrenceExists(current, task, nextDue, nextCompetencia)
  if (alreadyExists) return { tasks: current, generatedTaskId: '' }

  const generatedTaskId = uid('tar')
  const now = new Date().toISOString()
  const nextTask = {
    ...structuredClone(task),
    id: generatedTaskId,
    serieRecorrenciaId: recurrenceSeriesId(task),
    status: 'Pendente',
    prazo: nextDue,
    planejadoPara: '',
    completedAt: '',
    concluidoEm: '',
    usaCompetencia: Boolean(task.usaCompetencia),
    competencia: task.usaCompetencia ? (nextCompetencia || task.competencia || '') : '',
    competenciaAvancoAutomatico: Boolean(task.usaCompetencia && autoAdvanceCompetencia),
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


export function reconcileRecurringTaskCalendar(tasks = [], clients = [], day = today()) {
  let current = structuredClone(tasks || [])
  let generatedCount = 0
  const seeds = [...current]
    .filter(task => task?.recorrencia && task?.prazo && recurringClientIsActive(task, clients))
    .sort((a, b) => String(a.prazo || '').localeCompare(String(b.prazo || '')))

  for (const seed of seeds) {
    const cutoff = recurrenceCutoff(seed.recorrencia, day)
    let cursor = seed
    let guard = 0

    while (guard < 62) {
      guard += 1
      const nextDue = nextTaskDue(cursor.prazo, cursor.recorrencia)
      if (!nextDue || nextDue > cutoff) break

      const autoAdvanceCompetencia = shouldAutoAdvanceCompetencia(cursor)
      const nextCompetencia = cursor.usaCompetencia && cursor.competencia
        ? nextTaskCompetencia(cursor.competencia, cursor.recorrencia, autoAdvanceCompetencia)
        : ''

      const existing = recurringOccurrenceExists(current, cursor, nextDue, nextCompetencia)
      if (existing) {
        cursor = existing
        continue
      }

      const result = appendNextRecurringTaskWithMeta(current, cursor, clients)
      if (!result.generatedTaskId) break
      current = result.tasks
      generatedCount += 1
      cursor = current.find(item => String(item.id) === String(result.generatedTaskId)) || cursor
    }
  }

  return { tasks: current, changed: generatedCount > 0, generatedCount }
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
