import test from 'node:test'
import assert from 'node:assert/strict'
import { filterPushPayload } from '../supabase/functions/office-push-dispatch/recipientAccess.js'

const payload = {
  med_clientes: [
    { id: 'c1', razao: 'Cliente A', perfilAtendimento: 'Compartilhado', parceiroIds: ['p1'], compartilhadoPartesParceiros: [{ parceiroId: 'p1', valor: 300 }], responsabilidadesCompartilhadas: { Fiscal: { responsavel: 'Parceiro', parceiroId: 'p1' } } },
    { id: 'c2', razao: 'Cliente B', perfilAtendimento: 'Compartilhado', parceiroIds: ['p2'], responsabilidadesCompartilhadas: { Fiscal: { responsavel: 'Parceiro', parceiroId: 'p2' } } },
  ],
  med_tarefas: [
    { id: 't1', clientId: 'c1', titulo: 'DCTF A', departamento: 'Fiscal', responsavelUserId: 'u1' },
    { id: 't2', clientId: 'c2', titulo: 'DCTF B', departamento: 'Fiscal', responsavelUserId: 'u2' },
  ],
  med_processos: [{ id: 'pr1', clientId: 'c1', tipo: 'Alteração', responsavelUserId: 'u1', compartilhadoResponsavel: 'Parceiro', compartilhadoParceiroId: 'p1' }],
  med_obrigacoes: [{ id: 'o1', nome: 'PGDAS', categoria: 'Fiscal', clientes: [{ clienteId: 'c1', responsavelUserId: 'u1' }, { clienteId: 'c2', responsavelUserId: 'u2' }] }],
  med_financeiro: [
    { id: 'f1', clienteId: 'c1', descricao: 'Honorário A', valor: 1000, status: 'Pendente', parceiroIds: ['p1'], compartilhadoPartesParceiros: [{ parceiroId: 'p1', valor: 300 }] },
    { id: 'f2', clienteId: 'c2', descricao: 'Honorário B', valor: 2000, status: 'Pendente', parceiroIds: ['p2'], compartilhadoPartesParceiros: [{ parceiroId: 'p2', valor: 500 }] },
  ],
}

test('push do colaborador usa somente trabalho atribuído', () => {
  const result = filterPushPayload(payload, { role: 'collaborator', user_id: 'u1', permissions: { finance: false } }, 'u1')
  assert.deepEqual(result.med_tarefas.map(item => item.id), ['t1'])
  assert.deepEqual(result.med_processos.map(item => item.id), ['pr1'])
  assert.deepEqual(result.med_obrigacoes[0].clientes.map(item => item.clienteId), ['c1'])
  assert.deepEqual(result.med_financeiro, [])
})

test('push do parceiro usa somente parceria e valor da parte dele', () => {
  const result = filterPushPayload(payload, { role: 'partner', partner_id: 'p1', permissions: { finance_shared: true } }, 'partner-user')
  assert.deepEqual(result.med_clientes.map(item => item.id), ['c1'])
  assert.deepEqual(result.med_tarefas.map(item => item.id), ['t1'])
  assert.deepEqual(result.med_processos.map(item => item.id), ['pr1'])
  assert.deepEqual(result.med_obrigacoes[0].clientes.map(item => item.clienteId), ['c1'])
  assert.deepEqual(result.med_financeiro.map(item => item.id), ['f1'])
  assert.equal(result.med_financeiro[0].valor, 300)
})
