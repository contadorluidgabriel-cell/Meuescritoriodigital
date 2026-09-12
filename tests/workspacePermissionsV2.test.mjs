import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyOfficePatch,
  filterPayloadForMembership,
  memberCanSeeTeam,
  permissionsFor,
} from '../supabase/functions/office-workspace/access.js'
import { personalOfficeForAccess } from '../src/lib/memberOfficeView.js'

const payload = {
  med_clientes: [
    { id: 'c1', razao: 'Cliente Um', documento: '11.111.111/0001-11', mensalidade: 1000 },
    { id: 'c2', razao: 'Cliente Dois', documento: '22.222.222/0001-22', mensalidade: 2000 },
  ],
  med_cnpjs_vinculados: [
    { id: 'l1', clienteId: 'c1', nome: 'Filial Um' },
    { id: 'l2', clienteId: 'c2', nome: 'Filial Dois' },
  ],
  med_parceiros_trabalho: [{ id: 'par1', nome: 'Parceiro' }],
  med_tarefas: [
    { id: 't1', clientId: 'c1', titulo: 'Minha', status: 'Pendente', responsavelUserId: 'u1' },
    { id: 't2', clientId: 'c1', titulo: 'Sem responsável', status: 'Pendente', responsavelUserId: '' },
    { id: 't3', clientId: 'c1', titulo: 'De outro', status: 'Pendente', responsavelUserId: 'u2' },
    { id: 't4', clientId: 'c2', titulo: 'Fora da carteira', status: 'Pendente', responsavelUserId: 'u1' },
    { id: 't5', clientId: '', titulo: 'Interna sem responsável', status: 'Pendente', responsavelUserId: '' },
  ],
  med_tarefas_modelos: [{ id: 'tm1', nome: 'Modelo' }],
  med_processos: [
    { id: 'p1', clientId: 'c1', tipo: 'Alteração', status: 'Em andamento', responsavelUserId: '' },
    { id: 'p2', clientId: 'c2', tipo: 'Baixa', status: 'Em andamento', responsavelUserId: 'u1' },
  ],
  med_processos_modelos: [{ id: 'pm1', nome: 'Modelo processo' }],
  med_obrigacoes: [{
    id: 'o1', nome: 'Obrigação', categoria: 'Fiscal', clientes: [
      { clienteId: 'c1', status: 'Pendente', responsavelUserId: '' },
      { clienteId: 'c1', status: 'Pendente', responsavelUserId: 'u2' },
      { clienteId: 'c2', status: 'Pendente', responsavelUserId: 'u1' },
    ],
  }],
  med_financeiro: [
    { id: 'f1', clienteId: 'c1', valor: 1000 },
    { id: 'f2', clienteId: 'c2', valor: 2000 },
  ],
  med_financeiro_pagar: [{ id: 'pay1', valor: 300 }],
  med_financeiro_contas: [{ id: 'acc1', nome: 'Banco' }],
  med_financeiro_movimentos: [{ id: 'mov1', valor: 100 }],
  med_financeiro_categorias: [{ id: 'cat1', nome: 'Honorários' }],
  med_financeiro_recorrencias: [{ id: 'rec1' }],
  med_financeiro_fechamentos: [{ id: 'close1', competencia: '2026-09' }],
  med_financeiro_cobrancas_eventos: [{ id: 'ce1', clienteId: 'c1' }, { id: 'ce2', clienteId: 'c2' }],
  med_financeiro_configuracoes: { saldoInicial: 100 },
  med_configuracoes: { office: 'Escritório', segredo: 'interno' },
  med_departamentos: [{ name: 'Fiscal' }],
  med_preferencias: { secretUi: true },
  med_historico_painel: [],
  med_meta: { version: '11.1' },
  med_last_backup: 'secret',
}

const v2Collaborator = {
  role: 'collaborator',
  user_id: 'u1',
  office_workspaces: { owner_user_id: 'owner' },
  permissions: {
    access_v2: true,
    client_ids: ['c1'],
    clients: true,
    tasks: true,
    processes: true,
    obligations: true,
    work_visibility: 'mine_and_unassigned',
    finance_receivables: true,
    finance_payables: false,
    finance_cash: false,
    finance_reports: true,
    manage_clients: false,
  },
}

test('V2 filtra empresas, rotinas e meus trabalhos + não atribuídos no backend', () => {
  const filtered = filterPayloadForMembership(payload, v2Collaborator)
  assert.deepEqual(filtered.med_clientes.map(item => item.id), ['c1'])
  assert.deepEqual(filtered.med_tarefas.map(item => item.id), ['t1', 't2', 't5'])
  assert.deepEqual(filtered.med_processos.map(item => item.id), ['p1'])
  assert.equal(filtered.med_obrigacoes.length, 1)
  assert.deepEqual(filtered.med_obrigacoes[0].clientes.map(item => item.clienteId), ['c1'])
  assert.equal(filtered.med_obrigacoes[0].clientes.length, 1)
  assert.deepEqual(filtered.med_financeiro.map(item => item.id), ['f1'])
  assert.deepEqual(filtered.med_financeiro_pagar, [])
  assert.deepEqual(filtered.med_financeiro_contas, [])
  assert.deepEqual(filtered.med_financeiro_fechamentos, [], 'relatório agregado não deve vazar quando a carteira é parcial')
  assert.deepEqual(filtered.med_parceiros_trabalho, [])
  assert.equal(filtered.med_configuracoes.segredo, undefined)
})

test('sem rotina Clientes o V2 mantém só contexto cadastral mínimo da carteira', () => {
  const membership = structuredClone(v2Collaborator)
  membership.permissions.clients = false
  const filtered = filterPayloadForMembership(payload, membership)
  assert.deepEqual(filtered.med_clientes.map(item => item.id), ['c1'])
  assert.equal(filtered.med_clientes[0].razao, 'Cliente Um')
  assert.equal(filtered.med_clientes[0].documento, '11.111.111/0001-11')
  assert.equal(filtered.med_clientes[0].mensalidade, undefined)
  assert.deepEqual(filtered.med_cnpjs_vinculados, [])
})

test('administrador V2 gerencia equipe sem ganhar acesso operacional total', () => {
  const admin = {
    ...structuredClone(v2Collaborator),
    role: 'admin',
    user_id: 'admin2',
    permissions: {
      ...structuredClone(v2Collaborator.permissions),
      tasks: false,
      processes: false,
      obligations: false,
      finance_receivables: false,
      finance_reports: false,
      work_visibility: 'all_allowed',
    },
  }
  assert.equal(memberCanSeeTeam(admin), true)
  const perms = permissionsFor(admin)
  assert.equal(perms.team, true)
  assert.equal(perms.delete_records, true)
  const filtered = filterPayloadForMembership(payload, admin)
  assert.deepEqual(filtered.med_clientes.map(item => item.id), ['c1'])
  assert.deepEqual(filtered.med_tarefas, [])
  assert.deepEqual(filtered.med_processos, [])
  assert.deepEqual(filtered.med_obrigacoes, [])
  assert.deepEqual(filtered.med_financeiro, [])
})

test('proprietário continua com acesso total mesmo se houver marcador V2', () => {
  const owner = {
    role: 'admin',
    user_id: 'owner',
    office_workspaces: { owner_user_id: 'owner' },
    permissions: { access_v2: true, client_ids: [], clients: false, tasks: false },
  }
  const filtered = filterPayloadForMembership(payload, owner)
  assert.deepEqual(filtered.med_clientes.map(item => item.id), ['c1', 'c2'])
  assert.deepEqual(filtered.med_tarefas.map(item => item.id), ['t1', 't2', 't3', 't4', 't5'])
  assert.equal(memberCanSeeTeam(owner), true)
})

test('colaborador V2 não altera empresa fora da carteira, não transfere para terceiro e não exclui', () => {
  const result = applyOfficePatch(payload, {
    tasks: {
      upserts: [
        { ...payload.med_tarefas[0], status: 'Concluída', responsavelUserId: 'u2' },
        { ...payload.med_tarefas[3], status: 'Concluída' },
      ],
      deletes: ['t1'],
    },
  }, v2Collaborator)
  const allowed = result.payload.med_tarefas.find(item => item.id === 't1')
  const blocked = result.payload.med_tarefas.find(item => item.id === 't4')
  assert.equal(allowed.status, 'Concluída')
  assert.equal(allowed.responsavelUserId, 'u1')
  assert.equal(blocked.status, 'Pendente')
  assert.ok(result.payload.med_tarefas.some(item => item.id === 't1'))
})

test('administrador V2 pode excluir apenas dentro da carteira autorizada', () => {
  const admin = {
    ...structuredClone(v2Collaborator),
    role: 'admin',
    user_id: 'admin2',
    permissions: { ...structuredClone(v2Collaborator.permissions), work_visibility: 'all_allowed' },
  }
  const result = applyOfficePatch(payload, { tasks: { upserts: [], deletes: ['t1', 't4'] } }, admin)
  assert.equal(result.payload.med_tarefas.some(item => item.id === 't1'), false)
  assert.equal(result.payload.med_tarefas.some(item => item.id === 't4'), true)
})

test('visão pessoal V2 inclui trabalhos próprios e não atribuídos, mas não de terceiros', () => {
  const office = {
    tasks: [{ id: 'a', responsavelUserId: 'u1' }, { id: 'b', responsavelUserId: '' }, { id: 'c', responsavelUserId: 'u2' }],
    processes: [{ id: 'p1', responsavelUserId: '' }, { id: 'p2', responsavelUserId: 'u2' }],
    obligations: [{ id: 'o', clientes: [{ clienteId: 'c1', responsavelUserId: '' }, { clienteId: 'c2', responsavelUserId: 'u2' }] }],
  }
  const access = { membership: v2Collaborator, workspace: { owner_user_id: 'owner' } }
  const personal = personalOfficeForAccess(office, access)
  assert.deepEqual(personal.tasks.map(item => item.id), ['a', 'b'])
  assert.deepEqual(personal.processes.map(item => item.id), ['p1'])
  assert.deepEqual(personal.obligations[0].clientes.map(item => item.clienteId), ['c1'])
})
