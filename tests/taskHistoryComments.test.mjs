import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { completeTask, reopenTask } from '../src/lib/taskExecution.js'
import { appendNextRecurringTaskWithMeta } from '../src/lib/taskRecurrence.js'

const taskSource = () => readFileSync(new URL('../src/components/TasksReactBase.jsx', import.meta.url), 'utf8')
const viteSource = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')

test('tarefas concluídas saem da listagem principal e ficam no histórico', () => {
  const source = taskSource()
  assert.match(source, /if \(isDone\(task\.status\)\) return false/)
  assert.match(source, /Histórico de tarefas/)
  assert.match(source, /Nenhuma tarefa em aberto encontrada/)
  assert.match(source, /Reabrir/)
})

test('tarefa expõe observação e comentários persistentes', () => {
  const source = taskSource()
  assert.match(source, /label="Observação"/)
  assert.match(source, /label="Comentários"/)
  assert.match(source, /comentarios:/)
  assert.match(source, /Adicionar comentário/)
  assert.match(source, /task\.observacao/)
})

test('patch de histórico é aplicado depois das demais correções de tarefas', () => {
  const uxIndex = viteSource.indexOf('applyTaskUxFixesPatch(root)')
  const historyIndex = viteSource.indexOf('applyTaskHistoryCommentsPatch(root)')
  const safetyIndex = viteSource.indexOf('applySyncSafetyPatch(root)')
  assert.ok(uxIndex >= 0)
  assert.ok(historyIndex > uxIndex)
  assert.ok(safetyIndex > historyIndex)
})

test('concluir e reabrir preserva observação e comentários', () => {
  const tasks = [{
    id: 't1',
    titulo: 'Apuração',
    status: 'Pendente',
    observacao: 'Protocolo 123',
    comentarios: [{ id: 'c1', texto: 'Cliente confirmou', criadoEm: '2026-09-15T12:00:00.000Z', autor: 'Luid' }],
    subtarefas: [],
  }]
  const completed = completeTask(tasks, 't1')
  assert.equal(completed.changed, true)
  assert.equal(completed.task.status, 'Concluída')
  assert.ok(completed.task.completedAt)
  assert.equal(completed.task.observacao, 'Protocolo 123')
  assert.equal(completed.task.comentarios.length, 1)

  const reopened = reopenTask(completed.tasks, 't1')
  assert.equal(reopened.changed, true)
  assert.equal(reopened.task.status, 'Pendente')
  assert.equal(reopened.task.completedAt, '')
  assert.equal(reopened.task.observacao, 'Protocolo 123')
  assert.equal(reopened.task.comentarios.length, 1)
})

test('nova ocorrência recorrente não herda observação e comentários da ocorrência concluída', () => {
  const completed = {
    id: 't1',
    titulo: 'Fechamento mensal',
    clientId: 'c1',
    status: 'Concluída',
    prazo: '2026-09-15',
    recorrencia: 'monthly',
    completedAt: '2026-09-15T18:00:00.000Z',
    observacao: 'Competência 08/2026 finalizada',
    comentarios: [{ id: 'c1', texto: 'Tudo certo', criadoEm: '2026-09-15T18:00:00.000Z' }],
    subtarefas: [],
  }
  const result = appendNextRecurringTaskWithMeta([completed], completed, [{ id: 'c1', status: 'Ativo' }])
  assert.ok(result.generatedTaskId)
  const next = result.tasks.find(item => item.id === result.generatedTaskId)
  assert.ok(next)
  assert.equal(next.status, 'Pendente')
  assert.equal(next.observacao, '')
  assert.deepEqual(next.comentarios, [])
  assert.equal(next.completedAt, '')
})
