import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label, path) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`Task assignee patch failed (${label}) in ${path}`)
  return source.replace(from, to)
}

export function applyTaskAssigneeSelectPatch(root) {
  const path = `${root}src/components/TasksReactBase.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes('MED_TASK_ASSIGNEE_SELECT_V1')) return

  source = replaceRequired(
    source,
    "import SharedResponsibilityField, { SharedResponsibilityBadge } from './SharedResponsibilityField.jsx'",
    "import SharedResponsibilityField, { SharedResponsibilityBadge } from './SharedResponsibilityField.jsx'\nimport TaskAssigneeSelect from './TaskAssigneeSelect.jsx'",
    'assignee component import',
    path,
  )

  source = replaceRequired(
    source,
    "titulo: '', descricao: '', clientId: '', departamento: '', responsavel: '', prazo: '', prioridade: 'Normal',",
    "titulo: '', descricao: '', clientId: '', departamento: '', responsavel: '', responsavelUserId: '', prazo: '', prioridade: 'Normal',",
    'assignee default field',
    path,
  )

  source = replaceRequired(
    source,
    "  const currentTaskUserId = String(access?.membership?.user_id || session?.user?.id || '')",
    "  const currentTaskUserId = String(access?.membership?.user_id || session?.user?.id || '')\n  const currentTaskUserName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email || access?.membership?.display_name || access?.membership?.email || 'Você'\n  const MED_TASK_ASSIGNEE_SELECT_V1 = true",
    'current assignee identity',
    path,
  )

  source = replaceRequired(
    source,
    "  function openNew(clientId = '') { setEditing({ ...emptyTask, clientId, subtarefas: [] }); setError('') }",
    "  function openNew(clientId = '') { setEditing({ ...emptyTask, clientId, responsavelUserId: currentTaskUserId, responsavel: currentTaskUserName, subtarefas: [] }); setError('') }",
    'new task current assignee',
    path,
  )

  source = replaceRequired(
    source,
    "    if (!editing.titulo.trim()) { setError('Informe o título da tarefa.'); return }",
    "    if (!editing.titulo.trim()) { setError('Informe o título da tarefa.'); return }\n    if (!String(editing.responsavelUserId || '').trim()) { setError('Selecione o responsável da tarefa.'); return }",
    'assignee validation',
    path,
  )

  source = replaceRequired(
    source,
    "      departamento: editing.departamento, responsavel: editing.responsavel.trim(), prazo: editing.prazo, prioridade: editing.prioridade,",
    "      departamento: editing.departamento, responsavel: String(editing.responsavel || '').trim(), responsavelUserId: String(editing.responsavelUserId || ''), prazo: editing.prazo, prioridade: editing.prioridade,",
    'assignee save',
    path,
  )

  source = replaceRequired(
    source,
    '<Field label="Responsável"><input value={editing.responsavel} onChange={event => setField(\'responsavel\', event.target.value)} /></Field>',
    '<Field label="Responsável"><TaskAssigneeSelect access={access} value={editing.responsavelUserId || \'\'} currentUserId={currentTaskUserId} currentUserName={currentTaskUserName} onChange={assignee => setEditing(current => ({ ...current, responsavelUserId: assignee.userId, responsavel: assignee.name }))} /></Field>',
    'assignee select field',
    path,
  )

  writeFileSync(path, source)
}
