import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProcessFinanceCharges, processFinanceError, processHasFinanceCharge } from '../src/lib/processFinance.js'

test('processo cobrado à parte gera cobrança vinculada ao processo', () => {
  const process = {
    id: 'proc-1', clientId: 'cli-1', tipo: 'Alteração Contratual', cobradoAParte: true,
    financeiroValor: 1500, financeiroParcelas: 1, financeiroVencimento: '2026-09-10', gerarCobranca: true,
  }
  const charges = buildProcessFinanceCharges(process, { id: 'cli-1', razao: 'Empresa X', perfilAtendimento: 'Direto' }, prefix => `${prefix}-teste`)
  assert.equal(charges.length, 1)
  assert.equal(charges[0].valor, 1500)
  assert.equal(charges[0].origemTipo, 'Processo')
  assert.equal(charges[0].origemId, 'proc-1')
  assert.equal(charges[0].descricao, 'Alteração Contratual')
})

test('processo parcelado divide os centavos e avança vencimentos', () => {
  let seq = 0
  const charges = buildProcessFinanceCharges({
    id: 'proc-2', clientId: 'cli-2', tipo: 'Abertura de empresa', cobradoAParte: true,
    financeiroValor: 1000, financeiroParcelas: 3, financeiroVencimento: '2026-08-31',
  }, { id: 'cli-2', razao: 'Empresa Y', perfilAtendimento: 'Direto' }, prefix => `${prefix}-${++seq}`)
  assert.equal(charges.length, 3)
  assert.equal(charges.reduce((sum, item) => sum + item.valor, 0), 1000)
  assert.deepEqual(charges.map(item => item.vencimento), ['2026-08-31', '2026-09-30', '2026-10-31'])
  assert.deepEqual(charges.map(item => item.parcelaNumero), [1, 2, 3])
})

test('processo compartilhado exige divisão igual ao valor total', () => {
  const client = { id: 'cli-3', perfilAtendimento: 'Compartilhado', parceiroIds: ['par-1'] }
  const process = {
    id: 'proc-3', clientId: 'cli-3', tipo: 'Regularização', cobradoAParte: true,
    financeiroValor: 1000, financeiroParcelas: 1, financeiroVencimento: '2026-09-15',
    financeiroRecebedor: 'Escritorio', financeiroMinhaParte: 600,
    financeiroPartesParceiros: [{ parceiroId: 'par-1', valor: 300 }],
  }
  assert.match(processFinanceError(process, client), /igual ao valor total/i)
  process.financeiroPartesParceiros[0].valor = 400
  assert.equal(processFinanceError(process, client), '')
  const charges = buildProcessFinanceCharges(process, client, prefix => `${prefix}-shared`)
  assert.equal(charges[0].compartilhado, true)
  assert.equal(charges[0].compartilhadoMinhaParte, 600)
  assert.equal(charges[0].compartilhadoPartesParceiros[0].valor, 400)
})

test('detecta cobrança financeira existente para impedir duplicidade', () => {
  const process = { id: 'proc-4' }
  const finance = [{ id: 'fin-1', origemTipo: 'Processo', origemId: 'proc-4', status: 'Pendente' }]
  assert.equal(processHasFinanceCharge(process, finance), true)
  finance[0].status = 'Cancelado'
  assert.equal(processHasFinanceCharge(process, finance), false)
})
