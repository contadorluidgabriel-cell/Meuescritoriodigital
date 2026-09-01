import test from 'node:test'
import assert from 'node:assert/strict'
import { filterPushPayload } from '../supabase/functions/office-push-dispatch/recipientAccessV2.js'

const payload = {
  med_clientes: [{ id: 'c1', perfilAtendimento: 'Compartilhado', parceiroIds: ['p1'] }],
  med_tarefas: [], med_processos: [], med_obrigacoes: [],
  med_financeiro: [{ id: 'f1', clienteId: 'c1', valor: 1000, parceiroIds: ['p1'], compartilhadoPartesParceiros: [{ parceiroId: 'p1', valor: 400 }] }],
  med_financeiro_pagar: [{ id: 'd1', valor: 200 }],
  med_financeiro_contas: [{ id: 'a1', saldoInicial: 500 }],
  med_financeiro_movimentos: [{ id: 'm1', valor: 20 }],
  med_financeiro_fechamentos: [{ id: 'fe1' }],
  med_financeiro_configuracoes: { forecastDays: 30 },
}

test('push de colaborador não carrega áreas financeiras sem escopo', () => {
  const filtered = filterPushPayload(payload, { role: 'collaborator', user_id: 'u1', permissions: { finance_receivables: true } }, 'u1')
  assert.equal(filtered.med_financeiro.length, 1)
  assert.deepEqual(filtered.med_financeiro_pagar, [])
  assert.deepEqual(filtered.med_financeiro_contas, [])
  assert.deepEqual(filtered.med_financeiro_movimentos, [])
  assert.deepEqual(filtered.med_financeiro_fechamentos, [])
})

test('push de parceiro nunca carrega Financeiro V2 geral', () => {
  const filtered = filterPushPayload(payload, { role: 'partner', partner_id: 'p1', permissions: { finance_shared: true } }, 'up')
  assert.equal(filtered.med_financeiro.length, 1)
  assert.equal(filtered.med_financeiro[0].valor, 400)
  assert.deepEqual(filtered.med_financeiro_pagar, [])
  assert.deepEqual(filtered.med_financeiro_contas, [])
  assert.deepEqual(filtered.med_financeiro_movimentos, [])
  assert.deepEqual(filtered.med_financeiro_configuracoes, {})
})
