import { isDone } from './storage.js'

function numberValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export function taskProgress(task = {}) {
  const enabled = Boolean(task.quantitativo)
  const total = enabled ? Math.max(0, numberValue(task.quantidadeTotal)) : 0
  const current = enabled ? Math.max(0, numberValue(task.quantidadeConcluida)) : 0
  const remaining = enabled ? Math.max(0, total - current) : 0
  const pct = enabled && total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  const unit = String(task.unidade || 'itens').trim() || 'itens'
  return { enabled, total, current, remaining, pct, unit }
}

export function quantitativeTaskError(task = {}) {
  if (!task.quantitativo) return ''
  const progress = taskProgress(task)
  if (progress.total <= 0) return 'Informe uma meta total maior que zero para a tarefa quantitativa.'
  if (progress.current > progress.total) return 'A quantidade concluída não pode ser maior que a meta total.'
  return ''
}

export function taskCompletionBlocker(task = {}) {
  const pendingSubtasks = (task.subtarefas || []).filter(item => !item.concluida).length
  if (pendingSubtasks) {
    return `Conclua ${pendingSubtasks} subtarefa${pendingSubtasks === 1 ? '' : 's'} pendente${pendingSubtasks === 1 ? '' : 's'} antes de finalizar esta tarefa.`
  }
  if (task.quantitativo) {
    const progress = taskProgress(task)
    if (progress.total <= 0) return 'Informe a meta quantitativa antes de finalizar esta tarefa.'
    if (progress.current < progress.total) return `Complete a meta quantitativa (${progress.current}/${progress.total} ${progress.unit}) antes de finalizar esta tarefa.`
  }
  return ''
}

export function taskProgressLabel(task = {}) {
  const progress = taskProgress(task)
  if (!progress.enabled) return ''
  return `${progress.current}/${progress.total} ${progress.unit} · ${progress.pct}%`
}

// Estes campos pertencem ao Escritório Digital. Integrações externas podem
// transportar uma cópia antiga deles, mas não são autoridade para alterá-los.
const preservedKeys = [
  'clientId', 'departamento', 'responsavel', 'recorrencia', 'subtarefas',
  'terceirizado', 'terceiroCnpj', 'terceiroNome',
  'quantitativo', 'quantidadeTotal', 'quantidadeConcluida', 'unidade',
]

export function reconcileExternalTaskPayload(remoteTasks = [], currentTasks = []) {
  const currentById = new Map((currentTasks || []).map(task => [String(task.id), task]))
  return (remoteTasks || []).map(remote => {
    const previous = currentById.get(String(remote.id))
    if (!previous) return remote
    const merged = { ...remote }

    for (const key of preservedKeys) {
      if (Object.prototype.hasOwnProperty.call(previous, key)) {
        merged[key] = structuredClone(previous[key])
      }
    }

    if (!isDone(previous.status) && isDone(merged.status) && taskCompletionBlocker({ ...previous, ...merged })) {
      merged.status = previous.status
    }
    return merged
  })
}
