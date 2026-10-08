import test from 'node:test'
import assert from 'node:assert/strict'
import { processCancellationError, processCancellationSummary, processIsClosed, reconcileProcessCancellationFinance } from '../src/lib/processCancellation.js'
import { buildProcessFinanceCharges } from '../src/lib/processFinance.js'
import { processViewOf } from '../src/lib/moduleViews.js'
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

test('interface de processo exibe campos de cancelamento e resumo financeiro', () => {
  const source = readFileSync('src/components/ProcessesReact.jsx', 'utf8')
  assert.match(source, /Cancelado por/)
  assert.match(source, /Motivo do cancelamento/)
  assert.match(source, /Valor devido no cancelamento/)
  assert.match(source, /Resumo financeiro do cancelamento/)
})


test('cancelamento zera saldo financeiro e cancela cobranca quando devido e zero', () => {
  const process = { id: 'p-zero', status: 'Cancelado', cancelamentoData: '2026-10-08', cancelamentoMotivo: 'Desistência', cancelamentoValorDevido: 0 }
  const finance = [{ id: 'f-zero', origemTipo: 'Processo', origemId: 'p-zero', valor: 800, status: 'Pendente', pagamentos: [] }]
  const result = reconcileProcessCancellationFinance(finance, process, '2026-10-08')
  assert.equal(result.changed, true)
  assert.equal(result.finance[0].status, 'Cancelado')
  assert.equal(result.finance[0].saldo, 0)
  assert.equal(result.finance[0].cancelamentoValorOriginal, 800)
})

test('cancelamento ajusta cobranca existente e preserva pagamentos', () => {
  const process = { id: 'p-parcial', status: 'Cancelado', cancelamentoData: '2026-10-08', cancelamentoMotivo: 'Desistência', cancelamentoValorDevido: 300 }
  const finance = [{
    id: 'f-parcial', origemTipo: 'Processo', origemId: 'p-parcial', valor: 800, status: 'Parcial',
    pagamentos: [{ id: 'pay-1', data: '2026-10-01', valorRecebido: 100 }],
  }]
  const result = reconcileProcessCancellationFinance(finance, process, '2026-10-08')
  assert.equal(result.changed, true)
  assert.equal(result.finance[0].valor, 300)
  assert.equal(result.finance[0].pagamentos.length, 1)
  assert.equal(result.finance[0].valorRecebido, 100)
  assert.equal(result.finance[0].saldo, 200)
  assert.equal(result.finance[0].status, 'Parcial')
})

test('reconciliacao de cancelamento e idempotente', () => {
  const process = { id: 'p-idem', status: 'Cancelado', cancelamentoData: '2026-10-08', cancelamentoMotivo: 'Desistência', cancelamentoValorDevido: 300 }
  const finance = [{ id: 'f-idem', origemTipo: 'Processo', origemId: 'p-idem', valor: 800, status: 'Pendente', pagamentos: [] }]
  const first = reconcileProcessCancellationFinance(finance, process, '2026-10-08')
  const second = reconcileProcessCancellationFinance(first.finance, process, '2026-10-08')
  assert.equal(first.changed, true)
  assert.equal(second.changed, false)
  assert.equal(second.finance[0].valor, 300)
})

test('parcelas vinculadas sao reduzidas para o total devido no cancelamento', () => {
  const process = { id: 'p-parcelado', status: 'Cancelado', cancelamentoData: '2026-10-08', cancelamentoMotivo: 'Desistência', cancelamentoValorDevido: 300 }
  const finance = [
    { id: 'f1', origemTipo: 'Processo', origemId: 'p-parcelado', valor: 400, status: 'Pendente', pagamentos: [] },
    { id: 'f2', origemTipo: 'Processo', origemId: 'p-parcelado', valor: 400, status: 'Pendente', pagamentos: [] },
  ]
  const result = reconcileProcessCancellationFinance(finance, process, '2026-10-08')
  assert.equal(result.finance.reduce((sum, charge) => sum + Number(charge.valor || 0), 0), 300)
  assert.deepEqual(result.finance.map(charge => charge.valor), [150, 150])
})

test('interface aplica reconciliacao financeira automatica aos processos cancelados', () => {
  const source = readFileSync('src/components/ProcessesReact.jsx', 'utf8')
  assert.match(source, /reconcileProcessCancellationFinance/)
  assert.match(source, /MED_PROCESS_CANCELLATION_FINANCE_RECONCILE_V1/)
})
