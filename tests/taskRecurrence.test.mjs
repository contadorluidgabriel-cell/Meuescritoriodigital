import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileRecurringTaskCalendar } from '../src/lib/taskRecurrence.js'

const monthlyTask = overrides => ({
  id: 't-sep',
  titulo: 'Fechamento Fiscal',
  clientId: 'c1',
  status: 'Pendente',
  prazo: '2026-09-15',
  recorrencia: 'Mensal',
  subtarefas: [],
  ...overrides,
})

test('recorrencia mensal gera a ocorrencia do mes atual mesmo com a anterior pendente', () => {
  const result = reconcileRecurringTaskCalendar(
    [monthlyTask()],
    [{ id: 'c1', status: 'Ativo' }],
    '2026-10-06',
  )
  assert.equal(result.changed, true)
  assert.equal(result.generatedCount, 1)
  assert.equal(result.tasks.length, 2)
  const october = result.tasks.find(task => task.prazo === '2026-10-15')
  assert.ok(october)
  assert.equal(october.status, 'Pendente')
  assert.equal(october.serieRecorrenciaId, 't-sep')
})

test('recorrencia mensal recupera meses perdidos ate o mes atual, mas nao cria o futuro', () => {
  const result = reconcileRecurringTaskCalendar(
    [monthlyTask({ prazo: '2026-08-15', id: 't-ago' })],
    [{ id: 'c1', status: 'Ativo' }],
    '2026-10-06',
  )
  assert.deepEqual(
    result.tasks.map(task => task.prazo).sort(),
    ['2026-08-15', '2026-09-15', '2026-10-15'],
  )
  assert.equal(result.tasks.some(task => task.prazo === '2026-11-15'), false)
})

test('ocorrencia existente concluida tambem impede duplicacao', () => {
  const september = monthlyTask()
  const october = monthlyTask({
    id: 't-out',
    prazo: '2026-10-15',
    status: 'Concluída',
    serieRecorrenciaId: 't-sep',
  })
  const result = reconcileRecurringTaskCalendar(
    [september, october],
    [{ id: 'c1', status: 'Ativo' }],
    '2026-10-06',
  )
  assert.equal(result.generatedCount, 0)
  assert.equal(result.tasks.length, 2)
})

test('recorrencia diaria gera somente ocorrencias que ja chegaram ate hoje', () => {
  const result = reconcileRecurringTaskCalendar(
    [monthlyTask({ id: 'daily-1', prazo: '2026-10-04', recorrencia: 'Diária' })],
    [{ id: 'c1', status: 'Ativo' }],
    '2026-10-06',
  )
  assert.deepEqual(
    result.tasks.map(task => task.prazo).sort(),
    ['2026-10-04', '2026-10-05', '2026-10-06'],
  )
  assert.equal(result.tasks.some(task => task.prazo === '2026-10-07'), false)
})

test('cliente inativo nao recebe novas ocorrencias', () => {
  const result = reconcileRecurringTaskCalendar(
    [monthlyTask()],
    [{ id: 'c1', status: 'Inativo' }],
    '2026-10-06',
  )
  assert.equal(result.changed, false)
  assert.equal(result.tasks.length, 1)
})

test('competencia mensal avanca junto com a ocorrencia gerada', () => {
  const result = reconcileRecurringTaskCalendar(
    [monthlyTask({ usaCompetencia: true, competencia: '2026-09', competenciaAvancoAutomatico: true })],
    [{ id: 'c1', status: 'Ativo' }],
    '2026-10-06',
  )
  const october = result.tasks.find(task => task.prazo === '2026-10-15')
  assert.equal(october.competencia, '2026-10')
})
