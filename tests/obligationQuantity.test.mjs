import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizedObligationLinkQuantity,
  obligationQuantitySummary,
  quantityValidationError,
  updateObligationLinkQuantity,
} from '../src/lib/obligationQuantity.js'

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
