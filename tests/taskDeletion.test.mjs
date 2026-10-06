import test from 'node:test'
import assert from 'node:assert/strict'
import { removeTaskOccurrence, taskDeletionMessage } from '../src/lib/taskDeletion.js'

test('remove uma tarefa nao recorrente', () => {
  const task = { id: 'tar_1', titulo: 'Enviar guia', recorrencia: '' }
  const result = removeTaskOccurrence([task, { id: 'tar_2', titulo: 'Outra' }], task)
  assert.deepEqual(result.map(item => item.id), ['tar_2'])
})

test('remove somente a ocorrencia recorrente sem criar a proxima', () => {
  const task = { id: 'tar_1', titulo: 'Fechar folha', prazo: '2026-08-28', recorrencia: 'monthly', status: 'Pendente' }
  const result = removeTaskOccurrence([task], task)
  assert.deepEqual(result, [])
})

test('preserva uma proxima ocorrencia que ja existe', () => {
  const task = { id: 'tar_1', titulo: 'Fechar folha', prazo: '2026-08-28', recorrencia: 'monthly', status: 'Pendente' }
  const next = { ...task, id: 'tar_2', prazo: '2026-09-28', serieRecorrenciaId: 'tar_1' }
  const result = removeTaskOccurrence([task, next], task)
  assert.deepEqual(result.map(item => item.id), ['tar_2'])
})

test('confirmacao explica que o calendario controla as proximas ocorrencias', () => {
  const message = taskDeletionMessage({ titulo: 'Apuração mensal', recorrencia: 'monthly' })
  assert.match(message, /somente esta ocorrência/i)
  assert.match(message, /calendário/i)
})
