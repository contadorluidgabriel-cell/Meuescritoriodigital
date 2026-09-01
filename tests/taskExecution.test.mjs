import test from 'node:test'
import assert from 'node:assert/strict'
import { addTaskProgress, completeTask, taskExecutionState, toggleSubtask, undoTaskCompletion } from '../src/lib/taskExecution.js'

const task = overrides => ({
  id: 'task-1',
  titulo: 'Tarefa teste',
  status: 'Pendente',
  prazo: '2026-09-10',
  clientId: 'client-1',
  subtarefas: [],
  ...overrides,
})

test('bloqueia conclusão enquanto houver subtarefa pendente', () => {
  const current = task({ subtarefas: [{ titulo: 'Etapa A', concluida: true }, { titulo: 'Etapa B', concluida: false }] })
  const state = taskExecutionState(current)
  assert.equal(state.canComplete, false)
  assert.equal(state.subtaskDone, 1)
  assert.equal(state.subtaskTotal, 2)
  const result = completeTask([current], current.id)
  assert.equal(result.changed, false)
  assert.match(result.error, /subtarefa/i)
})

test('permite concluir depois de finalizar subtarefas', () => {
  const current = task({ subtarefas: [{ titulo: 'Etapa A', concluida: false }] })
  const toggled = toggleSubtask([current], current.id, 0)
  assert.equal(toggled.changed, true)
  assert.equal(toggled.tasks[0].subtarefas[0].concluida, true)
  const completed = completeTask(toggled.tasks, current.id)
  assert.equal(completed.changed, true)
  assert.equal(completed.tasks[0].status, 'Concluída')
  assert.ok(completed.transaction)
})

test('progresso quantitativo respeita a meta e libera conclusão', () => {
  const current = task({ quantitativo: true, quantidadeTotal: 12, quantidadeConcluida: 1, unidade: 'lançamentos' })
  const plusTen = addTaskProgress([current], current.id, 10)
  assert.equal(plusTen.tasks[0].quantidadeConcluida, 11)
  const capped = addTaskProgress(plusTen.tasks, current.id, 10)
  assert.equal(capped.tasks[0].quantidadeConcluida, 12)
  assert.equal(taskExecutionState(capped.tasks[0]).canComplete, true)
  assert.equal(completeTask(capped.tasks, current.id).changed, true)
})

test('conclusão recorrente gera próxima ocorrência resetada e desfazer remove somente a gerada', () => {
  const current = task({
    recorrencia: 'Mensal',
    quantitativo: true,
    quantidadeTotal: 450,
    quantidadeConcluida: 450,
    unidade: 'lançamentos',
    subtarefas: [{ titulo: 'Conferir', concluida: true }],
  })
  const completed = completeTask([current], current.id)
  assert.equal(completed.changed, true)
  assert.equal(completed.tasks.length, 2)
  const generated = completed.tasks.find(item => item.id !== current.id)
  assert.equal(generated.prazo, '2026-10-10')
  assert.equal(generated.status, 'Pendente')
  assert.equal(generated.quantidadeConcluida, 0)
  assert.equal(generated.subtarefas[0].concluida, false)

  const undone = undoTaskCompletion(completed.tasks, completed.transaction)
  assert.equal(undone.changed, true)
  assert.equal(undone.tasks.length, 1)
  assert.equal(undone.tasks[0].status, 'Pendente')
})

test('não permite alterar subtarefa de tarefa já concluída', () => {
  const current = task({ status: 'Concluída', subtarefas: [{ titulo: 'Etapa', concluida: true }] })
  const result = toggleSubtask([current], current.id, 0)
  assert.equal(result.changed, false)
  assert.match(result.error, /reabra/i)
})
