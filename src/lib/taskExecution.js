import { isDone } from './storage.js'
import { taskCompletionBlocker, taskProgress } from './taskProgress.js'
import { appendNextRecurringTaskWithMeta } from './taskRecurrence.js'

const clone = value => value == null ? value : structuredClone(value)

export function taskExecutionState(task = {}) {
  const subtasks = Array.isArray(task.subtarefas) ? task.subtarefas : []
  const subtaskDone = subtasks.filter(item => item.concluida).length
  const progress = taskProgress(task)
  const blocker = isDone(task.status) ? '' : taskCompletionBlocker(task)
  return {
    done: isDone(task.status),
    blocker,
    canComplete: !isDone(task.status) && !blocker,
    hasSubtasks: subtasks.length > 0,
    subtasks,
    subtaskDone,
    subtaskTotal: subtasks.length,
    quantitative: progress.enabled,
    progress,
  }
}

export function completeTask(tasks = [], taskId, { clients = [] } = {}) {
  const nextTasks = clone(tasks) || []
  const index = nextTasks.findIndex(item => String(item.id) === String(taskId))
  if (index < 0) return { tasks: nextTasks, changed: false, error: 'Tarefa não encontrada.' }
  const current = nextTasks[index]
  if (isDone(current.status)) return { tasks: nextTasks, changed: false, error: 'A tarefa já está concluída.' }
  const blocker = taskCompletionBlocker(current)
  if (blocker) return { tasks: nextTasks, changed: false, error: blocker }
  const completedAt = new Date().toISOString()
  const completed = { ...current, status: 'Concluída', updatedAt: completedAt, completedAt }
  nextTasks[index] = completed
  const recurring = appendNextRecurringTaskWithMeta(nextTasks, completed, clients)
  return {
    tasks: recurring.tasks,
    changed: true,
    task: completed,
    transaction: {
      type: 'complete',
      taskId: String(taskId),
      previousStatus: current.status || 'Pendente',
      previousCompletedAt: current.completedAt || '',
      generatedTaskId: recurring.generatedTaskId,
    },
  }
}

export function reopenTask(tasks = [], taskId) {
  const nextTasks = clone(tasks) || []
  const index = nextTasks.findIndex(item => String(item.id) === String(taskId))
  if (index < 0) return { tasks: nextTasks, changed: false, error: 'Tarefa não encontrada.' }
  if (!isDone(nextTasks[index].status)) return { tasks: nextTasks, changed: false, error: 'A tarefa já está aberta.' }
  nextTasks[index] = { ...nextTasks[index], status: 'Pendente', completedAt: '', updatedAt: new Date().toISOString() }
  return { tasks: nextTasks, changed: true, task: nextTasks[index] }
}

export function undoTaskCompletion(tasks = [], transaction = {}) {
  if (transaction?.type !== 'complete' || !transaction.taskId) return { tasks: clone(tasks) || [], changed: false, error: 'Não há conclusão para desfazer.' }
  let nextTasks = clone(tasks) || []
  const index = nextTasks.findIndex(item => String(item.id) === String(transaction.taskId))
  if (index < 0) return { tasks: nextTasks, changed: false, error: 'A tarefa original não foi encontrada.' }
  nextTasks[index] = {
    ...nextTasks[index],
    status: transaction.previousStatus || 'Pendente',
    completedAt: transaction.previousCompletedAt || '',
    updatedAt: new Date().toISOString(),
  }
  if (transaction.generatedTaskId) nextTasks = nextTasks.filter(item => String(item.id) !== String(transaction.generatedTaskId))
  return { tasks: nextTasks, changed: true, task: nextTasks.find(item => String(item.id) === String(transaction.taskId)) }
}

export function toggleSubtask(tasks = [], taskId, subtaskIndex) {
  const nextTasks = clone(tasks) || []
  const index = nextTasks.findIndex(item => String(item.id) === String(taskId))
  if (index < 0) return { tasks: nextTasks, changed: false, error: 'Tarefa não encontrada.' }
  const task = nextTasks[index]
  if (isDone(task.status)) return { tasks: nextTasks, changed: false, error: 'Reabra a tarefa antes de alterar as subtarefas.' }
  const subtasks = Array.isArray(task.subtarefas) ? clone(task.subtarefas) : []
  if (!subtasks[subtaskIndex]) return { tasks: nextTasks, changed: false, error: 'Subtarefa não encontrada.' }
  subtasks[subtaskIndex] = { ...subtasks[subtaskIndex], concluida: !subtasks[subtaskIndex].concluida }
  nextTasks[index] = { ...task, subtarefas: subtasks, updatedAt: new Date().toISOString() }
  return { tasks: nextTasks, changed: true, task: nextTasks[index] }
}

export function addTaskProgress(tasks = [], taskId, amount) {
  const nextTasks = clone(tasks) || []
  const index = nextTasks.findIndex(item => String(item.id) === String(taskId))
  if (index < 0) return { tasks: nextTasks, changed: false, error: 'Tarefa não encontrada.' }
  const task = nextTasks[index]
  if (isDone(task.status)) return { tasks: nextTasks, changed: false, error: 'A tarefa já está concluída.' }
  const progress = taskProgress(task)
  if (!progress.enabled) return { tasks: nextTasks, changed: false, error: 'Esta tarefa não usa controle quantitativo.' }
  const delta = Number(amount)
  if (!Number.isFinite(delta) || delta === 0) return { tasks: nextTasks, changed: false, error: 'Informe uma quantidade válida.' }
  const current = Math.max(0, Math.min(progress.total, progress.current + delta))
  if (current === progress.current) return { tasks: nextTasks, changed: false, error: current >= progress.total ? 'A meta já foi atingida.' : 'Não há progresso para reduzir.' }
  nextTasks[index] = { ...task, quantidadeConcluida: current, updatedAt: new Date().toISOString() }
  return { tasks: nextTasks, changed: true, task: nextTasks[index] }
}
