import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOfficePatch } from '../src/lib/workspaceSync.js'

const admin = { membership: { role: 'admin', permissions: {} } }

test('patch altera somente registros modificados sem substituir a coleção inteira', () => {
  const before = { tasks: [{ id: 'a', titulo: 'A', status: 'Pendente' }, { id: 'b', titulo: 'B', status: 'Pendente' }], clients: [], linkedCompanies: [], partners: [], taskTemplates: [], processes: [], obligations: [], processModels: [], finance: [], settings: {}, departments: [], ui: {}, history: [], meta: {}, lastBackup: '' }
  const after = structuredClone(before)
  after.tasks[1].status = 'Concluída'
  const patch = buildOfficePatch(before, after, admin)
  assert.deepEqual(patch.tasks.deletes, [])
  assert.deepEqual(patch.tasks.upserts.map(item => item.id), ['b'])
})

test('patch ignora somente reordenação de chaves vindas do JSONB', () => {
  const before = {
    tasks: [], clients: [], linkedCompanies: [], partners: [], taskTemplates: [], processes: [], obligations: [], processModels: [],
    finance: [{ id: 'fin-1', status: 'Pendente', dados: { valor: 400, vencimento: '2026-09-29' }, parceiros: [{ parceiroId: 'p1', valor: 200 }] }],
    settings: {}, departments: [], ui: {}, history: [], meta: {}, lastBackup: '',
  }
  const after = {
    ...structuredClone(before),
    finance: [{ parceiros: [{ valor: 200, parceiroId: 'p1' }], dados: { vencimento: '2026-09-29', valor: 400 }, status: 'Pendente', id: 'fin-1' }],
  }
  const patch = buildOfficePatch(before, after, admin)
  assert.equal(patch.finance, undefined)
})

test('colaborador não envia alterações financeiras quando só possui visualização', () => {
  const before = { tasks: [], clients: [], linkedCompanies: [], partners: [], taskTemplates: [], processes: [], obligations: [], processModels: [], finance: [{ id: 'f', valor: 100 }], settings: {}, departments: [], ui: {}, history: [], meta: {}, lastBackup: '' }
  const after = structuredClone(before)
  after.finance[0].valor = 1
  const patch = buildOfficePatch(before, after, { membership: { role: 'collaborator', permissions: { finance: true, finance_edit: false } } })
  assert.equal(patch.finance, undefined)
})

test('parceiro envia somente alterações de tarefas, processos e obrigações', () => {
  const before = { tasks: [{ id: 't', status: 'Pendente' }], clients: [{ id: 'c', nome: 'A' }], linkedCompanies: [], partners: [], taskTemplates: [], processes: [], obligations: [], processModels: [], finance: [], settings: {}, departments: [], ui: {}, history: [], meta: {}, lastBackup: '' }
  const after = structuredClone(before)
  after.tasks[0].status = 'Concluída'
  after.clients[0].nome = 'Alterado'
  const patch = buildOfficePatch(before, after, { membership: { role: 'partner', permissions: {} } })
  assert.ok(patch.tasks)
  assert.equal(patch.clients, undefined)
})
