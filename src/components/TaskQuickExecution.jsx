import { useMemo, useState } from 'react'
import { addTaskProgress, completeTask, taskExecutionState, toggleSubtask } from '../lib/taskExecution.js'
import './task-quick-execution.css'

const taskTitle = task => task?.titulo || 'Tarefa'

export default function TaskQuickExecution({ task, tasks = [], update, onOpen, onNotice, onCompleted, compact = false }) {
  const [expanded, setExpanded] = useState(false)
  const state = useMemo(() => taskExecutionState(task), [task])

  function commit(result, message) {
    if (!result?.changed) {
      onNotice?.(result?.error || 'Não foi possível atualizar a tarefa.')
      return false
    }
    update(draft => { draft.tasks = result.tasks })
    if (message) onNotice?.(message)
    return true
  }

  function finish() {
    const result = completeTask(tasks, task.id)
    if (!commit(result, `${taskTitle(task)} concluída.`)) return
    onCompleted?.(result.transaction, taskTitle(task))
  }

  function changeSubtask(index) {
    const result = toggleSubtask(tasks, task.id, index)
    if (!commit(result, 'Etapa atualizada.')) return
  }

  function addProgress(amount) {
    const result = addTaskProgress(tasks, task.id, amount)
    if (!commit(result, result.changed ? 'Progresso atualizado.' : '')) return
  }

  const pendingSubtasks = Math.max(0, state.subtaskTotal - state.subtaskDone)
  const completionHint = pendingSubtasks
    ? `${pendingSubtasks} subtarefa${pendingSubtasks === 1 ? '' : 's'} pendente${pendingSubtasks === 1 ? '' : 's'}`
    : state.quantitative && state.progress.current < state.progress.total
      ? `Meta ${state.progress.current}/${state.progress.total} ${state.progress.unit}`
      : ''

  return <div className={`task-quick ${compact ? 'is-compact' : ''}`} onClick={event => event.stopPropagation()}>
    {state.quantitative ? <div className="task-quick-progress" aria-label={`Progresso ${state.progress.pct}%`}>
      <div><span>Progresso</span><strong>{state.progress.current}/{state.progress.total} {state.progress.unit}</strong><em>{state.progress.pct}%</em></div>
      <div className="task-quick-progress-bar"><i style={{ width: `${state.progress.pct}%` }} /></div>
      {!state.done ? <div className="task-quick-progress-actions">
        <button type="button" onClick={() => addProgress(1)} disabled={state.progress.current >= state.progress.total}>+1</button>
        <button type="button" onClick={() => addProgress(10)} disabled={state.progress.current >= state.progress.total}>+10</button>
      </div> : null}
    </div> : null}

    {state.hasSubtasks ? <div className="task-quick-subtasks">
      <button type="button" className="task-quick-expand" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
        <span>{expanded ? '▾' : '▸'} Etapas</span><strong>{state.subtaskDone}/{state.subtaskTotal}</strong>
      </button>
      {expanded ? <div className="task-quick-checklist">
        {state.subtasks.map((subtask, index) => <label className={subtask.concluida ? 'done' : ''} key={`${task.id}-sub-${index}`}>
          <input type="checkbox" checked={Boolean(subtask.concluida)} disabled={state.done} onChange={() => changeSubtask(index)} />
          <span>{subtask.titulo || subtask.nome || subtask.descricao || `Subtarefa ${index + 1}`}</span>
        </label>)}
      </div> : null}
    </div> : null}

    <div className="task-quick-actions">
      {!state.done ? <button type="button" className="task-quick-complete" onClick={finish} disabled={!state.canComplete} title={state.blocker || 'Concluir tarefa'}>✓ Concluir</button> : <span className="task-quick-done">✓ Concluída</span>}
      <button type="button" className="task-quick-open" onClick={() => onOpen?.(task)}>Abrir</button>
    </div>
    {!state.done && completionHint ? <small className="task-quick-hint">Para concluir: {completionHint}.</small> : null}
  </div>
}
