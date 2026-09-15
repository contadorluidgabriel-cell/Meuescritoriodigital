import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const partnersPanel = readFileSync(new URL('../src/components/PartnersPanel.jsx', import.meta.url), 'utf8')
const sharingPatch = readFileSync(new URL('../scripts/patch-client-sharing.mjs', import.meta.url), 'utf8')
const distributionPatch = readFileSync(new URL('../scripts/patch-responsibility-distribution-v2.mjs', import.meta.url), 'utf8')
const workspaceFn = readFileSync(new URL('../supabase/functions/office-workspace/index.ts', import.meta.url), 'utf8')
const accessLegacy = readFileSync(new URL('../supabase/functions/office-workspace/accessLegacy.js', import.meta.url), 'utf8')

test('área de parceiros gerencia vários usuários vinculados à mesma parceria', () => {
  assert.match(partnersPanel, /listWorkspaceMembers/)
  assert.match(partnersPanel, /updateWorkspaceMember/)
  assert.match(partnersPanel, /membersByPartner/)
  assert.match(partnersPanel, /Usuários vinculados/)
  assert.match(partnersPanel, /partner_id: editing\.id/)
  assert.match(partnersPanel, /Um parceiro pode ter vários usuários/)
})

test('vínculo de usuário parceiro continua protegido pelo backend do workspace', () => {
  assert.match(workspaceFn, /const partnerId = role === ROLE_PARTNER/)
  assert.match(workspaceFn, /partner_id: partnerId \|\| null/)
  assert.match(workspaceFn, /Administradores com acesso limitado não podem configurar acessos de parceiros/)
})

test('usuário vinculado herda somente o escopo operacional da parceria', () => {
  assert.match(accessLegacy, /const partnerId = String\(membership\.partner_id \|\| ''\)/)
  assert.match(accessLegacy, /allowedClients = clients\.filter\(client => clientPartnerIds\(client\)\.includes\(partnerId\)\)/)
  assert.match(accessLegacy, /partnerCanAccessWork/)
})

test('painel de parceiros recebe o contexto de acesso do workspace', () => {
  assert.match(sharingPatch, /<PartnersPanel office=\{office\} update=\{update\} access=\{access\} onRefresh=\{onRefresh\} \/>/)
})

test('desativação de usuário parceiro não entra no desligamento interno', () => {
  assert.match(distributionPatch, /selected\.role === 'partner'/)
  assert.match(distributionPatch, /Acesso do usuário parceiro desativado/)
  assert.match(distributionPatch, /As responsabilidades continuam vinculadas à parceria/)
  assert.match(distributionPatch, /Usuários parceiros recebem atividades pelo vínculo da parceria correspondente/)
})
