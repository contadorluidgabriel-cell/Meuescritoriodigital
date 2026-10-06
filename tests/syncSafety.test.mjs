import test from 'node:test'
import assert from 'node:assert/strict'
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
