import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allPartnerBalances,
  clientPartnerIds,
  normalizeSharedCharge,
  normalizedSharedClientFields,
  settlementEntries,
  sharedClientError,
  sharedSplit,
} from '../src/lib/sharedWork.js'
import { workResponsibilityFields } from '../src/lib/sharedResponsibility.js'

const partners = [
  { id: 'p1', nome: 'Parceiro 1', status: 'Ativo' },
  { id: 'p2', nome: 'Parceiro 2', status: 'Ativo' },
]

const sharedClient = overrides => ({
  id: 'c1',
  perfilAtendimento: 'Compartilhado',
  relacionamento: 'Recorrente',
  mensalidade: 1000,
  parceiroIds: ['p1', 'p2'],
  compartilhadoRecebedor: 'Escritorio',
  compartilhadoMinhaParte: 600,
  compartilhadoPartesParceiros: [
    { parceiroId: 'p1', valor: 250 },
    { parceiroId: 'p2', valor: 150 },
  ],
  responsabilidadesCompartilhadas: {
    Fiscal: { responsavel: 'Parceiro', parceiroId: 'p1' },
    DP: { responsavel: 'Ambos', parceiroId: 'p2' },
  },
  ...overrides,
})

test('normalizes multiple partners and keeps legacy first partner', () => {
  const fields = normalizedSharedClientFields(sharedClient())
  assert.deepEqual(fields.parceiroIds, ['p1', 'p2'])
  assert.equal(fields.parceiroId, 'p1')
  assert.equal(fields.compartilhadoParceiroParte, 250)
  assert.equal(sharedClientError({ ...sharedClient(), ...fields }, { partners }), '')
})

test('defaults full monthly value to office when no split was configured', () => {
  const fields = normalizedSharedClientFields(sharedClient({ compartilhadoMinhaParte: 0, compartilhadoPartesParceiros: [] }))
  assert.equal(fields.compartilhadoMinhaParte, 1000)
  assert.equal(sharedSplit({ mensalidade: 1000, ...fields }).difference, 0)
})

test('manual service can use only a subset of client partners', () => {
  const charge = normalizeSharedCharge({
    id: 'f1', valor: 400, compartilhado: true, parceiroIds: ['p2'],
    compartilhadoRecebedor: 'partner:p2', compartilhadoMinhaParte: 300,
    compartilhadoPartesParceiros: [{ parceiroId: 'p2', valor: 100 }],
  }, sharedClient())
  assert.deepEqual(charge.parceiroIds, ['p2'])
  assert.deepEqual(charge.compartilhadoPartesParceiros, [{ parceiroId: 'p2', valor: 100 }])
})

test('partner balance is created only after client payment is received', () => {
  const base = {
    id: 'f1', clienteId: 'c1', valor: 1000, compartilhado: true, parceiroIds: ['p1', 'p2'],
    compartilhadoRecebedor: 'Escritorio', compartilhadoMinhaParte: 600,
    compartilhadoPartesParceiros: [{ parceiroId: 'p1', valor: 250 }, { parceiroId: 'p2', valor: 150 }],
    compartilhadoAcertoStatus: 'Pendente',
  }
  assert.deepEqual(settlementEntries({ ...base, status: 'Pendente' }, sharedClient()), [])
  assert.deepEqual(settlementEntries({ ...base, status: 'Recebido' }, sharedClient()), [
    { parceiroId: 'p1', tipo: 'aPagar', valor: 250, chargeId: 'f1' },
    { parceiroId: 'p2', tipo: 'aPagar', valor: 150, chargeId: 'f1' },
  ])
})

test('when partner receives, office share becomes receivable from that partner', () => {
  const entries = settlementEntries({
    id: 'f2', clienteId: 'c1', valor: 1000, status: 'Recebido', compartilhado: true,
    parceiroIds: ['p1'], compartilhadoRecebedor: 'partner:p1', compartilhadoMinhaParte: 650,
    compartilhadoPartesParceiros: [{ parceiroId: 'p1', valor: 350 }], compartilhadoAcertoStatus: 'Pendente',
  }, sharedClient())
  assert.deepEqual(entries, [{ parceiroId: 'p1', tipo: 'aReceber', valor: 650, chargeId: 'f2' }])
})

test('liquidated settlement disappears from pending balances', () => {
  const finance = [{
    id: 'f3', clienteId: 'c1', valor: 1000, status: 'Recebido', compartilhado: true,
    parceiroIds: ['p1'], compartilhadoRecebedor: 'Escritorio', compartilhadoMinhaParte: 700,
    compartilhadoPartesParceiros: [{ parceiroId: 'p1', valor: 300 }], compartilhadoAcertoStatus: 'Liquidado',
  }]
  const balances = allPartnerBalances(finance, [sharedClient()], partners)
  assert.equal(balances.find(item => item.id === 'p1').aPagar, 0)
})

test('responsibility defaults by department and can be overridden per work', () => {
  const client = sharedClient()
  assert.deepEqual(workResponsibilityFields({}, client, 'Fiscal'), { compartilhadoResponsavel: 'Parceiro', compartilhadoParceiroId: 'p1' })
  assert.deepEqual(workResponsibilityFields({ compartilhadoResponsavel: 'Escritorio', compartilhadoParceiroId: 'p1' }, client, 'Fiscal'), { compartilhadoResponsavel: 'Escritorio', compartilhadoParceiroId: '' })
  assert.deepEqual(workResponsibilityFields({}, client, 'DP'), { compartilhadoResponsavel: 'Ambos', compartilhadoParceiroId: 'p2' })
})

test('legacy parceiroId is still recognized', () => {
  assert.deepEqual(clientPartnerIds({ parceiroId: 'legacy' }), ['legacy'])
})
