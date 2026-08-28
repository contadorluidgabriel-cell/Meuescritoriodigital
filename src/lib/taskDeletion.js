import { appendNextRecurringTask } from './taskRecurrence.js'

export function taskDeletionMessage(task = {}) {
  const title = String(task.titulo || 'esta tarefa').trim() || 'esta tarefa'
  const base = `Excluir a tarefa "${title}"? Esta ação não pode ser desfeita.`
  if (!task.recorrencia) return base
  return `${base}\n\nComo ela é recorrente, somente esta ocorrência será removida e a próxima será mantida.`
}

export function removeTaskOccurrence(tasks = [], task, clients = []) {
  if (!task?.id) return [...tasks]
  const remaining = tasks.filter(item => item.id !== task.id)
  if (!task.recorrencia) return remaining
  return appendNextRecurringTask(remaining, task, clients)
}
