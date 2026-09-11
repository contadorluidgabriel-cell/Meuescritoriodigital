import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('gerar outro link de equipe nao invalida convites anteriores por padrao', () => {
  const client = read('src/lib/inviteLinks.js')
  const edge = read('supabase/functions/office-invite-links/index.ts')
  const destructiveDelete = "await service.from('office_invite_links').delete().eq('member_id', member.id).is('used_at', null)"

  assert.match(client, /\{ replace = false \}/)
  assert.match(client, /replace: Boolean\(replace\)/)
  assert.match(edge, /const replace = body\.replace === true/)
  assert.match(edge, /if \(replace\) await service\.from\('office_invite_links'\)\.delete\(\)\.eq\('member_id', member\.id\)\.is\('used_at', null\)/)
  assert.equal(edge.split(destructiveDelete).length - 1, 1)
})

test('equipe diferencia gerar outro link de substituir links', () => {
  const patch = read('scripts/patch-invite-links.mjs')

  assert.match(patch, /replaceInviteLinks/)
  assert.match(patch, /generateInviteLink\(member, \{ replace: true \}\)/)
  assert.match(patch, /Gerar outro link/)
  assert.match(patch, /Substituir links/)
  assert.match(patch, /Gerar outro link não invalida este/)
})

test('convite indisponivel explica que o link pode ter sido substituido', () => {
  const edge = read('supabase/functions/office-invite-links/index.ts')
  assert.match(edge, /Ele pode ter sido substituído pelo administrador/)
  assert.match(edge, /Este link de convite já foi utilizado/)
  assert.match(edge, /Este link de convite expirou/)
})
