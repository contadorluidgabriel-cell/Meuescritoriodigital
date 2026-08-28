import test from 'node:test'
import assert from 'node:assert/strict'
import { removeTaskOccurrence, taskDeletionMessage } from '../src/lib/taskDeletion.js'

test('removes a non-recurring task', () => {
  const task = { id: 'tar_1', titulo: 'Enviar guia', recorrencia: '' }
  const result = removeTaskOccurrence([task, { id: 'tar_2', titulo: 'Outra' }], task, [])
  assert.deepEqual(result.map(item => item.id), ['tar_2'])
})

test('removes only the current recurring occurrence and keeps the next one', () => {
  const task = { id: 'tar_1', titulo: 'Fechar folha', clientId: 'cli_1', prazo: '2026-08-28', recorrencia: 'monthly', status: 'Pendente', subtarefas: [] }
  const clients = [{ id: 'cli_1', status: 'Ativo' }]
  const result = removeTaskOccurrence([task], task, clients)
  assert.equal(result.length, 1)
  assert.notEqual(result[0].id, task.id)
  assert.equal(result[0].titulo, task.titulo)
  assert.equal(result[0].prazo, '2026-09-28')
  assert.equal(result[0].status, 'Pendente')
})

test('does not duplicate a recurring occurrence that already exists', () => {
  const task = { id: 'tar_1', titulo: 'Fechar folha', clientId: 'cli_1', prazo: '2026-08-28', recorrencia: 'monthly', status: 'Pendente', subtarefas: [] }
  const next = { ...task, id: 'tar_2', prazo: '2026-09-28' }
  const clients = [{ id: 'cli_1', status: 'Ativo' }]
  const result = removeTaskOccurrence([task, next], task, clients)
  assert.deepEqual(result.map(item => item.id), ['tar_2'])
})

test('confirmation explains recurring behavior', () => {
  const message = taskDeletionMessage({ titulo: 'Apuração mensal', recorrencia: 'monthly' })
  assert.match(message, /somente esta ocorrência/i)
  assert.match(message, /próxima/i)
})
