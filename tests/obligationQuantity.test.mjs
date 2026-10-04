import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizedObligationLinkQuantity,
  obligationQuantitySummary,
  quantityValidationError,
  updateObligationLinkQuantity,
} from '../src/lib/obligationQuantity.js'
import {
  appendProductionHistory,
  businessDaysInclusive,
  calendarDaysInclusive,
  linkProductivity,
  obligationProductivity,
} from '../src/lib/obligationProductivity.js'

test('quantitative obligation link keeps people count and closing state', () => {
  assert.deepEqual(
    normalizedObligationLinkQuantity({ clienteId: 'ter-1', quantidadePessoas: '125', fechado: true, status: 'Pendente' }, true),
    { clienteId: 'ter-1', quantidadePessoas: 125, quantidadeConcluida: 125, fechado: true, status: 'Concluída' },
  )
})

test('quantitative obligation requires people count for every selected company', () => {
  const links = [
    { clienteId: 'ter-1', quantidadePessoas: 100 },
    { clienteId: 'ter-2', quantidadePessoas: 0 },
  ]
  assert.equal(quantityValidationError(links, true), 'Informe a quantidade de pessoas de cada empresa selecionada.')
})

test('quantitative obligation summarizes people and closings', () => {
  const obligation = {
    quantitativo: true,
    clientes: [
      { clienteId: 'ter-1', quantidadePessoas: 120, fechado: true, status: 'Concluída' },
      { clienteId: 'ter-2', quantidadePessoas: 80, fechado: false, status: 'Pendente' },
    ],
  }
  assert.deepEqual(obligationQuantitySummary(obligation), {
    empresas: 2,
    totalPessoas: 200,
    pessoasConcluidas: 120,
    pessoasPendentes: 80,
    fechadas: 1,
    pendentes: 1,
    percentualFechamento: 60,
  })
})

test('non quantitative links discard quantitative metadata', () => {
  assert.deepEqual(
    normalizedObligationLinkQuantity({ clienteId: 'cli-1', quantidadePessoas: 30, fechado: true, status: 'Concluída' }, false),
    { clienteId: 'cli-1', status: 'Concluída' },
  )
})


test('updates cumulative people progress and keeps obligation in progress', () => {
  const obligations = [{
    id: 'obr-1',
    quantitativo: true,
    clientes: [{ clienteId: 'ter-1', quantidadePessoas: 503, quantidadeConcluida: 0, fechado: false, status: 'Pendente' }],
  }]
  const result = updateObligationLinkQuantity(obligations, 'obr-1', 'ter-1', 187, '2026-09-30')
  assert.equal(result.changed, true)
  assert.equal(result.link.quantidadeConcluida, 187)
  assert.equal(result.link.status, 'Em andamento')
  assert.equal(result.link.fechado, false)
  assert.equal(result.link.concluidoEm, '')
})

test('closes CNPJ automatically when completed people reaches total', () => {
  const obligations = [{
    id: 'obr-1',
    quantitativo: true,
    clientes: [{ clienteId: 'ter-1', quantidadePessoas: 503, quantidadeConcluida: 400, fechado: false, status: 'Em andamento' }],
  }]
  const result = updateObligationLinkQuantity(obligations, 'obr-1', 'ter-1', 503, '2026-09-30')
  assert.equal(result.changed, true)
  assert.equal(result.link.quantidadeConcluida, 503)
  assert.equal(result.link.status, 'Concluída')
  assert.equal(result.link.fechado, true)
  assert.equal(result.link.concluidoEm, '2026-09-30')
})


test('reducing completed people reopens a previously completed quantitative link', () => {
  const reopened = normalizedObligationLinkQuantity({
    clienteId: 'ter-1',
    quantidadePessoas: 503,
    quantidadeConcluida: 300,
    fechado: false,
    status: 'Em andamento',
  }, true)
  assert.equal(reopened.quantidadeConcluida, 300)
  assert.equal(reopened.fechado, false)
  assert.equal(reopened.status, 'Em andamento')
})


test('calendar days include today, deadline and weekends', () => {
  assert.equal(calendarDaysInclusive('2026-10-03', '2026-10-09'), 7)
  assert.equal(calendarDaysInclusive('2026-10-03', '2026-10-04'), 2)
  assert.equal(businessDaysInclusive('2026-10-03', '2026-10-04'), 2)
})

test('productivity divides current pending balance by remaining calendar days', () => {
  const metric = linkProductivity({
    quantidadePessoas: 503,
    quantidadeConcluida: 177,
    historicoProducao: [],
  }, '2026-10-09', '2026-10-03')
  assert.equal(metric.pending, 326)
  assert.equal(metric.daysRemaining, 7)
  assert.equal(metric.requiredPerDay, 47)
})

test('same-day quantity updates merge into one production history entry', () => {
  const first = appendProductionHistory({}, 0, 40, '2026-10-01')
  const second = appendProductionHistory({ historicoProducao: first }, 40, 75, '2026-10-01')
  assert.deepEqual(second, [{ data: '2026-10-01', quantidade: 75, totalApos: 75 }])
})

test('quantity update records the daily production delta', () => {
  const obligations = [{
    id: 'obr-history',
    quantitativo: true,
    vencimento: '2026-10-09',
    clientes: [{ clienteId: 'ter-1', quantidadePessoas: 503, quantidadeConcluida: 100, status: 'Em andamento', historicoProducao: [] }],
  }]
  const result = updateObligationLinkQuantity(obligations, 'obr-history', 'ter-1', 160, '2026-10-01')
  assert.deepEqual(result.link.historicoProducao, [{ data: '2026-10-01', quantidade: 60, totalApos: 160 }])
})

test('obligation productivity aggregates today target across different due dates', () => {
  const metric = obligationProductivity({
    quantitativo: true,
    clientes: [
      { clienteId: 'a', vencimento: '2026-10-02', quantidadePessoas: 100, quantidadeConcluida: 50 },
      { clienteId: 'b', vencimento: '2026-10-05', quantidadePessoas: 100, quantidadeConcluida: 0 },
    ],
  }, '2026-10-01')
  assert.equal(metric.total, 200)
  assert.equal(metric.pending, 150)
  assert.equal(metric.mixedDue, true)
  assert.ok(metric.requiredToday > 0)
})


test('required pace recalculates immediately when current progress changes', () => {
  const before = linkProductivity({
    quantidadePessoas: 503,
    quantidadeConcluida: 177,
    historicoProducao: [],
  }, '2026-10-09', '2026-10-03')
  const after = linkProductivity({
    quantidadePessoas: 503,
    quantidadeConcluida: 227,
    historicoProducao: [{ data: '2026-10-03', quantidade: 50, totalApos: 227 }],
  }, '2026-10-09', '2026-10-03')
  assert.equal(before.requiredPerDay, 47)
  assert.equal(after.requiredPerDay, 40)
})

test('weekends count normally in the daily target', () => {
  const metric = linkProductivity({
    quantidadePessoas: 503,
    quantidadeConcluida: 187,
    historicoProducao: [{ data: '2026-10-01', quantidade: 43, totalApos: 187 }],
  }, '2026-10-09', '2026-10-03')
  assert.equal(metric.todayAvailable, true)
  assert.equal(metric.daysRemaining, 7)
  assert.equal(metric.todayTarget, 46)
  assert.equal(metric.remainingToday, 46)
  assert.equal(metric.requiredPerDay, 46)
})

test('pace status compares observed business-day average against required target', () => {
  const ahead = linkProductivity({
    quantidadePessoas: 500,
    quantidadeConcluida: 200,
    historicoProducao: [
      { data: '2026-10-01', quantidade: 100, totalApos: 100 },
      { data: '2026-10-02', quantidade: 100, totalApos: 200 },
    ],
  }, '2026-10-09', '2026-10-02')
  assert.equal(ahead.averagePerDay, 100)
  assert.equal(ahead.paceStatus, 'adiantada')
  assert.ok(ahead.projectedFinish)
})


test('incremental daily entry can be added to cumulative progress and merged into today history', () => {
  const obligations = [{
    id: 'obr-add',
    quantitativo: true,
    clientes: [{
      clienteId: 'ter-1',
      quantidadePessoas: 503,
      quantidadeConcluida: 177,
      status: 'Em andamento',
      historicoProducao: [{ data: '2026-10-03', quantidade: 31, totalApos: 177 }],
    }],
  }]
  const current = 177
  const addedNow = 20
  const result = updateObligationLinkQuantity(obligations, 'obr-add', 'ter-1', current + addedNow, '2026-10-03')
  assert.equal(result.link.quantidadeConcluida, 197)
  assert.deepEqual(result.link.historicoProducao, [{ data: '2026-10-03', quantidade: 51, totalApos: 197 }])
})
