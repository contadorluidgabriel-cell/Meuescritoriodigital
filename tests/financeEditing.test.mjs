import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentSummary } from '../src/lib/financePro.js'
import { buildMissingRecurringCharges } from '../src/lib/financeRecurring.js'
import {
  applyAdjustmentToGeneratedCharge,
  applyFeeAdjustment,
  editChargeCollection,
  editChargeRecord,
  monthlyFeeForCompetence,
} from '../src/lib/financeEditing.js'

test('corrige valor de cobrança sem baixa e recalcula saldo', () => {
  const charge = { id: 'c1', valor: 1500, descricao: 'Serviço', vencimento: '2026-08-10', competencia: '2026-08', status: 'Pendente', pagamentos: [] }
  const next = editChargeRecord(charge, { valor: 1050 }, '2026-08-31')
  assert.equal(next.valor, 1050)
  assert.equal(paymentSummary(next).balance, 1050)
  assert.equal(next.status, 'Atrasado')
  assert.equal(next.historicoEdicoesFinanceiras.length, 1)
})

test('não permite reduzir cobrança abaixo do principal já liquidado', () => {
  const charge = { id: 'c2', valor: 1000, status: 'Parcial', pagamentos: [{ id: 'p1', data: '2026-08-10', valorRecebido: 600, desconto: 0, acrescimo: 0 }] }
  assert.throws(() => editChargeRecord(charge, { valor: 500 }, '2026-08-31'), /já liquidado/)
})

test('edição de cobrança legada recebida materializa a baixa antes de aumentar valor', () => {
  const charge = { id: 'legacy', valor: 1000, status: 'Recebido', recebidoEm: '2026-08-10', pagamentos: [] }
  const next = editChargeRecord(charge, { valor: 1200 }, '2026-08-31')
  assert.equal(next.pagamentos.length, 1)
  assert.equal(paymentSummary(next).receivedCash, 1000)
  assert.equal(paymentSummary(next).balance, 200)
  assert.equal(next.status, 'Parcial')
})

test('edição pode atingir somente parcela atual ou atual e futuras', () => {
  const finance = [1, 2, 3].map(n => ({ id: `p${n}`, grupoParcelamentoId: 'g1', parcelaNumero: n, parcelaTotal: 3, valor: 500, descricao: 'Serviço', vencimento: `2026-${String(7 + n).padStart(2, '0')}-10`, competencia: `2026-${String(7 + n).padStart(2, '0')}`, status: 'Pendente', pagamentos: [] }))
  const result = editChargeCollection(finance, 'p2', { valor: 550, descricao: 'Serviço corrigido', vencimento: '2026-09-15', competencia: '2026-09' }, 'future', '2026-08-31')
  assert.equal(result.count, 2)
  assert.equal(result.finance[0].valor, 500)
  assert.equal(result.finance[1].valor, 550)
  assert.equal(result.finance[2].valor, 550)
  assert.equal(result.finance[2].vencimento, '2026-10-15')
  assert.equal(result.finance[2].competencia, '2026-10')
})

test('reajuste preserva valor histórico por competência', () => {
  const client = { id: 'cli1', mensalidade: 500, relacionamento: 'Recorrente' }
  const adjusted = applyFeeAdjustment(client, { valor: 600, competenciaInicio: '2026-09', observacao: 'Reajuste anual' })
  assert.equal(monthlyFeeForCompetence(adjusted, '2026-08'), 500)
  assert.equal(monthlyFeeForCompetence(adjusted, '2026-09'), 600)
  assert.equal(adjusted.honorariosHistorico.length, 1)
})

test('geração recorrente usa o honorário vigente da competência', () => {
  const client = applyFeeAdjustment({ id: 'cli1', razao: 'Cliente', mensalidade: 500, vencimento: 10, relacionamento: 'Recorrente', status: 'Ativo' }, { valor: 600, competenciaInicio: '2026-09' })
  const oldCharge = buildMissingRecurringCharges({ clients: [client], finance: [], competence: '2026-08', makeId: () => 'old' })[0]
  const newCharge = buildMissingRecurringCharges({ clients: [client], finance: [], competence: '2026-09', makeId: () => 'new' })[0]
  assert.equal(oldCharge.valor, 500)
  assert.equal(newCharge.valor, 600)
})

test('reajuste atualiza cobrança já gerada apenas quando ainda não possui baixa', () => {
  const open = [{ id: 'a', clienteId: 'cli', origem: 'recorrente', competencia: '2026-09', valor: 500, status: 'Pendente', pagamentos: [] }]
  const changed = applyAdjustmentToGeneratedCharge(open, 'cli', '2026-09', 600, '2026-08-31')
  assert.equal(changed.updated, true)
  assert.equal(changed.finance[0].valor, 600)

  const paid = [{ ...open[0], pagamentos: [{ id: 'p', data: '2026-09-10', valorRecebido: 100, desconto: 0, acrescimo: 0 }], status: 'Parcial' }]
  const blocked = applyAdjustmentToGeneratedCharge(paid, 'cli', '2026-09', 600, '2026-08-31')
  assert.equal(blocked.blocked, true)
  assert.equal(blocked.finance[0].valor, 500)
})

test('reajuste compartilhado mantém soma da divisão igual ao novo honorário', () => {
  const client = { id: 's1', mensalidade: 1000, relacionamento: 'Recorrente', perfilAtendimento: 'Compartilhado', compartilhadoMinhaParte: 700, compartilhadoPartesParceiros: [{ parceiroId: 'p1', valor: 300 }] }
  const adjusted = applyFeeAdjustment(client, { valor: 1200, competenciaInicio: '2026-09' })
  const total = adjusted.compartilhadoMinhaParte + adjusted.compartilhadoPartesParceiros.reduce((sum, item) => sum + item.valor, 0)
  assert.equal(total, 1200)
  assert.equal(adjusted.compartilhadoMinhaParte, 840)
  assert.equal(adjusted.compartilhadoPartesParceiros[0].valor, 360)
})
