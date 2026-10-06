import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('tarefas nao exibem nem executam sincronizacao externa', () => {
  const tasks = read('src/components/TasksReactBase.jsx')
  const office = read('src/hooks/useOfficeData.js')
  assert.equal(/useGoogleTasks|google\.|Google Tasks|reconcileGoogleTaskPayload/.test(tasks), false)
  assert.equal(/useTodoistTasks|todoistOwner|Todoist/.test(office), false)
})

test('alteracoes de tarefas ficam apenas no MED', () => {
  const tasks = read('src/components/TasksReactBase.jsx')
  assert.equal(tasks.includes('google.schedule'), false)
  assert.match(tasks, /draft\.tasks/)
})
