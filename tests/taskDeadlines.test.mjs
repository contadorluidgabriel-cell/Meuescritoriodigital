import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTaskDeadlineView, taskMatchesDeadline } from '../src/lib/taskDeadlines.js'

const day = '2026-09-09'
const task = (id, prazo, extras = {}) => ({ id, titulo: id, prazo, status: 'Pendente', ...extras })

const tasks = [
  task('overdue', '2026-09-08', { clientId: 'c1', responsavel: 'Ana', departamento: 'Fiscal' }),
  task('today', '2026-09-09', { clientId: 'c1', responsavel: 'Ana', departamento: 'Fiscal' }),
  task('tomorrow', '2026-09-10', { clientId: 'c2', responsavel: 'Bruno', departamento: 'DP' }),
  task('week-edge', '2026-09-15'),
  task('after-week', '2026-09-16'),
  task('month-edge', '2026-10-08'),
  task('after-month', '2026-10-09'),
  task('waiting', '', { status: 'Aguardando cliente', clientId: 'c1' }),
  task('planned-today-due-later', '2026-09-30', { planejadoPara: '2026-09-09' }),
  task('done-overdue', '2026-09-01', { status: 'Concluída' }),
]

test('classifica os prazos pela data oficial da tarefa', () => {
  assert.equal(taskMatchesDeadline(tasks[0], 'overdue', day), true)
  assert.equal(taskMatchesDeadline(tasks[1], 'today', day), true)
  assert.equal(taskMatchesDeadline(tasks[2], 'tomorrow', day), true)
  assert.equal(taskMatchesDeadline(tasks[3], 'week', day), true)
  assert.equal(taskMatchesDeadline(tasks[4], 'week', day), false)
  assert.equal(taskMatchesDeadline(tasks[5], 'month', day), true)
  assert.equal(taskMatchesDeadline(tasks[6], 'month', day), false)
})

test('planejamento interno não altera o filtro do prazo oficial', () => {
  const planned = tasks.find(item => item.id === 'planned-today-due-later')
  assert.equal(taskMatchesDeadline(planned, 'today', day), false)
  assert.equal(taskMatchesDeadline(planned, 'month', day), true)
})

test('aguardando cliente funciona mesmo sem prazo e concluídas são excluídas', () => {
  const view = buildTaskDeadlineView(tasks, { day, scope: 'waiting' })
  assert.deepEqual(view.tasks.map(item => item.id), ['waiting'])
  assert.equal(view.counts.overdue, 1)
  assert.equal(view.counts.all, 9)
})

test('filtros de cliente responsável e departamento afetam lista e contadores', () => {
  const view = buildTaskDeadlineView(tasks, {
    day,
    scope: 'all',
    clientId: 'c1',
    responsible: 'Ana',
    department: 'Fiscal',
  })
  assert.deepEqual(view.tasks.map(item => item.id), ['overdue', 'today'])
  assert.equal(view.counts.overdue, 1)
  assert.equal(view.counts.today, 1)
  assert.equal(view.counts.tomorrow, 0)
})
