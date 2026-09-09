import { readFileSync, writeFileSync } from 'node:fs'

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`V12 patch failed (${label})`)
  return source.replace(from, to)
}

function patchCommandCenter(root) {
  const path = `${root}src/components/OperationalCommandCenter.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes("WorkHorizonBoard from './WorkHorizonBoard.jsx'")) return
  source = replaceOrFail(
    source,
    "import TaskQuickExecution from './TaskQuickExecution.jsx'\nimport { undoTaskCompletion } from '../lib/taskExecution.js'",
    "import TaskQuickExecution from './TaskQuickExecution.jsx'\nimport WorkHorizonBoard from './WorkHorizonBoard.jsx'\nimport { undoTaskCompletion } from '../lib/taskExecution.js'",
    'command center V12 import',
  )
  source = replaceOrFail(source, '>Centro de comando</span><h1>Meu Dia</h1>', '>Central de trabalho · V12</span><h1>Meu Dia</h1>', 'command center title')
  source = replaceOrFail(
    source,
    '    <section className="occ-kpis" aria-label="Resumo operacional">',
    '    <WorkHorizonBoard office={office} update={update} onOpenItem={onOpenItem} onNavigate={onNavigate} day={day} />\n\n    <section className="occ-kpis" aria-label="Resumo operacional">',
    'work horizon board',
  )
  writeFileSync(path, source)
}

function patchChrome(root) {
  const path = `${root}src/components/AppChrome.jsx`
  let source = readFileSync(path, 'utf8')
  source = source.replaceAll('Painel Principal', 'Painel do Escritório')
  source = source.replaceAll('V11.1', 'V12.0')
  writeFileSync(path, source)
}

function patchDashboard(root) {
  const path = `${root}src/components/Dashboard.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes("completeTask } from '../lib/taskExecution.js'")) return
  source = replaceOrFail(
    source,
    "import { appendNextRecurringTask, reconcileGoogleTaskPayload } from '../lib/taskRecurrence.js'",
    "import { reconcileGoogleTaskPayload } from '../lib/taskRecurrence.js'\nimport { completeTask } from '../lib/taskExecution.js'",
    'dashboard task domain import',
  )
  source = replaceOrFail(source, '    let changed = 0, changedTask = false', '    let changed = 0, changedTask = false, blockedReasons = []', 'dashboard blocked state')
  source = replaceOrFail(
    source,
    "      if (item.kind === 'task') {\n        const task = next.tasks.find(row => String(row.id) === item.id)\n        if (!task || isDone(task.status)) return\n        task.status = 'Concluída'; task.updatedAt = new Date().toISOString(); title = task.titulo; client = task.clientId ? clientMap.get(String(task.clientId)) || 'Cliente' : 'Interna'; responsible = task.responsavel || responsible\n        next.tasks = appendNextRecurringTask(next.tasks, task, office.clients || []); changedTask = true\n      }",
    "      if (item.kind === 'task') {\n        const task = next.tasks.find(row => String(row.id) === item.id)\n        if (!task || isDone(task.status)) return\n        const result = completeTask(next.tasks, task.id, { clients: office.clients || [] })\n        if (!result.changed) { if (result.error) blockedReasons.push(`${task.titulo || 'Tarefa'}: ${result.error}`); return }\n        next.tasks = result.tasks\n        title = result.task?.titulo || task.titulo\n        client = task.clientId ? clientMap.get(String(task.clientId)) || 'Cliente' : 'Interna'\n        responsible = task.responsavel || responsible\n        changedTask = true\n      }",
    'dashboard central task completion',
  )
  source = replaceOrFail(
    source,
    '    if (!changed) return\n    next.history = nextHistory.slice(0, 500)',
    "    if (!changed) { if (blockedReasons.length) setNotice(blockedReasons[0]); return }\n    next.history = nextHistory.slice(0, 500)",
    'dashboard blocked feedback',
  )
  source = source.replaceAll('pelo Painel Principal.', 'pelo Painel do Escritório.')
  source = replaceOrFail(
    source,
    "    setUndoText(`${changed} item(ns) concluído(s) pelo Painel do Escritório.`)\n    clearTimeout(undoTimer.current)",
    "    setUndoText(`${changed} item(ns) concluído(s) pelo Painel do Escritório.`)\n    if (blockedReasons.length) setNotice(`${blockedReasons.length} tarefa(s) não foram concluídas porque ainda possuem etapas ou meta pendente.`)\n    clearTimeout(undoTimer.current)",
    'dashboard partial blocked feedback',
  )
  writeFileSync(path, source)
}

function patchTaskEditing(root) {
  const path = `${root}src/components/TasksReactBase.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes('V12_PRESERVE_TASK_METADATA')) return

  const quantityAnchor = source.indexOf('const quantityError = quantitativeTaskError(editing)')
  if (quantityAnchor < 0) throw new Error('V12 patch failed (task save validation anchor)')
  const savedAnchor = source.indexOf('    const saved = {', quantityAnchor)
  if (savedAnchor < 0) throw new Error('V12 patch failed (task saved object)')
  source = source.slice(0, savedAnchor)
    + "    const existingTask = editing.id ? (office.tasks || []).find(item => String(item.id) === String(editing.id)) : null // V12_PRESERVE_TASK_METADATA\n    const saved = { ...(existingTask || {}),"
    + source.slice(savedAnchor + '    const saved = {'.length)

  const toggleMarker = '  function toggleSubtask(taskId, index) {\n'
  if (source.includes(toggleMarker)) {
    source = source.replace(toggleMarker, "  function toggleSubtask(taskId, index) {\n    const parentTask = (office.tasks || []).find(item => String(item.id) === String(taskId))\n    if (parentTask && isDone(parentTask.status)) { setNotice('Reabra a tarefa antes de alterar as subtarefas.'); return }\n")
  }
  writeFileSync(path, source)
}

function patchVersionMeta(root) {
  const path = `${root}src/lib/storage.js`
  let source = readFileSync(path, 'utf8')
  if (source.includes("meta: { version: '12.0' }")) return
  source = replaceOrFail(source, "ui: {}, meta: { version: '11.1' }, lastBackup: ''", "ui: {}, meta: { version: '12.0' }, lastBackup: ''", 'storage version')
  writeFileSync(path, source)
}

export function applyV12Patch(root) {
  patchCommandCenter(root)
  patchChrome(root)
  patchDashboard(root)
  patchTaskEditing(root)
  patchVersionMeta(root)
}
