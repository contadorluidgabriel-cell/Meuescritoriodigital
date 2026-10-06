import test from 'node:test'
import assert from 'node:assert/strict'
import { quantitativeTaskError, taskCompletionBlocker, taskProgress } from '../src/lib/taskProgress.js'

test('calcula progresso quantitativo', () => {
  assert.deepEqual(taskProgress({ quantitativo: true, quantidadeTotal: 450, quantidadeConcluida: 287, unidade: 'lançamentos' }), {
    enabled: true, total: 450, current: 287, remaining: 163, pct: 64, unit: 'lançamentos',
  })
})

test('exige meta válida em tarefa quantitativa', () => {
  assert.match(quantitativeTaskError({ quantitativo: true, quantidadeTotal: 0 }), /meta total/i)
  assert.match(quantitativeTaskError({ quantitativo: true, quantidadeTotal: 10, quantidadeConcluida: 11 }), /não pode ser maior/i)
  assert.equal(quantitativeTaskError({ quantitativo: true, quantidadeTotal: 10, quantidadeConcluida: 10 }), '')
})

test('bloqueia conclusão por subtarefas e depois por quantidade', () => {
  const base = { quantitativo: true, quantidadeTotal: 450, quantidadeConcluida: 300, unidade: 'lançamentos', subtarefas: [{ id: '1', concluida: false }] }
  assert.match(taskCompletionBlocker(base), /subtarefa/i)
  assert.match(taskCompletionBlocker({ ...base, subtarefas: [{ id: '1', concluida: true }] }), /300\/450 lançamentos/i)
  assert.equal(taskCompletionBlocker({ ...base, quantidadeConcluida: 450, subtarefas: [{ id: '1', concluida: true }] }), '')
})
