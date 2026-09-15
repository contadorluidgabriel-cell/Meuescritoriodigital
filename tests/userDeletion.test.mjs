import test from 'node:test'
import assert from 'node:assert/strict'
import { assignmentBlockMessage, assignmentSummary } from '../supabase/functions/office-user-admin/policy.js'
import { readFileSync } from 'node:fs'

test('bloqueia exclusão quando usuário ainda possui responsabilidades ativas', () => {
  const payload = {
    med_clientes: [
      { id: 'c1', responsavelPrincipalUserId: 'u1' },
      { id: 'c2', responsavelPrincipalUserId: 'u2' },
    ],
    med_tarefas: [
      { id: 't1', responsavelUserId: 'u1', status: 'Pendente' },
      { id: 't2', responsavelUserId: 'u1', status: 'Concluída' },
    ],
    med_processos: [
      { id: 'p1', responsavelUserId: 'u1', status: 'Em andamento' },
      { id: 'p2', responsavelUserId: 'u1', status: 'Cancelado' },
    ],
    med_obrigacoes: [
      { id: 'o1', clientes: [
        { clienteId: 'c1', responsavelUserId: 'u1', status: 'Pendente' },
        { clienteId: 'c2', responsavelUserId: 'u1', status: 'Não se aplica' },
      ] },
    ],
  }
  const summary = assignmentSummary(payload, 'u1')
  assert.deepEqual(summary, { clients: 1, tasks: 1, processes: 1, obligations: 1, total: 4 })
  assert.match(assignmentBlockMessage(summary), /redistribua/i)
})

test('libera exclusão quando não existem responsabilidades ativas', () => {
  const payload = {
    med_clientes: [],
    med_tarefas: [{ id: 't1', responsavelUserId: 'u1', status: 'Concluída' }],
    med_processos: [{ id: 'p1', responsavelUserId: 'u1', status: 'Cancelado' }],
    med_obrigacoes: [{ id: 'o1', clientes: [{ responsavelUserId: 'u1', status: 'Não se aplica' }] }],
  }
  const summary = assignmentSummary(payload, 'u1')
  assert.equal(summary.total, 0)
  assert.equal(assignmentBlockMessage(summary), '')
})

test('interface pós-patch exige usuário desativado e confirmação EXCLUIR', () => {
  const source = readFileSync(new URL('../src/components/UserAccessManager.jsx', import.meta.url), 'utf8')
  const sync = readFileSync(new URL('../src/lib/workspaceSync.js', import.meta.url), 'utf8')
  assert.match(source, /Excluir definitivamente/)
  assert.match(source, /member\.status !== 'disabled'/)
  assert.match(source, /confirmation !== 'EXCLUIR'/)
  assert.match(sync, /office-user-admin/)
  assert.match(sync, /deleteWorkspaceUser/)
})

test('backend da exclusão definitiva mantém proteções de proprietário e vínculos externos', () => {
  const source = readFileSync(new URL('../supabase/functions/office-user-admin/index.ts', import.meta.url), 'utf8')
  assert.match(source, /Somente o proprietário do escritório/)
  assert.match(source, /member\.status !== 'disabled'/)
  assert.match(source, /assignmentSummary/)
  assert.match(source, /other_memberships/)
  assert.match(source, /auth\.admin\.deleteUser/)
})
