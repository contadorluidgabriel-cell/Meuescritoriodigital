import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('pagina de tarefas usa uma unica lista operacional', () => {
  const source = read('src/components/TasksReact.jsx')
  assert.match(source, /TasksReactBase/)
  assert.equal(source.includes('TaskDeadlinesBoard'), false)
})

test('Meu Dia permite criar tarefa sem abrir o modulo de tarefas', () => {
  const source = read('src/components/OperationalCommandCenter.jsx')
  assert.match(source, /QuickTaskCreate/)
  assert.match(source, /Nova tarefa/)
  assert.match(source, /setQuickTaskOpen\(true\)/)
  assert.match(source, /role !== 'partner'/)
})

test('tarefa criada no Meu Dia entra no expediente atual', () => {
  const source = read('src/components/QuickTaskCreate.jsx')
  assert.match(source, /planejadoPara: day/)
  assert.match(source, /status: 'Pendente'/)
  assert.match(source, /draft\.tasks = \[\.\.\.\(draft\.tasks \|\| \[\]\), task\]/)
})
