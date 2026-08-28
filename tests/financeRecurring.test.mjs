import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMissingRecurringCharges } from '../src/lib/financeRecurring.js'

const client = (overrides = {}) => ({
  id: 'cli-1',
  razao: 'Empresa Teste',
  status: 'Ativo',
  relacionamento: 'Recorrente',
  mensalidade: 500,
  vencimento: 10,
  ...overrides,
})

test('creates one monthly charge for an active recurring client', () => {
  const charges = buildMissingRecurringCharges({
    clients: [client()],
    finance: [],
    competence: '2026-08',
    makeId: () => 'fin-1',
  })

  assert.equal(charges.length, 1)
  assert.deepEqual(charges[0], {
    id: 'fin-1',
    clienteId: 'cli-1',
    cliente: 'Empresa Teste',
    descricao: 'Honorários contábeis',
    competencia: '2026-08',
    vencimento: '2026-08-10',
    valor: 500,
    status: 'Pendente',
    recebidoEm: '',
    origem: 'recorrente',
  })
})

test('does not duplicate a recurring charge in the same competence', () => {
  const charges = buildMissingRecurringCharges({
    clients: [client()],
    finance: [{ id: 'old', clienteId: 'cli-1', competencia: '2026-08', origem: 'recorrente' }],
    competence: '2026-08',
    makeId: () => 'fin-2',
  })
  assert.deepEqual(charges, [])
})

test('ignores inactive, avulso and zero-value clients', () => {
  const charges = buildMissingRecurringCharges({
    clients: [
      client({ id: 'inactive', status: 'Inativo' }),
      client({ id: 'single', relacionamento: 'Avulso' }),
      client({ id: 'zero', mensalidade: 0 }),
    ],
    finance: [],
    competence: '2026-08',
    makeId: () => 'unused',
  })
  assert.deepEqual(charges, [])
})

test('caps due day to the last day of shorter months', () => {
  const [charge] = buildMissingRecurringCharges({
    clients: [client({ vencimento: 31 })],
    finance: [],
    competence: '2026-02',
    makeId: () => 'fin-feb',
  })
  assert.equal(charge.vencimento, '2026-02-28')
})

test('can generate only for a selected client', () => {
  const charges = buildMissingRecurringCharges({
    clients: [client({ id: 'a' }), client({ id: 'b', razao: 'Empresa B' })],
    finance: [],
    competence: '2026-08',
    clientId: 'b',
    makeId: () => 'fin-selected',
  })
  assert.equal(charges.length, 1)
  assert.equal(charges[0].clienteId, 'b')
})
