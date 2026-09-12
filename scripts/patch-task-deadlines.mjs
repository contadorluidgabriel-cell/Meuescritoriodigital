import { readFileSync, writeFileSync } from 'node:fs'

export function applyTaskDeadlinesPatch(root) {
  const appPath = `${root}src/App.jsx`
  let appSource = readFileSync(appPath, 'utf8')
  const navigationMarker = 'onNavigate={navigate} initialClientId={taskClientId}'

  if (!appSource.includes(navigationMarker)) {
    const from = "{view === 'tarefas' ? <TasksReact office={office} update={update} sync={sync} session={session} initialClientId={taskClientId}"
    const to = "{view === 'tarefas' ? <TasksReact office={office} update={update} sync={sync} session={session} onNavigate={navigate} initialClientId={taskClientId}"
    if (!appSource.includes(from)) throw new Error('Task deadlines patch failed (task navigation)')
    appSource = appSource.replace(from, to)
    writeFileSync(appPath, appSource)
  }

  const taskPath = `${root}src/components/TasksReactBase.jsx`
  let taskSource = readFileSync(taskPath, 'utf8')
  const formMarker = 'Antecedência no Meu Dia'
  if (taskSource.includes(formMarker)) return

  const defaultsFrom = "status: 'Pendente', recorrencia: '',"
  const defaultsTo = "status: 'Pendente', recorrencia: '', antecedenciaDias: 0,"
  if (!taskSource.includes(defaultsFrom)) throw new Error('Task deadlines patch failed (advance default)')
  taskSource = taskSource.replace(defaultsFrom, defaultsTo)

  const saveFrom = 'status: editing.status, recorrencia: editing.recorrencia,'
  const saveTo = "status: editing.status, recorrencia: editing.recorrencia,\n      antecedenciaDias: editing.prazo ? Math.max(0, Math.min(90, Number(editing.antecedenciaDias) || 0)) : 0,"
  if (!taskSource.includes(saveFrom)) throw new Error('Task deadlines patch failed (advance save)')
  taskSource = taskSource.replace(saveFrom, saveTo)

  const deadlineField = '<Field label="Prazo"><input type="date" value={editing.prazo} onChange={event => setField(\'prazo\', event.target.value)} /></Field>'
  const advanceField = `${deadlineField}<Field label="Antecedência no Meu Dia" full><select value={Number(editing.antecedenciaDias || 0)} onChange={event => setField('antecedenciaDias', Number(event.target.value))} disabled={!editing.prazo}><option value={0}>No dia do prazo</option><option value={1}>1 dia antes</option><option value={3}>3 dias antes</option><option value={5}>5 dias antes</option><option value={7}>7 dias antes</option><option value={10}>10 dias antes</option><option value={15}>15 dias antes</option><option value={30}>30 dias antes</option></select>{editing.prazo ? <small>Enquanto estiver dentro dessa antecedência, a tarefa aparece no Meu Dia até ser concluída.</small> : <small>Defina um prazo para escolher a antecedência.</small>}</Field>`
  if (!taskSource.includes(deadlineField)) throw new Error('Task deadlines patch failed (advance form)')
  taskSource = taskSource.replace(deadlineField, advanceField)

  writeFileSync(taskPath, taskSource)
}
