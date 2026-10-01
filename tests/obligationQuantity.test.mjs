import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizedObligationLinkQuantity,
  obligationQuantitySummary,
  quantityValidationError,
} from '../src/lib/obligationQuantity.js'

test('quantitative obligation link keeps people count and closing state', () => {
  assert.deepEqual(
    normalizedObligationLinkQuantity({ clienteId: 'ter-1', quantidadePessoas: '125', fechado: true, status: 'Pendente' }, true),
    { clienteId: 'ter-1', quantidadePessoas: 125, fechado: true, status: 'Concluída' },
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
    fechadas: 1,
    pendentes: 1,
    percentualFechamento: 50,
  })
})

test('non quantitative links discard quantitative metadata', () => {
  assert.deepEqual(
    normalizedObligationLinkQuantity({ clienteId: 'cli-1', quantidadePessoas: 30, fechado: true, status: 'Concluída' }, false),
    { clienteId: 'cli-1', status: 'Concluída' },
  )
})
