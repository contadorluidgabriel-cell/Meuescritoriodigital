import { readFileSync } from 'node:fs'

export function inspectTaskSource(root) {
  const source = readFileSync(`${root}src/components/TasksReactBase.jsx`, 'utf8')
  console.log(`\n[task-source] START\n${source.slice(0, 3600)}\n[/task-source]\n`)
  const needles = ['setEditing(task)', 'row-actions', '>Editar<', 'Salvar tarefa', 'task-row', 'openEdit', 'useGoogleTasks', 'export default function']
  for (const needle of needles) {
    let index = source.indexOf(needle)
    if (index < 0) {
      console.log(`[task-source] ${needle}: NOT FOUND`)
      continue
    }
    while (index >= 0) {
      const start = Math.max(0, index - 700)
      const end = Math.min(source.length, index + needle.length + 900)
      console.log(`\n[task-source] ${needle} @ ${index}\n${source.slice(start, end)}\n[/task-source]\n`)
      index = source.indexOf(needle, index + needle.length)
    }
  }
}
