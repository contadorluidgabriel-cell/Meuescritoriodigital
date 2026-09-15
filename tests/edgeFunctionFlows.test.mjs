import test from 'node:test'
import assert from 'node:assert/strict'
import { supabase } from '../src/lib/supabase.js'
import { deleteWorkspaceUser, updateWorkspaceMember } from '../src/lib/workspaceSync.js'
import { deactivateWorkspaceMemberWithReassignment } from '../src/lib/distributionSync.js'

test('fluxos reais preservam erros JSON usando somente HTTP simulado', async t => {
  t.mock.method(supabase.auth, 'getSession', async () => ({ data: { session: { access_token: 'test-token' } } }))
  t.mock.method(supabase.functions, 'invoke', () => { throw new Error('SDK invoke must not be used') })
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) })
    return new Response(JSON.stringify({ error: 'blocked', message: 'Responsabilidades pendentes.' }), { status: 409 })
  })
  await assert.rejects(deleteWorkspaceUser('test-workspace', 'test-member', 'EXCLUIR'), /Responsabilidades pendentes\./)
  await assert.rejects(updateWorkspaceMember('test-workspace', { member_id: 'test-member', status: 'disabled' }), /Responsabilidades pendentes\./)
  await assert.rejects(deactivateWorkspaceMemberWithReassignment('test-workspace', 'test-member', ''), /Responsabilidades pendentes\./)
  assert.deepEqual(calls.map(call => call.url.split('/').at(-1)), ['office-user-admin', 'office-workspace-web', 'office-distribution'])
  assert.deepEqual(calls.map(call => call.body.action), ['delete_user', 'update_member', 'deactivate_member'])
  assert.equal(calls[0].body.confirmation, 'EXCLUIR')
  assert.equal(calls[2].body.replacement_user_id, '')
  for (const call of calls) {
    assert.equal(call.options.headers.Authorization, 'Bearer test-token')
    assert.equal(call.body.workspace_id, 'test-workspace')
    assert.equal(call.body.member_id, 'test-member')
  }
})
