import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  applyPrimaryResponsibilityInheritance,
  countClientOpenWorkForResponsible,
  transferClientOpenWork,
} from '../src/lib/responsibility.js'
import {
  applyInternalV2Patch,
  filterInternalV2Payload,
} from '../supabase/functions/office-workspace/accessInternalV2Principal.js'
import { filterPayloadForMembership } from '../supabase/functions/office-workspace/access.js'

const membership = {
  user_id: 'u1',
  role: 'collaborator',
  permissions: {
    access_v2: true,
    client_ids: ['c1'],
    clients: false,
    tasks: true,
    processes: true,
    obligations: true,
    work_visibility: 'mine_and_unassigned',
  },
  workspace: { owner_user_id: 'owner' },
}

test('novos trabalhos herdam o responsável principal sem sobrescrever responsável explícito', () => {
  const before = {
    clients: [{ id: 'c1', responsavelPrincipalUserId: 'u2' }],
    tasks: [{ id: 'old', clientId: 'c1', responsavelUserId: '' }],
    processes: [], obligations: [],
  }
  const after = structuredClone(before)
  after.tasks.push({ id: 'new-task', clientId: 'c1', responsavelUserId: '' })
  after.tasks.push({ id: 'explicit', clientId: 'c1', responsavelUserId: 'u3' })
  after.processes.push({ id: 'new-process', clientId: 'c1', responsavelUserId: '' })
  after.obligations.push({ id: 'o1', clientes: [{ clienteId: 'c1', responsavelUserId: '' }] })

  assert.equal(applyPrimaryResponsibilityInheritance(before, after, '2026-09-12T20:00:00.000Z'), 3)
  assert.equal(after.tasks.find(item => item.id === 'old').responsavelUserId, '')
  assert.equal(after.tasks.find(item => item.id === 'new-task').responsavelUserId, 'u2')
  assert.equal(after.tasks.find(item => item.id === 'explicit').responsavelUserId, 'u3')
  assert.equal(after.processes[0].responsavelUserId, 'u2')
  assert.equal(after.obligations[0].clientes[0].responsavelUserId, 'u2')
})

test('troca de principal transfere somente trabalho aberto do responsável anterior', () => {
  const draft = {
    tasks: [
      { id: 't1', clientId: 'c1', status: 'Pendente', responsavelUserId: 'u1' },
      { id: 't2', clientId: 'c1', status: 'Concluída', responsavelUserId: 'u1' },
      { id: 't3', clientId: 'c1', status: 'Pendente', responsavelUserId: 'u3' },
    ],
    processes: [{ id: 'p1', clientId: 'c1', status: 'Em andamento', responsavelUserId: 'u1' }],
    obligations: [{ id: 'o1', clientes: [
      { clienteId: 'c1', status: 'Pendente', responsavelUserId: 'u1' },
      { clienteId: 'c2', status: 'Pendente', responsavelUserId: 'u1' },
    ] }],
  }
  const count = countClientOpenWorkForResponsible(draft, 'c1', 'u1')
  assert.deepEqual(count, { tasks: 1, processes: 1, obligations: 1, total: 3 })
  const moved = transferClientOpenWork(draft, 'c1', 'u1', 'u2', '2026-09-12T20:00:00.000Z')
  assert.equal(moved.total, 3)
  assert.equal(draft.tasks[0].responsavelUserId, 'u2')
  assert.equal(draft.tasks[1].responsavelUserId, 'u1')
  assert.equal(draft.tasks[2].responsavelUserId, 'u3')
  assert.equal(draft.obligations[0].clientes[1].responsavelUserId, 'u1')
})

test('filtro V2 preserva apenas o id do responsável principal no contexto mínimo', () => {
  const payload = { med_clientes: [{ id: 'c1', razao: 'Empresa A', responsavelPrincipalUserId: 'u2', responsavelPrincipalNome: 'Pessoa Interna' }] }
  const filtered = filterInternalV2Payload(payload, membership)
  assert.equal(filtered.med_clientes[0].responsavelPrincipalUserId, 'u2')
  assert.equal(filtered.med_clientes[0].responsavelPrincipalNome, undefined)
})

test('tarefa nova herdada é aceita pelo backend V2 mesmo ficando atribuída ao principal', () => {
  const payload = {
    med_clientes: [{ id: 'c1', razao: 'Empresa A', responsavelPrincipalUserId: 'u2' }],
    med_tarefas: [], med_processos: [], med_obrigacoes: [], med_historico_painel: [],
  }
  const patch = { tasks: { upserts: [{ id: 't1', clientId: 'c1', status: 'Pendente', responsavelUserId: 'u2' }], deletes: [] } }
  const applied = applyInternalV2Patch(payload, patch, membership)
  assert.equal(applied.payload.med_tarefas.length, 1)
  assert.equal(applied.payload.med_tarefas[0].responsavelUserId, 'u2')
})

test('parceiro não recebe metadados internos do responsável principal', () => {
  const payload = {
    med_clientes: [{ id: 'c1', razao: 'Empresa A', parceiroId: 'p1', perfilAtendimento: 'Compartilhado', responsavelPrincipalUserId: 'u2', responsavelPrincipalNome: 'Pessoa Interna' }],
    med_tarefas: [], med_processos: [], med_obrigacoes: [], med_financeiro: [], med_parceiros_trabalho: [],
  }
  const filtered = filterPayloadForMembership(payload, { role: 'partner', partner_id: 'p1', permissions: { finance_shared: true } })
  assert.equal(filtered.med_clientes.length, 1)
  assert.equal(filtered.med_clientes[0].responsavelPrincipalUserId, undefined)
  assert.equal(filtered.med_clientes[0].responsavelPrincipalNome, undefined)
})

test('interface conecta responsável principal, carga, histórico e desligamento assistido', () => {
  const client = readFileSync(new URL('../src/components/ClientPrimaryResponsible.jsx', import.meta.url), 'utf8')
  const distribution = readFileSync(new URL('../src/components/WorkDistributionV2.jsx', import.meta.url), 'utf8')
  const team = readFileSync(new URL('../src/components/TeamManagement.jsx', import.meta.url), 'utf8')
  const patch = readFileSync(new URL('../scripts/patch-responsibility-distribution-v2.mjs', import.meta.url), 'utf8')
  assert.match(client, /Responsável principal/)
  assert.match(client, /Só novos trabalhos/)
  assert.match(client, /Transferir também os abertos/)
  assert.match(distribution, /Carga por responsável/)
  assert.match(distribution, /Desligamento assistido/)
  assert.match(distribution, /Histórico da distribuição/)
  assert.match(team, /onOpenDistribution/)
  assert.match(patch, /applyPrimaryResponsibilityInheritance/)
})
