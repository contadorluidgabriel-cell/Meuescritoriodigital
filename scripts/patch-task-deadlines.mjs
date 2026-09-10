import { readFileSync, writeFileSync } from 'node:fs'

export function applyTaskDeadlinesPatch(root) {
  const path = `${root}src/App.jsx`
  let source = readFileSync(path, 'utf8')
  const marker = 'onNavigate={navigate} initialClientId={taskClientId}'
  if (source.includes(marker)) return

  const from = "{view === 'tarefas' ? <TasksReact office={office} update={update} sync={sync} session={session} initialClientId={taskClientId}"
  const to = "{view === 'tarefas' ? <TasksReact office={office} update={update} sync={sync} session={session} onNavigate={navigate} initialClientId={taskClientId}"
  if (!source.includes(from)) throw new Error('Task deadlines patch failed (task navigation)')
  source = source.replace(from, to)
  writeFileSync(path, source)
}
