import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clientDependencies, clientHasEmbeddedHistory } from '../supabase/functions/office-client-delete/dependencies.mjs'
import { applyClientDeletionPatch } from '../scripts/patch-client-deletion.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const ID = 'cli_exemplo123'

test('cadastro sem vínculos não apresenta bloqueios', () => {
  assert.deepEqual(clientDependencies({ med_clientes: [{ id: ID, razao: 'Teste' }], med_tarefas: [], med_obrigacoes: [] }, ID), [])
  assert.equal(clientHasEmbeddedHistory({ comunicacoes: [], honorariosHistorico: [] }), false)
})

test('bloqueia referências em tarefas, obrigações compartilhadas, financeiro, empresas vinculadas e histórico', () => {
  const blockers = clientDependencies({
    med_clientes: [{ id: ID }],
    med_tarefas: [{ id: 't1', clientId: ID }],
    med_obrigacoes: [{ id: 'o1', clientes: [{ clienteId: 'outro' }, { clienteId: ID }] }],
    med_financeiro: [{ id: 'f1', clienteId: ID, pagamentos: [{ valor: 10 }] }],
    med_cnpjs_vinculados: [{ id: 'v1', clienteId: ID }],
    med_historico_painel: [{ details: { clienteId: ID } }],
  }, ID)
  assert.equal(blockers.length, 5)
  assert.deepEqual(blockers.map(blocker => blocker.count), [1, 1, 1, 1, 1])
})

test('identificador parecido não bloqueia outro cliente e histórico próprio bloqueia', () => {
  assert.deepEqual(clientDependencies({ med_tarefas: [{ clientId: ID + 'outro' }] }, ID), [])
  assert.equal(clientHasEmbeddedHistory({ comunicacoes: [{ data: '2026-09-01' }] }), true)
  assert.equal(clientHasEmbeddedHistory({ honorariosHistorico: [{ valor: 250 }] }), true)
})

test('patch da interface mantém código original e é idempotente', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'med-client-delete-'))
  try {
    mkdirSync(resolve(temporary, 'src/components'), { recursive: true })
    const paths = ['src/App.jsx', 'src/components/ClientsReact.jsx']
    for (const path of paths) writeFileSync(resolve(temporary, path), readFileSync(resolve(ROOT, path)))
    applyClientDeletionPatch(temporary)
    const first = paths.map(path => readFileSync(resolve(temporary, path), 'utf8'))
    assert.match(first[0], /refreshWorkspace=\{refreshWorkspace\}/)
    assert.match(first[1], /Excluir definitivamente/)
    assert.match(first[1], /clientDependencies\(office, id\)/)
    applyClientDeletionPatch(temporary)
    assert.deepEqual(paths.map(path => readFileSync(resolve(temporary, path), 'utf8')), first)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})
