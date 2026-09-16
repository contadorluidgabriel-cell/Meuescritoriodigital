import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { appendNextRecurringTaskWithMeta, nextTaskCompetencia } from '../src/lib/taskRecurrence.js'

const taskSource = () => readFileSync(new URL('../src/components/TasksReactBase.jsx', import.meta.url), 'utf8')

test('competência avança pela diferença mensal entre os prazos', () => {
  assert.equal(nextTaskCompetencia('2026-08', '2026-09-15', '2026-10-15'), '2026-09')
  assert.equal(nextTaskCompetencia('2026-11', '2026-12-15', '2027-01-15'), '2026-12')
  assert.equal(nextTaskCompetencia('2026-08', '2026-09-15', '2026-11-15'), '2026-10')
})

test('recorrência com competência cria ocorrência independente da próxima competência', () => {
  const task = {
    id: 't1', titulo: 'Fechamento fiscal', clientId: 'c1', status: 'Concluída',
    prazo: '2026-09-15', recorrencia: 'mensal', usaCompetencia: true, competencia: '2026-08',
    observacao: 'Competência finalizada', comentarios: [{ id: 'c1', texto: 'OK' }], subtarefas: [],
  }
  const result = appendNextRecurringTaskWithMeta([task], task, [{ id: 'c1', status: 'Ativo' }])
  const next = result.tasks.find(item => item.id === result.generatedTaskId)
  assert.ok(next)
  assert.equal(next.prazo, '2026-10-15')
  assert.equal(next.usaCompetencia, true)
  assert.equal(next.competencia, '2026-09')
  assert.equal(next.observacao, '')
  assert.deepEqual(next.comentarios, [])
})

test('tarefa sem controle por competência continua sem competência', () => {
  const task = {
    id: 't2', titulo: 'Ligar para cliente', clientId: 'c1', status: 'Concluída',
    prazo: '2026-09-20', recorrencia: 'mensal', usaCompetencia: false, competencia: '', subtarefas: [],
  }
  const result = appendNextRecurringTaskWithMeta([task], task, [{ id: 'c1', status: 'Ativo' }])
  const next = result.tasks.find(item => item.id === result.generatedTaskId)
  assert.ok(next)
  assert.equal(next.usaCompetencia, false)
  assert.equal(next.competencia, '')
})

test('interface oferece competência opcional na tarefa, filtro principal e histórico', () => {
  const source = taskSource()
  assert.match(source, /Controle por competência/)
  assert.match(source, /Esta tarefa possui competência contábil/)
  assert.match(source, /Filtrar por competência/)
  assert.match(source, /Competência do histórico/)
  assert.match(source, /usaCompetencia: Boolean\(editing\.usaCompetencia\)/)
  assert.match(source, /Competência ·/)
})
