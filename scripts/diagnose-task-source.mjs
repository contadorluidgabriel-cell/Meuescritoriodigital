import { readFileSync } from 'node:fs'

export function diagnoseTaskSource(root) {
  const source = readFileSync(`${root}src/components/TasksReactBase.jsx`, 'utf8')
  const index = source.indexOf('task-row-actions')
  const start = Math.max(0, index - 3500)
  const end = Math.min(source.length, index + 1200)
  throw new Error(`TASK_SOURCE_DIAGNOSTIC\n${source.slice(start, end)}`)
}
