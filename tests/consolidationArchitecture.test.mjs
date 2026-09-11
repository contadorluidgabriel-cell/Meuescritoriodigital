import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Todoist automatic sync is owned by the office data layer only', () => {
  const officeData = read('src/hooks/useOfficeData.js')
  const tasksModule = read('src/components/TasksReact.jsx')

  assert.match(officeData, /useTodoistTasks\s*\(/)
  assert.doesNotMatch(tasksModule, /useTodoistTasks/)
})

test('tasks module remains a presentation/composition layer after consolidation', () => {
  const tasksModule = read('src/components/TasksReact.jsx')

  assert.match(tasksModule, /<TaskDeadlinesBoard/)
  assert.match(tasksModule, /<TasksReactBase/)
})
