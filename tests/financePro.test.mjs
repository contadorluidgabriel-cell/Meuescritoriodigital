import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addPaymentToCharge,
  buildInstallmentCharges,
  delinquencyByClient,
  effectiveChargeStatus,
  financeMetrics,
  paymentSummary,
  removePaymentFromCharge,
  splitMoney,
} from '../src/lib/financePro.js'

const charge = (overrides = {}) => ({ id: 'fin-1', clienteId: 'cli-1', descricao: 'Honorários', valor: 1000, vencimento: '2026-08-10', competencia: '2026-08', status: 'Pendente', ...overrides })

test('legacy received charge remains fully settled without payment migration', () => {
  const summary = paymentSummary(charge({ status: 'Recebido', recebidoEm: '2026-08-05' }))
  assert.equal(summary.receivedCash, 1000)
  assert.equal(summary.balance, 0)
  assert.equal(effectiveChargeStatus(charge({ status: 'Recebido' }), '2026-08-31'), 'Recebido')
})

test('partial payment with discount and surcharge reduces principal correctly', () => {
  const next = addPaymentToCharge(charge(), { data: '2026-08-20', valorRecebido: 610, desconto: 20, acrescimo: 10 }, () => 'pay-1')
  const summary = paymentSummary(next)
  assert.equal(summary.receivedCash, 610)
  assert.equal(summary.applied, 620)
  assert.equal(summary.balance, 380)
  assert.equal(next.status, 'Parcial')
})

test('second payment can settle remaining balance', () => {
  const first = addPaymentToCharge(charge(), { data: '2026-08-20', valorRecebido: 600, desconto: 0, acrescimo: 0 }, () => 'pay-1')
  const second = addPaymentToCharge(first, { data: '2026-08-25', valorRecebido: 390, desconto: 10, acrescimo: 0 }, () => 'pay-2')
  assert.equal(paymentSummary(second).balance, 0)
  assert.equal(second.status, 'Recebido')
  assert.equal(second.recebidoEm, '2026-08-25')
})

test('payment can be reversed and status recalculated', () => {
  const paid = addPaymentToCharge(charge(), { data: '2026-08-20', valorRecebido: 1000 }, () => 'pay-1')
  const reversed = removePaymentFromCharge(paid, 'pay-1', '2026-08-31')
  assert.equal(paymentSummary(reversed).balance, 1000)
  assert.equal(reversed.status, 'Atrasado')
})

test('splitMoney preserves exact cents', () => {
  assert.deepEqual(splitMoney(100, 3), [33.34, 33.33, 33.33])
  assert.equal(splitMoney(100.01, 7).reduce((sum, value) => Math.round((sum + value) * 100) / 100, 0), 100.01)
})

test('installments preserve total, monthly due dates and shared split totals', () => {
  let sequence = 0
  const rows = buildInstallmentCharges({
    ...charge({ valor: 1000, vencimento: '2026-01-31', competencia: '2026-01' }),
    compartilhado: true,
    parceiroIds: ['par-1'],
    parceiroId: 'par-1',
    compartilhadoMinhaParte: 600,
    compartilhadoPartesParceiros: [{ parceiroId: 'par-1', valor: 400 }],
    compartilhadoParceiroParte: 400,
  }, 3, prefix => `${prefix}-${++sequence}`)
  assert.equal(rows.length, 3)
  assert.deepEqual(rows.map(item => item.vencimento), ['2026-01-31', '2026-02-28', '2026-03-31'])
  assert.equal(Math.round(rows.reduce((sum, item) => sum + item.valor, 0) * 100) / 100, 1000)
  assert.equal(Math.round(rows.reduce((sum, item) => sum + item.compartilhadoMinhaParte, 0) * 100) / 100, 600)
  assert.equal(Math.round(rows.reduce((sum, item) => sum + item.compartilhadoPartesParceiros[0].valor, 0) * 100) / 100, 400)
})

test('metrics use outstanding balance rather than raw status', () => {
  const partial = addPaymentToCharge(charge(), { data: '2026-08-20', valorRecebido: 400 }, () => 'pay-1')
  const metrics = financeMetrics([partial], { competence: '2026-08', day: '2026-08-31' })
  assert.equal(metrics.billed, 1000)
  assert.equal(metrics.received, 400)
  assert.equal(metrics.open, 600)
  assert.equal(metrics.overdue, 600)
})

test('delinquency groups overdue open balances by client', () => {
  const rows = delinquencyByClient([
    charge({ id: 'a', valor: 300 }),
    charge({ id: 'b', valor: 200, vencimento: '2026-08-15' }),
    charge({ id: 'c', clienteId: 'cli-2', valor: 900, vencimento: '2026-09-10' }),
  ], [{ id: 'cli-1', razao: 'Cliente Um' }, { id: 'cli-2', razao: 'Cliente Dois' }], '2026-08-31')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].clienteId, 'cli-1')
  assert.equal(rows[0].total, 500)
  assert.equal(rows[0].cobrancas, 2)
})
