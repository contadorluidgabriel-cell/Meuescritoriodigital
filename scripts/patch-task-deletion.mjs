import { readFileSync, writeFileSync } from 'node:fs'

export function applyTaskDeletionPatch(root) {
  const path = `${root}src/components/TasksReactBase.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes("taskDeletionMessage(task)")) return

  const replacements = [
    [
      "import { appendNextRecurringTask, reconcileGoogleTaskPayload } from '../lib/taskRecurrence.js'",
      "import { appendNextRecurringTask, reconcileGoogleTaskPayload } from '../lib/taskRecurrence.js'\nimport { removeTaskOccurrence, taskDeletionMessage } from '../lib/taskDeletion.js'",
      'deletion helper import',
    ],
    [
      "  function commitTasks(nextTasks) {\n    update(draft => { draft.tasks = nextTasks })\n    google.schedule(nextTasks)\n  }",
      "  function commitTasks(nextTasks) {\n    update(draft => { draft.tasks = nextTasks })\n    google.schedule(nextTasks)\n  }\n  function deleteTask(task) {\n    if (!task?.id || !window.confirm(taskDeletionMessage(task))) return\n    const nextTasks = removeTaskOccurrence(office.tasks || [], task, office.clients || [])\n    commitTasks(nextTasks)\n    setSelected(current => {\n      const next = new Set(current)\n      next.delete(task.id)\n      return next\n    })\n    if (editing?.id === task.id) setEditing(null)\n    setNotice(task.recorrencia ? 'Ocorrência excluída. A próxima tarefa recorrente foi mantida.' : 'Tarefa excluída.')\n  }",
      'delete task function',
    ],
    [
      "<div className=\"task-row-actions\"><button className={done ? '' : 'primary'} onClick={() => toggleTask(task.id)}>{done ? 'Reabrir' : 'Concluir'}</button><button onClick={() => duplicateTask(task.id)}>Duplicar</button><button onClick={() => openEdit(task)}>Editar</button></div>",
      "<div className=\"task-row-actions\"><button className={done ? '' : 'primary'} onClick={() => toggleTask(task.id)}>{done ? 'Reabrir' : 'Concluir'}</button><button onClick={() => duplicateTask(task.id)}>Duplicar</button><button onClick={() => openEdit(task)}>Editar</button><button className=\"danger\" onClick={() => deleteTask(task)}>Excluir</button></div>",
      'task row delete button',
    ],
    [
      "{error ? <p className=\"task-error\">{error}</p> : null}<footer className=\"task-form-actions\"><button type=\"button\" onClick={() => setEditing(null)}>Cancelar</button><button className=\"primary\">Salvar tarefa</button></footer>",
      "{error ? <p className=\"task-error\">{error}</p> : null}<footer className=\"task-form-actions\">{editing.id ? <button type=\"button\" className=\"danger\" onClick={() => deleteTask(editing)}>Excluir tarefa</button> : null}<button type=\"button\" onClick={() => setEditing(null)}>Cancelar</button><button className=\"primary\">Salvar tarefa</button></footer>",
      'task edit delete button',
    ],
  ]

  for (const [from, to, label] of replacements) {
    if (!source.includes(from)) throw new Error(`Task deletion patch failed (${label}) in ${path}`)
    source = source.replace(from, to)
  }

  writeFileSync(path, source)
}
