export function taskDeletionMessage(task = {}) {
  const title = String(task.titulo || 'esta tarefa').trim() || 'esta tarefa'
  const base = `Excluir a tarefa "${title}"? Esta ação não pode ser desfeita.`
  if (!task.recorrencia) return base
  return `${base}\n\nSomente esta ocorrência será removida. As próximas ocorrências continuam sendo controladas pelo calendário da recorrência.`
}

export function removeTaskOccurrence(tasks = [], task) {
  if (!task?.id) return [...tasks]
  return tasks.filter(item => item.id !== task.id)
}
