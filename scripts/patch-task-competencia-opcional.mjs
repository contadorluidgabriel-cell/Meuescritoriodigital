import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label, path) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`Task competencia patch failed (${label}) in ${path}`)
  return source.replace(from, to)
}

function insertBefore(source, marker, content, label, path) {
  if (source.includes(content.trim())) return source
  const index = source.indexOf(marker)
  if (index < 0) throw new Error(`Task competencia patch failed (${label}) in ${path}`)
  return source.slice(0, index) + content + source.slice(index)
}

export function applyTaskCompetenciaOpcionalPatch(root) {
  const path = `${root}src/components/TasksReactBase.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes('MED_TASK_COMPETENCIA_OPTIONAL_V1')) return

  source = replaceRequired(
    source,
    "  const [historyPeriod, setHistoryPeriod] = useState('90')",
    "  const [historyPeriod, setHistoryPeriod] = useState('90')\n  const [competenciaFilter, setCompetenciaFilter] = useState('')\n  const [historyCompetencia, setHistoryCompetencia] = useState('')\n  const MED_TASK_COMPETENCIA_OPTIONAL_V1 = true",
    'competencia state',
    path,
  )

  source = insertBefore(
    source,
    '  function taskCompletedAt(task) {',
    `  function formatTaskCompetencia(value) {\n    const match = String(value || '').match(/^(\\d{4})-(\\d{2})$/)\n    return match ? match[2] + '/' + match[1] : String(value || '')\n  }\n\n`,
    'competencia formatter',
    path,
  )

  source = replaceRequired(
    source,
    '{rows.filter(task => !isDone(task.status)).map(task => {',
    "{rows.filter(task => !isDone(task.status) && (!competenciaFilter || String(task.competencia || '') === competenciaFilter)).map(task => {",
    'main competencia filter',
    path,
  )

  source = replaceRequired(
    source,
    "{!rows.filter(task => !isDone(task.status)).length ? <div className=\"empty\">Nenhuma tarefa em aberto encontrada.</div> : null}",
    "{!rows.filter(task => !isDone(task.status) && (!competenciaFilter || String(task.competencia || '') === competenciaFilter)).length ? <div className=\"empty\">Nenhuma tarefa em aberto encontrada.</div> : null}",
    'main competencia empty state',
    path,
  )

  source = replaceRequired(
    source,
    '<div className="task-filters"><input placeholder="Buscar tarefa, cliente ou responsável" value={query} onChange={event => setQuery(event.target.value)} /><select value={status}',
    '<div className="task-filters"><input placeholder="Buscar tarefa, cliente ou responsável" value={query} onChange={event => setQuery(event.target.value)} /><input type="month" value={competenciaFilter} onChange={event => setCompetenciaFilter(event.target.value)} aria-label="Filtrar por competência" title="Filtrar por competência" /><select value={status}',
    'main competencia control',
    path,
  )

  source = replaceRequired(
    source,
    "{task.quantitativo ? <small>Quantitativo · {taskProgressLabel(task)}</small> : null}<SharedResponsibilityBadge",
    "{task.quantitativo ? <small>Quantitativo · {taskProgressLabel(task)}</small> : null}{task.usaCompetencia && task.competencia ? <small>Competência · {formatTaskCompetencia(task.competencia)}</small> : null}<SharedResponsibilityBadge",
    'competencia badge',
    path,
  )

  source = replaceRequired(
    source,
    "const searchable = [task.titulo, task.descricao, task.observacao, clientName(client), ...taskComments(task).map(item => item.texto)].filter(Boolean).join(' ').toLowerCase()",
    "const searchable = [task.titulo, task.descricao, task.observacao, task.competencia, formatTaskCompetencia(task.competencia), clientName(client), ...taskComments(task).map(item => item.texto)].filter(Boolean).join(' ').toLowerCase()",
    'history competencia search',
    path,
  )

  source = replaceRequired(
    source,
    "    if (historyClient && String(task.clientId || '') !== String(historyClient)) return false\n    return true",
    "    if (historyClient && String(task.clientId || '') !== String(historyClient)) return false\n    if (historyCompetencia && String(task.competencia || '') !== String(historyCompetencia)) return false\n    return true",
    'history competencia filter',
    path,
  )

  source = replaceRequired(
    source,
    '[historyClient, historyPeriod, historyQuery, office.clients, office.tasks])',
    '[historyClient, historyCompetencia, historyPeriod, historyQuery, office.clients, office.tasks])',
    'history competencia dependency',
    path,
  )

  source = replaceRequired(
    source,
    '<select value={historyPeriod} onChange={event => setHistoryPeriod(event.target.value)}><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Último ano</option><option value="0">Todo o histórico</option></select></div>',
    '<select value={historyPeriod} onChange={event => setHistoryPeriod(event.target.value)}><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Último ano</option><option value="0">Todo o histórico</option></select><input type="month" value={historyCompetencia} onChange={event => setHistoryCompetencia(event.target.value)} aria-label="Competência do histórico" title="Filtrar histórico por competência" /></div>',
    'history competencia control',
    path,
  )

  source = replaceRequired(
    source,
    '{clientName(client)} · concluída em ',
    "{clientName(client)}{task.usaCompetencia && task.competencia ? ` · Competência ${formatTaskCompetencia(task.competencia)}` : ''} · concluída em ",
    'history competencia label',
    path,
  )

  source = replaceRequired(
    source,
    '<Field label="Descrição" full><textarea value={editing.descricao} onChange={event => setField(\'descricao\', event.target.value)} /></Field>',
    '<Field label="Controle por competência" full><div className="third-party-toggle"><label><input type="checkbox" checked={Boolean(editing.usaCompetencia)} onChange={event => setEditing(current => ({ ...current, usaCompetencia: event.target.checked, competencia: event.target.checked ? (current.competencia || \'\') : \'\' }))} /> Esta tarefa possui competência contábil</label></div></Field>{editing.usaCompetencia ? <Field label="Competência *"><input type="month" required value={editing.competencia || \'\'} onChange={event => setField(\'competencia\', event.target.value)} /></Field> : null}<Field label="Descrição" full><textarea value={editing.descricao} onChange={event => setField(\'descricao\', event.target.value)} /></Field>',
    'competencia form fields',
    path,
  )

  source = replaceRequired(
    source,
    "status: editing.status, recorrencia: editing.recorrencia, observacao: String(editing.observacao || '').trim(), comentarios: taskComments(editing),",
    "status: editing.status, recorrencia: editing.recorrencia, usaCompetencia: Boolean(editing.usaCompetencia), competencia: editing.usaCompetencia ? String(editing.competencia || '') : '', observacao: String(editing.observacao || '').trim(), comentarios: taskComments(editing),",
    'competencia save',
    path,
  )

  writeFileSync(path, source)

  const cssPath = `${root}src/tasks-react.css`
  let css = readFileSync(cssPath, 'utf8')
  if (!css.includes('MED_TASK_COMPETENCIA_OPTIONAL_CSS_V1')) {
    css += `\n/* MED_TASK_COMPETENCIA_OPTIONAL_CSS_V1 */\n.task-history-filters{grid-template-columns:minmax(220px,1fr) minmax(170px,.55fr) minmax(150px,.35fr) minmax(155px,.35fr)}\n@media(max-width:900px){.task-history-filters{grid-template-columns:1fr 1fr}}\n@media(max-width:600px){.task-history-filters{grid-template-columns:1fr}}\n`
    writeFileSync(cssPath, css)
  }
}
