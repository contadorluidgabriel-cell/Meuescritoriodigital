import test from 'node:test'
import assert from 'node:assert/strict'
import { applyOfficePatch, filterPayloadForMembership } from '../supabase/functions/office-workspace/access.js'
import { personalOfficeForAccess } from '../src/lib/memberOfficeView.js'

const payload = {
  med_clientes: [
    { id: 'c1', razao: 'Cliente Um', perfilAtendimento: 'Compartilhado', parceiroIds: ['p1'], mensalidade: 1000, responsabilidadesCompartilhadas: { Fiscal: { responsavel: 'Parceiro', parceiroId: 'p1' } } },
    { id: 'c2', razao: 'Cliente Dois', perfilAtendimento: 'Compartilhado', parceiroIds: ['p2'], mensalidade: 2000, responsabilidadesCompartilhadas: { Fiscal: { responsavel: 'Parceiro', parceiroId: 'p2' } } },
  ],
  med_parceiros_trabalho: [{ id: 'p1', nome: 'Parceiro Um' }, { id: 'p2', nome: 'Parceiro Dois' }],
  med_tarefas: [
    { id: 't1', clientId: 'c1', titulo: 'DCTF', departamento: 'Fiscal', status: 'Pendente', prazo: '2026-09-05' },
    { id: 't2', clientId: 'c2', titulo: 'Folha', departamento: 'Fiscal', status: 'Pendente', prazo: '2026-09-05' },
  ],
  med_processos: [],
  med_obrigacoes: [],
  med_financeiro: [
    { id: 'f1', clienteId: 'c1', descricao: 'Honorário', valor: 1000, status: 'Recebido', parceiroIds: ['p1'], compartilhado: true, compartilhadoMinhaParte: 700, compartilhadoPartesParceiros: [{ parceiroId: 'p1', valor: 300 }], compartilhadoAcertoStatus: 'Pendente' },
    { id: 'f2', clienteId: 'c2', descricao: 'Outro', valor: 2000, status: 'Pendente', parceiroIds: ['p2'], compartilhado: true, compartilhadoPartesParceiros: [{ parceiroId: 'p2', valor: 500 }] },
  ],
  med_configuracoes: { office: 'Escritório', user: 'Admin' },
  med_preferencias: { secretUi: true },
}

const partner = { role: 'partner', partner_id: 'p1', permissions: { finance_shared: true } }

test('parceiro recebe somente clientes e trabalhos vinculados à sua parceria', () => {
  const filtered = filterPayloadForMembership(payload, partner)
  assert.deepEqual(filtered.med_clientes.map(item => item.id), ['c1'])
  assert.equal(filtered.med_clientes[0].mensalidade, undefined)
  assert.deepEqual(filtered.med_tarefas.map(item => item.id), ['t1'])
  assert.deepEqual(filtered.med_parceiros_trabalho.map(item => item.id), ['p1'])
  assert.deepEqual(filtered.med_financeiro.map(item => item.id), ['f1'])
  assert.equal(filtered.med_financeiro[0].compartilhadoParceiroParte, 300)
  assert.deepEqual(filtered.med_preferencias, {})
})

test('parceiro pode atualizar andamento mas não redefinir título, prazo ou excluir', () => {
  const result = applyOfficePatch(payload, {
    tasks: {
      upserts: [{ id: 't1', clientId: 'c1', titulo: 'Título malicioso', prazo: '2030-01-01', departamento: 'Fiscal', status: 'Concluída' }],
      deletes: ['t1'],
    },
  }, partner)
  const task = result.payload.med_tarefas.find(item => item.id === 't1')
  assert.equal(task.status, 'Concluída')
  assert.equal(task.titulo, 'DCTF')
  assert.equal(task.prazo, '2026-09-05')
  assert.ok(result.payload.med_tarefas.some(item => item.id === 't1'))
})

test('colaborador sem financeiro não recebe cobranças e não consegue alterá-las', () => {
  const collaborator = { role: 'collaborator', permissions: { clients: true, tasks: true, processes: true, obligations: true, finance: false, finance_edit: false } }
  const filtered = filterPayloadForMembership(payload, collaborator)
  assert.deepEqual(filtered.med_financeiro, [])
  const result = applyOfficePatch(payload, { finance: { upserts: [{ ...payload.med_financeiro[0], valor: 1 }], deletes: [] } }, collaborator)
  assert.equal(result.payload.med_financeiro[0].valor, 1000)
})

test('Meu Dia do colaborador usa somente itens atribuídos ao seu usuário', () => {
  const office = {
    tasks: [{ id: 'a', responsavelUserId: 'u1' }, { id: 'b', responsavelUserId: 'u2' }],
    processes: [{ id: 'p', responsavelUserId: 'u1' }],
    obligations: [{ id: 'o', clientes: [{ clienteId: 'c1', responsavelUserId: 'u2' }, { clienteId: 'c2', responsavelUserId: 'u1' }] }],
  }
  const personal = personalOfficeForAccess(office, { membership: { role: 'collaborator', user_id: 'u1' } })
  assert.deepEqual(personal.tasks.map(item => item.id), ['a'])
  assert.deepEqual(personal.processes.map(item => item.id), ['p'])
  assert.deepEqual(personal.obligations[0].clientes.map(item => item.clienteId), ['c2'])
})
