import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyWorkResponsible,
  memberCanReceiveWork,
  routineForWorkKind,
  workAssignmentKey,
} from '../src/lib/workDistribution.js'

const ownerId = 'owner-1'
const row = { kind: 'task', id: 't1', clientId: 'c1' }

const member = (overrides = {}) => ({
  id: 'm1',
  user_id: 'u1',
  role: 'collaborator',
  status: 'active',
  permissions: {
    access_v2: true,
    client_ids: ['c1'],
    tasks: true,
    processes: false,
    obligations: false,
  },
  ...overrides,
})

test('mapeia cada trabalho para sua rotina operacional', () => {
  assert.equal(routineForWorkKind('task'), 'tasks')
  assert.equal(routineForWorkKind('process'), 'processes')
  assert.equal(routineForWorkKind('obligation'), 'obligations')
  assert.equal(routineForWorkKind('other'), '')
})

test('usuário V2 só recebe trabalho quando possui empresa e rotina', () => {
  assert.equal(memberCanReceiveWork(member(), row, ownerId), true)
  assert.equal(memberCanReceiveWork(member({ permissions: { ...member().permissions, client_ids: ['c2'] } }), row, ownerId), false)
  assert.equal(memberCanReceiveWork(member({ permissions: { ...member().permissions, tasks: false } }), row, ownerId), false)
})

test('tarefa interna depende da rotina, mas não de carteira de cliente', () => {
  const internal = { kind: 'task', id: 't2', clientId: '' }
  assert.equal(memberCanReceiveWork(member({ permissions: { ...member().permissions, client_ids: [] } }), internal, ownerId), true)
})

test('proprietário pode receber trabalhos e parceiro fica fora da distribuição interna', () => {
  assert.equal(memberCanReceiveWork(member({ user_id: ownerId, role: 'admin', permissions: {} }), row, ownerId), true)
  assert.equal(memberCanReceiveWork(member({ role: 'partner' }), row, ownerId), false)
})

test('usuário legado respeita a permissão da rotina', () => {
  const legacy = member({ permissions: { tasks: true } })
  assert.equal(memberCanReceiveWork(legacy, row, ownerId), true)
  assert.equal(memberCanReceiveWork(member({ permissions: { tasks: false } }), row, ownerId), false)
})

test('atribuição atualiza tarefa, processo e vínculo da obrigação', () => {
  const draft = {
    tasks: [{ id: 't1', responsavelUserId: '' }],
    processes: [{ id: 'p1', responsavelUserId: '' }],
    obligations: [{ id: 'o1', clientes: [{ clienteId: 'c1', responsavelUserId: '' }] }],
  }
  const stamp = '2026-09-12T19:00:00.000Z'
  assert.equal(applyWorkResponsible(draft, { kind: 'task', id: 't1' }, 'u1', stamp), true)
  assert.equal(applyWorkResponsible(draft, { kind: 'process', id: 'p1' }, 'u2', stamp), true)
  assert.equal(applyWorkResponsible(draft, { kind: 'obligation', id: 'o1', clientId: 'c1' }, 'u3', stamp), true)
  assert.equal(draft.tasks[0].responsavelUserId, 'u1')
  assert.equal(draft.processes[0].responsavelUserId, 'u2')
  assert.equal(draft.obligations[0].clientes[0].responsavelUserId, 'u3')
  assert.equal(draft.tasks[0].updatedAt, stamp)
})

test('chave de seleção diferencia obrigação por empresa', () => {
  assert.equal(workAssignmentKey({ kind: 'obligation', id: 'o1', clientId: 'c1' }), 'obligation:o1:c1')
  assert.notEqual(workAssignmentKey({ kind: 'obligation', id: 'o1', clientId: 'c1' }), workAssignmentKey({ kind: 'obligation', id: 'o1', clientId: 'c2' }))
})
