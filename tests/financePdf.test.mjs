import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFinanceDocumentBytes, financeDocumentNumber } from '../src/lib/financePdf.js'

test('invoice PDF has valid header and deterministic document number', () => {
  const charge = { id: 'fin-abc', clienteId: 'cli-1', descricao: 'Honorários contábeis', valor: 500, vencimento: '2026-08-10', competencia: '2026-08', status: 'Pendente' }
  const bytes = buildFinanceDocumentBytes({ type: 'invoice', charge, client: { razao: 'Empresa Teste', documento: '00.000.000/0001-00' }, office: {} })
  const header = String.fromCharCode(...bytes.slice(0, 8))
  assert.equal(header, '%PDF-1.4')
  assert.ok(bytes.length > 900)
  assert.equal(financeDocumentNumber(charge, 'invoice'), financeDocumentNumber(charge, 'invoice'))
})

test('invoice PDF carries official Luid Gabriel identity', () => {
  const charge = { id: 'fin-brand', clienteId: 'cli-1', descricao: 'Assessoria contábil', valor: 1000, vencimento: '2026-09-10', competencia: '2026-08', status: 'Pendente', faturaEmitidaEm: '2026-08-31' }
  const bytes = buildFinanceDocumentBytes({ type: 'invoice', charge, client: { razao: 'Empresa Teste' }, office: {} })
  const pdf = Buffer.from(bytes).toString('latin1')
  assert.match(pdf, /\(LUID\)/)
  assert.match(pdf, /\(GABRIEL\)/)
  assert.match(pdf, /\(CONTADOR\)/)
  assert.match(pdf, /\(FATURA\)/)
  assert.match(pdf, /0\.141 0\.337 0\.910 rg/)
})

test('receipt PDF includes received charge without storing file data', () => {
  const bytes = buildFinanceDocumentBytes({
    type: 'receipt',
    charge: { id: 'fin-rec', descricao: 'Serviço avulso', valor: 300, vencimento: '2026-08-10', status: 'Parcial', pagamentos: [{ id: 'p1', data: '2026-08-15', valorRecebido: 150, desconto: 0, acrescimo: 0 }] },
    client: { razao: 'Cliente Teste' },
    office: {},
  })
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), '%PDF-')
  assert.ok(bytes.length > 900)
  const pdf = Buffer.from(bytes).toString('latin1')
  assert.match(pdf, /\(RECEBIDO DE\)/)
  assert.match(pdf, /15\/08\/2026/)
})

test('invoice follows the approved premium payment layout', () => {
  const bytes = buildFinanceDocumentBytes({
    type: 'invoice',
    charge: { id: 'fin-balance', descricao: 'Honorários mensais', valor: 1250, vencimento: '2026-09-10', competencia: '2026-09', faturaEmitidaEm: '2026-09-01', pagamentos: [{ id: 'p1', data: '2026-09-02', valorRecebido: 250 }] },
    client: { razao: 'Empresa Exemplo' }, office: {},
  })
  const pdf = Buffer.from(bytes).toString('latin1')
  assert.match(pdf, /\(TOTAL\)/)
  assert.match(pdf, /\(R\$ 1\.000,00\)/)
  assert.match(pdf, /\(Vencimento\)/)
  assert.match(pdf, /\(10\/09\/2026\)/)
  assert.match(pdf, /\(PAGAMENTO\)/)
  assert.match(pdf, /\(contadorluidgabriel@gmail\.com\)/)
  assert.match(pdf, /\(Luid Lira\)/)
  assert.match(pdf, /\(Cloudwalk IP \(Infinitepay\)\)/)
  assert.match(pdf, /\(CONTABILIDADE\)/)
  assert.match(pdf, /\(PARA UM FUTURO\)/)
  assert.match(pdf, /\(MAIS FORTE\)/)
})
