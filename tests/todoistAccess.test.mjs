import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateTodoistAccess } from '../supabase/functions/todoist-sync/access.js'

const workspaceId = 'ws-primary'
const ownerId = 'user-owner'
const workspace = { id: workspaceId, owner_user_id: ownerId }
const adminMembership = { user_id: ownerId, workspace_id: workspaceId, role: 'admin', status: 'active' }

function evaluate(overrides = {}) {
  return evaluateTodoistAccess({
    userId: ownerId,
    requestedWorkspaceId: workspaceId,
    workspaceConfigured: true,
    membership: adminMembership,
    workspace,
    ...overrides,
  })
}

test('Todoist permite somente proprietário administrador do workspace habilitado', () => {
  assert.deepEqual(evaluate(), { ok: true, status: 200, workspaceId })
})

test('Todoist rejeita workspace fora da allowlist', () => {
  const result = evaluate({ workspaceConfigured: false })
  assert.equal(result.ok, false)
  assert.equal(result.status, 403)
})

test('Todoist rejeita colaborador do workspace configurado', () => {
  const result = evaluate({ membership: { ...adminMembership, role: 'collaborator' } })
  assert.equal(result.ok, false)
  assert.equal(result.status, 403)
})

test('Todoist rejeita administrador que não é proprietário', () => {
  const userId = 'user-admin'
  const result = evaluate({
    userId,
    membership: { user_id: userId, workspace_id: workspaceId, role: 'admin', status: 'active' },
  })
  assert.equal(result.ok, false)
  assert.equal(result.status, 403)
})

test('Todoist rejeita vínculo inativo', () => {
  const result = evaluate({ membership: { ...adminMembership, status: 'inactive' } })
  assert.equal(result.ok, false)
  assert.equal(result.status, 403)
})
