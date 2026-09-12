import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { defaultInternalV2Permissions } from '../supabase/functions/office-workspace/access.js'

const manager = readFileSync(new URL('../src/components/UserAccessManager.jsx', import.meta.url), 'utf8')
const bridge = readFileSync(new URL('../src/components/TeamManagement.jsx', import.meta.url), 'utf8')
const invitePatch = readFileSync(new URL('../scripts/patch-invite-links.mjs', import.meta.url), 'utf8')
const workspaceFn = readFileSync(new URL('../supabase/functions/office-workspace/index.ts', import.meta.url), 'utf8')

test('novos usuários internos V2 começam sem carteira e sem rotinas operacionais', () => {
  for (const role of ['collaborator', 'admin']) {
    const permissions = defaultInternalV2Permissions(role)
    assert.equal(permissions.access_v2, true)
    assert.deepEqual(permissions.client_ids, [])
    assert.equal(permissions.clients, false)
    assert.equal(permissions.tasks, false)
    assert.equal(permissions.processes, false)
    assert.equal(permissions.obligations, false)
    assert.equal(permissions.finance_receivables, false)
    assert.equal(permissions.finance_payables, false)
    assert.equal(permissions.finance_cash, false)
    assert.equal(permissions.finance_reports, false)
  }
})

test('gestor de usuários expõe as cinco áreas do controle detalhado', () => {
  assert.match(manager, /\['data', 'Dados'\]/)
  assert.match(manager, /\['companies', 'Empresas'\]/)
  assert.match(manager, /\['routines', 'Rotinas'\]/)
  assert.match(manager, /\['responsibilities', 'Responsabilidades'\]/)
  assert.match(manager, /\['history', 'Histórico'\]/)
  assert.match(manager, /work_visibility/)
  assert.match(manager, /client_ids/)
  assert.match(manager, /finance_receivables/)
  assert.match(manager, /finance_payables/)
  assert.match(manager, /finance_cash/)
  assert.match(manager, /finance_reports/)
})

test('usuários legados não são migrados automaticamente pela interface', () => {
  assert.match(manager, /Permissões legadas/)
  assert.match(manager, /Ativar Permissões V2/)
  assert.match(manager, /Nenhuma migração foi feita automaticamente/)
})

test('convite interno e promoção para administrador usam permissões V2 no backend', () => {
  assert.match(workspaceFn, /defaultInternalV2Permissions\(role\)/)
  assert.match(workspaceFn, /if \(internalRole\(role\)\)/)
  assert.doesNotMatch(workspaceFn, /A promoção para Administrador não está disponível/)
})

test('patch legado de convites não sobrescreve o novo gestor de usuários', () => {
  assert.match(bridge, /MED_USER_ACCESS_V2/)
  assert.match(invitePatch, /MED_USER_ACCESS_V2/)
  assert.match(manager, /createWorkspaceInviteLink/)
})
