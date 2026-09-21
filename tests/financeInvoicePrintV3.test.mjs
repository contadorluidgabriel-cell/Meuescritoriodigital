import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFinanceDocumentBytes } from '../src/lib/financePdf.js'

const pdfText = props => Buffer.from(buildFinanceDocumentBytes(props)).toString('latin1')

const invoice = {
  id: 'print-v3-1', clienteId: 'cli-1', descricao: 'Honorários mensais', valor: 1250,
  vencimento: '2026-10-10', competencia: '2026-09', faturaEmitidaEm: '2026-10-01',
  pagamentos: [{ id: 'p1', data: '2026-10-03', valorRecebido: 250 }],
}

test('invoice V3 is a one-page A4 printable PDF with ink-saving white letterhead', () => {
  const pdf = pdfText({ type: 'invoice', charge: invoice, client: { razao: 'Empresa Teste' } })
  assert.match(pdf, /^%PDF-1\.4/)
  assert.match(pdf, /\/MediaBox \[0 0 595 842\]/)
  assert.match(pdf, /\/Count 1/)
  assert.match(pdf, /0 837 595 5 re f/)
  assert.doesNotMatch(pdf, /0 734 595 108 re f/)
  assert.match(pdf, /\(FATURA\)/)
  assert.match(pdf, /\(TOTAL A PAGAR\)/)
  assert.match(pdf, /\(R\$ 1\.000,00\)/)
  assert.match(pdf, /\(contadorluidgabriel@gmail\.com\)/)
  assert.ok(pdf.includes('Luid Lira  ·  Cloudwalk IP'))
})

test('long legal name fits the client column across two lines without replacing source data', () => {
  const name = 'EMPRESA DE CONSULTORIA E PARTICIPACOES EMPRESARIAIS DO NORTE E COMERCIO DE MATERIAIS LTDA'
  const pdf = pdfText({ type: 'invoice', charge: invoice, client: { razao: name, documento: '00.000.000/0001-00' } })
  assert.match(pdf, /\(EMPRESA DE CONSULTORIA E/)
  assert.match(pdf, /\(CNPJ 00\.000\.000\/0001-00\)/)
  assert.match(pdf, /\(R\$ 1\.000,00\)/)
})

test('invoice with discount, surcharge and payment keeps each money component', () => {
  const charge = {
    ...invoice,
    valor: 1500,
    pagamentos: [{ id: 'p2', data: '2026-10-03', valorRecebido: 200, desconto: 30, acrescimo: 20 }],
  }
  const pdf = pdfText({ type: 'invoice', charge, client: { razao: 'Cliente Teste' } })
  assert.match(pdf, /\(Subtotal\)/)
  assert.match(pdf, /\(Desconto\)/)
  assert.match(pdf, /\(Acréscimo\)/)
  assert.match(pdf, /\(Já recebido\)/)
  assert.match(pdf, /\(TOTAL A PAGAR\)/)
})

test('receipt continues using the same invoice generator and retains received amounts', () => {
  const pdf = pdfText({ type: 'receipt', charge: invoice, client: { razao: 'Cliente Teste' } })
  assert.match(pdf, /\(RECIBO\)/)
  assert.match(pdf, /\(TOTAL RECEBIDO\)/)
  assert.match(pdf, /\(RECEBIMENTOS\)/)
})
