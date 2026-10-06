import test from 'node:test'
import assert from 'node:assert/strict'
import { processCancellationError, processCancellationSummary, processIsClosed } from '../src/lib/processCancellation.js'
import { buildProcessFinanceCharges } from '../src/lib/processFinance.js'
import { processViewOf } from '../src/lib/moduleViews.js'
import { buildOperationalView } from '../src/lib/operationalIntelligence.js'
import { readFileSync } from 'node:fs'

test('processo cancelado e tratado como encerrado e fica no historico', () => {
  const process = { id: 'p1', status: 'Cancelado' }
  assert.equal(processIsClosed(process), true)
  assert.equal(processViewOf(process), 'completed')
})

test('cancelamento exige autor, motivo e data', () => {
  assert.match(processCancellationError({ status: 'Cancelado' }), /quem solicitou/i)
  assert.match(processCancellationError({ status: 'Cancelado', cancelamentoPor: 'Cliente' }), /motivo/i)
  assert.match(processCancellationError({ status: 'Cancelado', cancelamentoPor: 'Cliente', cancelamentoMotivo: 'Desistiu' }), /data/i)
  assert.equal(processCancellationError({ status: 'Cancelado', cancelamentoPor: 'Cliente', cancelamentoMotivo: 'Desistiu', cancelamentoData: '2026-10-06', financeiroValor: 800, cancelamentoValorDevido: 300 }), '')
})

test('resumo financeiro separa contratado, pago, devido e saldo', () => {
  const process = { id: 'p1', status: 'Cancelado', financeiroValor: 800, cancelamentoValorDevido: 300 }
  const finance = [{
    id: 'f1', origemTipo: 'Processo', origemId: 'p1', valor: 800, status: 'Parcial',
    pagamentos: [{ id: 'pay1', data: '2026-10-01', valorRecebido: 100 }],
  }]
  assert.deepEqual(processCancellationSummary(process, finance), {
    contracted: 800,
    due: 300,
    paid: 100,
    balance: 200,
    overpaid: 0,
    charges: finance,
  })
})

test('nova cobranca de processo cancelado usa somente o valor devido no cancelamento', () => {
  const process = {
    id: 'p1', clientId: 'c1', tipo: 'Alteração', status: 'Cancelado',
    cobradoAParte: true, financeiroValor: 800, cancelamentoValorDevido: 300,
    financeiroParcelas: 1, financeiroVencimento: '2026-10-10',
  }
  const charges = buildProcessFinanceCharges(process, { id: 'c1', perfilAtendimento: 'Direto' }, () => 'f1')
  assert.equal(charges.length, 1)
  assert.equal(charges[0].valor, 300)
})

test('processo cancelado com zero devido nao gera nova cobranca', () => {
  const process = {
    id: 'p1', clientId: 'c1', tipo: 'Alteração', status: 'Cancelado',
    cobradoAParte: true, financeiroValor: 800, cancelamentoValorDevido: 0,
    financeiroParcelas: 1, financeiroVencimento: '2026-10-10',
  }
  assert.deepEqual(buildProcessFinanceCharges(process, { id: 'c1', perfilAtendimento: 'Direto' }, () => 'f1'), [])
})

test('processo cancelado nao aparece no Meu Dia', () => {
  const office = { clients: [{ id: 'c1', razao: 'Cliente' }], tasks: [], obligations: [], finance: [], processes: [{ id: 'p1', clientId: 'c1', tipo: 'Alteração', status: 'Cancelado', prazoFinal: '2026-10-06' }] }
  const view = buildOperationalView(office, { day: '2026-10-06' })
  assert.equal(view.items.some(item => item.type === 'process' && item.id === 'p1'), false)
})

test('interface de processo exibe campos de cancelamento e resumo financeiro', () => {
  const source = readFileSync('src/components/ProcessesReact.jsx', 'utf8')
  assert.match(source, /Cancelado por/)
  assert.match(source, /Motivo do cancelamento/)
  assert.match(source, /Valor devido no cancelamento/)
  assert.match(source, /Resumo financeiro do cancelamento/)
})
