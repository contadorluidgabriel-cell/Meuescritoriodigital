import { readFileSync } from 'node:fs'

function inspect(path, needles) {
  const source = readFileSync(path, 'utf8')
  for (const needle of needles) {
    const index = source.indexOf(needle)
    if (index < 0) {
      console.log(`[inspect] ${path} :: ${needle}: NOT FOUND`)
      continue
    }
    const start = Math.max(0, index - 1400)
    const end = Math.min(source.length, index + needle.length + 2200)
    console.log(`\n[inspect] ${path} :: ${needle}\n${source.slice(start, end)}\n[/inspect]\n`)
  }
}

export function inspectQuantitativeAndAvulsos(root) {
  inspect(`${root}src/components/TasksReactBase.jsx`, [
    'const emptyTask =',
    'const activeClients =',
    'function toggleTask',
    'function completeSelected',
    'function saveTask',
    '<Field label="Cliente">',
    '<Field label="Subtarefas"',
    '<div className="task-title">',
  ])
  inspect(`${root}src/components/ProcessesReact.jsx`, [
    'const activeClients =',
    'clientChoices',
    '<Field label="Cliente',
    'clientId',
    'function ProcessForm',
  ])
}
