import { isDone, today, uid } from './storage.js'
import { reconcileExternalTaskPayload, taskCompletionBlocker } from './taskProgress.js'

export function nextTaskDue(date, recurrence) {
  const next = new Date(`${date || today()}T12:00:00`)
  if (recurrence === 'daily') next.setDate(next.getDate() + 1)
  if (recurrence === 'weekly') next.setDate(next.getDate() + 7)
  if (recurrence === 'monthly') {
    const wantedDay = next.getDate()
    next.setDate(1)
    next.setMonth(next.getMonth() + 1)
    next.setDate(Math.min(wantedDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))
  }
  return next.toISOString().slice(0, 10)
}

export function appendNextRecurringTask(tasks, task, clients) {
  if (!task.recorrencia) return tasks
  if (task.clientId) {
    const client = clients.find(item => item.id === task.clientId)
    if (!client || client.status === 'Inativo') return tasks
  }
  const nextDue = nextTaskDue(task.prazo, task.recorrencia)
  const alreadyExists = tasks.some(item => item.id !== task.id && item.titulo === task.titulo && item.clientId === task.clientId && item.recorrencia === task.recorrencia && item.prazo === nextDue)
  if (alreadyExists) return tasks
  return [...tasks, {
    ...structuredClone(task), id: uid('tar'), status: 'Pendente', prazo: nextDue,
    subtarefas: (task.subtarefas || []).map(item => ({ ...item, id: uid('sub'), concluida: false })),
    quantidadeConcluida: task.quantitativo ? 0 : task.quantidadeConcluida,
    updatedAt: new Date().toISOString(),
  }]
}

export function reconcileGoogleTaskPayload(remoteTasks, currentTasks, clients) {
  const currentById = new Map(currentTasks.map(task => [String(task.id), task]))
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
