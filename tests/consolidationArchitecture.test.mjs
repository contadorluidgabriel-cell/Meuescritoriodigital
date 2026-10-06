import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('external task sync is removed from the MED operational flow', () => {
  const officeData = read('src/hooks/useOfficeData.js')
  const tasksModule = read('src/components/TasksReactBase.jsx')

  assert.doesNotMatch(officeData, /useTodoistTasks|todoistOwner|Todoist/)
  assert.doesNotMatch(tasksModule, /useGoogleTasks|google\.|Google Tasks|reconcileGoogleTaskPayload/)
})

test('tasks module remains a single presentation layer after consolidation', () => {
  const tasksModule = read('src/components/TasksReact.jsx')

  assert.match(tasksModule, /<TasksReactBase/)
  assert.doesNotMatch(tasksModule, /TaskDeadlinesBoard/)
})
