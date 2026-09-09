import test from 'node:test'
import assert from 'node:assert/strict'
import { completeTask, reopenTask, toggleSubtask } from '../src/lib/taskExecution.js'
import { nextTaskDue } from '../src/lib/taskRecurrence.js'

test('recorrência mensal preserva o dia possível no mês seguinte', () => {
  assert.equal(nextTaskDue('2026-01-31', 'monthly'), '2026-02-28')
  assert.equal(nextTaskDue('2026-08-31', 'monthly'), '2026-09-30')
})

test('conclusão central bloqueia subtarefa pendente', () => {
  const tasks = [{ id: 't1', titulo: 'Fiscal', status: 'Pendente', subtarefas: [{ id: 's1', titulo: 'Apurar', concluida: false }] }]
  const result = completeTask(tasks, 't1')
  assert.equal(result.changed, false)
  assert.match(result.error, /subtarefa/i)
})

test('conclusão central cria somente uma próxima recorrência', () => {
  const task = { id: 't1', titulo: 'Fiscal', clientId: 'c1', status: 'Pendente', prazo: '2026-09-10', recorrencia: 'monthly', subtarefas: [{ id: 's1', titulo: 'Apurar', concluida: true }] }
  const clients = [{ id: 'c1', status: 'Ativo' }]
  const first = completeTask([task], 't1', { clients })
  assert.equal(first.changed, true)
  assert.equal(first.tasks.length, 2)
  assert.equal(first.tasks.find(item => item.id !== 't1').prazo, '2026-10-10')
  const generated = first.tasks.find(item => item.id !== 't1')
  assert.equal(generated.subtarefas[0].concluida, false)
  const duplicateAttempt = completeTask([{ ...task, status: 'Pendente' }, generated], 't1', { clients })
  assert.equal(duplicateAttempt.tasks.filter(item => item.prazo === '2026-10-10').length, 1)
})

test('cliente inativo não recebe nova ocorrência', () => {
  const task = { id: 't1', titulo: 'Fiscal', clientId: 'c1', status: 'Pendente', prazo: '2026-09-10', recorrencia: 'monthly', subtarefas: [] }
  const result = completeTask([task], 't1', { clients: [{ id: 'c1', status: 'Inativo' }] })
  assert.equal(result.changed, true)
  assert.equal(result.tasks.length, 1)
})

test('subtarefas de tarefa concluída só mudam após reabrir', () => {
  const tasks = [{ id: 't1', status: 'Concluída', completedAt: '2026-09-09T12:00:00Z', subtarefas: [{ id: 's1', concluida: true }] }]
  const blocked = toggleSubtask(tasks, 't1', 0)
  assert.equal(blocked.changed, false)
  assert.match(blocked.error, /Reabra/i)
  const reopened = reopenTask(tasks, 't1')
  assert.equal(reopened.changed, true)
  const changed = toggleSubtask(reopened.tasks, 't1', 0)
  assert.equal(changed.changed, true)
  assert.equal(changed.task.subtarefas[0].concluida, false)
})
