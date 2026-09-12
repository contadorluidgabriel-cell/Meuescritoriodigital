import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { defaultInternalV2Permissions } from '../supabase/functions/office-workspace/access.js'

const manager = readFileSync(new URL('../src/components/UserAccessManager.jsx', import.meta.url), 'utf8')
const bridge = readFileSync(new URL('../src/components/TeamManagement.jsx', import.meta.url), 'utf8')
const chrome = readFileSync(new URL('../src/components/AppChrome.jsx', import.meta.url), 'utf8')
const invitePatch = readFileSync(new URL('../scripts/patch-invite-links.mjs', import.meta.url), 'utf8')
const financePatch = readFileSync(new URL('../scripts/patch-multiuser-finance-v2.mjs', import.meta.url), 'utf8')
const accessRoutesPatch = readFileSync(new URL('../scripts/patch-access-routes.mjs', import.meta.url), 'utf8')
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

test('campo de nome do usuário é editável sem controlled input travado', () => {
  assert.match(manager, /defaultValue=\{selected\.display_name \|\| ''\}/)
  assert.doesNotMatch(manager, /onChange=\{\(\) => \{\}\}/)
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

test('administrador V2 só delega carteira e permissões dentro do próprio alcance', () => {
  assert.match(workspaceFn, /function constrainInternalPermissions/)
  assert.match(workspaceFn, /hiddenExisting/)
  assert.match(workspaceFn, /requestedVisible/)
  assert.match(workspaceFn, /if \(!actorPermissions\[key\]\) next\[key\] = Boolean\(previous\[key\]\)/)
  assert.match(workspaceFn, /scopedAdminCannotManageTarget/)
  assert.match(workspaceFn, /Administradores com acesso limitado não podem criar acessos de parceiros/)
})

test('auditoria do admin V2 não expõe atividade operacional de terceiros', () => {
  assert.match(workspaceFn, /const scopedAdmin = isInternalV2Membership\(context\.selected\)/)
  assert.match(workspaceFn, /entry\.entity_type === 'member' \|\| String\(entry\.actor_user_id/)
})

test('navegação e financeiro respeitam o escopo de administrador V2', () => {
  assert.match(chrome, /const scopedAdmin = role === 'admin' && permissions\.access_v2 === true/)
  assert.match(chrome, /if \(allowed\('tasks'\)\) operation\.push\(common\.tasks\)/)
  assert.match(chrome, /hasAnyFinanceAccess\(access\)/)
  assert.match(financePatch, /const fullFinanceAdmin = role === 'admin' && !scopedAdmin/)
  assert.match(financePatch, /fullFinanceAdmin \|\| Boolean\(permissions\.finance_receivables/)
  assert.match(accessRoutesPatch, /access\?\.membership\?\.permissions\?\.access_v2 === true/)
})

test('patch legado de convites não sobrescreve o novo gestor de usuários', () => {
  assert.match(bridge, /MED_USER_ACCESS_V2/)
  assert.match(invitePatch, /MED_USER_ACCESS_V2/)
  assert.match(manager, /createWorkspaceInviteLink/)
})
