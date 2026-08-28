import { readFileSync, writeFileSync } from 'node:fs'

function collect(path, needles) {
  const source = readFileSync(path, 'utf8')
  const chunks = []
  for (const needle of needles) {
    const index = source.indexOf(needle)
    if (index < 0) {
      chunks.push(`[inspect] ${path} :: ${needle}: NOT FOUND`)
      continue
    }
    const start = Math.max(0, index - 1400)
    const end = Math.min(source.length, index + needle.length + 2200)
    chunks.push(`\n[inspect] ${path} :: ${needle}\n${source.slice(start, end)}\n[/inspect]\n`)
  }
  return chunks
}

export function inspectQuantitativeAndAvulsos(root) {
  const chunks = [
    ...collect(`${root}src/components/TasksReactBase.jsx`, [
      'const emptyTask =',
      'const activeClients =',
      'function toggleTask',
      'function completeSelected',
      'function saveTask',
      '<Field label="Cliente">',
      '<Field label="Subtarefas"',
      '<div className="task-title">',
    ]),
    ...collect(`${root}src/components/ProcessesReact.jsx`, [
      'const activeClients =',
      'clientChoices',
      '<Field label="Cliente',
      'clientId',
      'function ProcessForm',
    ]),
  ]
  const output = chunks.join('\n')
  console.log(output)
  writeFileSync(`${root}inspection.md`, `\`\`\`text\n${output.slice(0, 58000)}\n\`\`\`\n`)
}
