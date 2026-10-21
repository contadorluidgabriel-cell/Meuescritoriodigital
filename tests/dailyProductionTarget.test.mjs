import test from 'node:test'
import assert from 'node:assert/strict'
import { linkProductivity, obligationProductivity } from '../src/lib/obligationProductivity.js'

test('uses required deadline pace as the default daily goal', () => {
  const metric = linkProductivity({ quantidadePessoas: 300, quantidadeConcluida: 0 }, '2026-10-30', '2026-10-21')
  assert.equal(metric.requiredPerDay, 30)
  assert.equal(metric.dailyGoal, 30)
  assert.equal(metric.goalIsCustom, false)
  assert.equal(metric.goalBelowRequired, false)
})

test('preserves a custom daily goal independently from the required deadline pace', () => {
  const metric = linkProductivity({
    quantidadePessoas: 300,
    quantidadeConcluida: 50,
    metaDiariaPersonalizada: 12,
    historicoProducao: [{ data: '2026-10-21', quantidade: 5, totalApos: 50 }],
  }, '2026-10-30', '2026-10-21')
  assert.equal(metric.requiredPerDay, 28)
  assert.equal(metric.dailyGoal, 12)
  assert.equal(metric.goalIsCustom, true)
  assert.equal(metric.goalBelowRequired, true)
  assert.equal(metric.doneToday, 5)
  assert.equal(metric.remainingToday, 7)
})

test('aggregate productivity shows custom goal and deadline pace separately', () => {
  const metric = obligationProductivity({
    quantitativo: true,
    clientes: [
      { quantidadePessoas: 300, quantidadeConcluida: 50, metaDiariaPersonalizada: 12, vencimento: '2026-10-30' },
      { quantidadePessoas: 100, quantidadeConcluida: 0, metaDiariaPersonalizada: 8, vencimento: '2026-10-30' },
    ],
  }, '2026-10-21')
  assert.equal(metric.dailyGoalToday, 20)
  assert.equal(metric.requiredToday, 37)
  assert.equal(metric.goalBelowRequired, true)
})

test('empty quantitative link returns safe zero targets', () => {
  const metric = linkProductivity({}, '2026-10-30', '2026-10-21')
  assert.equal(metric.dailyGoal, 0)
  assert.equal(metric.goalBelowRequired, false)
})
