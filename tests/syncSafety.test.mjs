import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileExternalTaskPayload } from '../src/lib/taskProgress.js'
import { buildOfficeRecoveryPatch } from '../src/lib/workspaceSync.js'

const admin = { membership: { role: 'admin', permissions: {} } }

function officeWith(tasks = []) {
  return {
    tasks,
    clients: [], linkedCompanies: [], partners: [], taskTemplates: [], processes: [], obligations: [], processModels: [],
    finance: [], financeAccounts: [], financePayables: [], financeMovements: [], financeCategories: [], financeRecurrences: [],
    financeClosings: [], financeCollectionEvents: [], financeConfig: {}, settings: {}, departments: [], ui: {}, history: [], meta: {}, lastBackup: '',
  }
}

test('resposta externa vazia nunca apaga tarefas existentes do MED', () => {
  const current = [
    { id: 't1', titulo: 'Fiscal', status: 'Pendente', clientId: 'c1' },
    { id: 't2', titulo: 'Folha', status: 'Pendente', clientId: 'c2' },
  ]
  const next = reconcileExternalTaskPayload([], current)
  assert.deepEqual(next, current)
  assert.notEqual(next, current)
})

test('sincronização externa parcial atualiza correspondentes e preserva tarefas ausentes na resposta', () => {
  const current = [
    { id: 't1', titulo: 'Fiscal', status: 'Pendente', clientId: 'c1', subtarefas: [] },
    { id: 't2', titulo: 'Folha', status: 'Pendente', clientId: 'c2' },
  ]
  const remote = [{ id: 't1', titulo: 'Fiscal ajustado', status: 'Concluída' }]
  const next = reconcileExternalTaskPayload(remote, current)
  assert.equal(next.length, 2)
  assert.equal(next[0].titulo, 'Fiscal ajustado')
  assert.equal(next[0].clientId, 'c1')
  assert.equal(next[1].id, 't2')
})

test('recuperação de cache local não gera deletes contra o snapshot remoto', () => {
  const remote = officeWith([
    { id: 't1', titulo: 'Fiscal', status: 'Pendente' },
    { id: 't2', titulo: 'Folha', status: 'Pendente' },
  ])
  const staleLocal = officeWith([])
  const patch = buildOfficeRecoveryPatch(remote, staleLocal, admin)
  assert.equal(patch.tasks, undefined)
})

test('recuperação de cache ainda pode reenviar registros locais novos sem apagar os remotos', () => {
  const remote = officeWith([{ id: 't1', titulo: 'Fiscal', status: 'Pendente' }])
  const local = officeWith([
    { id: 't1', titulo: 'Fiscal', status: 'Pendente' },
    { id: 't2', titulo: 'Nova tarefa local', status: 'Pendente' },
  ])
  const patch = buildOfficeRecoveryPatch(remote, local, admin)
  assert.deepEqual(patch.tasks.upserts.map(task => task.id), ['t2'])
  assert.deepEqual(patch.tasks.deletes, [])
})
