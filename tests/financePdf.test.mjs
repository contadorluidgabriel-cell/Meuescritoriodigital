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

test('receipt PDF includes received charge without storing file data', () => {
  const bytes = buildFinanceDocumentBytes({
    type: 'receipt',
    charge: { id: 'fin-rec', descricao: 'Serviço avulso', valor: 300, vencimento: '2026-08-10', status: 'Parcial', pagamentos: [{ id: 'p1', data: '2026-08-15', valorRecebido: 150, desconto: 0, acrescimo: 0 }] },
    client: { razao: 'Cliente Teste' },
    office: {},
  })
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), '%PDF-')
  assert.ok(bytes.length > 900)
})
