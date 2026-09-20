import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { clientDependencies, clientHasEmbeddedHistory } from '../supabase/functions/office-client-delete/dependencies.mjs'

const file = fileURLToPath(new URL('../supabase/functions/office-client-delete/index.ts', import.meta.url))
const ID = 'cli_registroteste'
const USER = 'user_teste'
const WORKSPACE = '00000000-0000-0000-0000-000000000001'

// Executa o MESMO handler TypeScript implantado com transporte e Supabase simulados.
// Nenhum teste deste arquivo se conecta à base real ou exclui cadastros de clientes.
function harness(options = {}) {
  const state = {
    payload: structuredClone(options.payload || { med_clientes: [{ id: ID, razao: 'Cadastro de teste' }, { id: 'cli_preservar', razao: 'Outro cadastro' }], med_tarefas: [], med_financeiro: [] }),
    version: 1,
    audits: [],
    conflicts: options.conflicts || 0,
  }
  const member = { role: options.role || 'admin', status: 'active', user_id: USER, permissions: options.permissions ?? { clients: true, manage_clients: true, delete_records: true } }
  const workspace = { id: WORKSPACE, owner_user_id: options.owner === false ? 'outro_user' : USER }
  const assigned = options.assigned || []
  const service = {
    auth: { async getUser(token) { return token === 'valid-token' ? { data: { user: { id: USER, email: 'teste@example.invalid' } }, error: null } : { data: { user: null }, error: { message: 'Invalid token' } } } },
    from(table) {
      const q = {
        filters: [], changes: null,
        select() { return this },
        eq(key, value) { this.filters.push([key, value]); return this },
        in(key, values) { this.filters.push([key, values]); return Promise.resolve({ data: assigned, error: null }) },
        update(data) { this.changes = data; return this },
        insert(entry) { state.audits.push(entry); return Promise.resolve({ error: null }) },
        async single() { return table === 'office_workspace_snapshots' ? { data: { payload: structuredClone(state.payload), version: state.version }, error: null } : { data: null, error: { message: 'not found' } } },
        async maybeSingle() {
          if (table === 'office_members') return { data: member.status === 'active' ? member : null, error: null }
          if (table === 'office_workspaces') return { data: workspace, error: null }
          if (table === 'office_workspace_snapshots' && this.changes) {
            if (state.conflicts > 0) { state.conflicts--; return { data: null, error: null } }
            const expected = this.filters.find(([key]) => key === 'version')?.[1]
            if (expected !== state.version) return { data: null, error: null }
            state.payload = structuredClone(this.changes.payload)
            state.version = this.changes.version
            return { data: { version: state.version }, error: null }
          }
          return { data: null, error: null }
        },
      }
      return q
    },
  }
  let handler
  const script = readFileSync(file, 'utf8')
    .replace(/^import \{ createClient \} from .*\n/m, '')
    .replace(/^import \{ clientDependencies, clientHasEmbeddedHistory \} from .*\n/m, '')
    .replace('const reply = (body: unknown, status = 200)', 'const reply = (body, status = 200)')
    .replace('(request: Request)', '(request)')
    .replace('let body: Record<string, unknown>', 'let body')
    .replaceAll('(item: Record<string, unknown>)', '(item)')
    .replaceAll('(item: any)', '(item)')
  runInNewContext(script, {
    Deno: { env: { get: key => key === 'SUPABASE_URL' ? 'https://example.invalid' : 'test-secret' }, serve: fn => { handler = fn } },
    createClient: () => service,
    clientDependencies, clientHasEmbeddedHistory, Response, JSON, Date, console,
  }, { filename: 'office-client-delete/index.ts' })
  assert.equal(typeof handler, 'function')
  async function call(token = 'valid-token', confirmation = 'EXCLUIR', clientId = ID) {
    const headers = { 'content-type': 'application/json' }
    if (token) headers.authorization = `Bearer ${token}`
    const response = await handler(new Request('https://example.invalid/functions/v1/office-client-delete', {
      method: 'POST', headers, body: JSON.stringify({ workspace_id: WORKSPACE, client_id: clientId, confirmation }),
    }))
    return { status: response.status, body: await response.json() }
  }
  return { state, call }
}

test('handler rejeita solicitações sem sessão e com token inválido', async () => {
  const app = harness()
  assert.equal((await app.call('')).status, 401)
  assert.equal((await app.call('invalid-token')).status, 401)
  assert.equal(app.state.version, 1)
})

test('handler recusa confirmação diferente de EXCLUIR', async () => {
  const app = harness()
  assert.equal((await app.call('valid-token', 'excluir')).status, 400)
  assert.equal(app.state.version, 1)
})

test('handler impede colaborador e administrador sem autorização', async () => {
  const collaborator = harness({ owner: false, role: 'collaborator' })
  const admin = harness({ owner: false, permissions: { clients: true, manage_clients: true, delete_records: false } })
  assert.equal((await collaborator.call()).status, 403)
  assert.equal((await admin.call()).status, 403)
  assert.equal(collaborator.state.version, 1)
  assert.equal(admin.state.version, 1)
})

test('handler impede excluir cadastro vinculado e protege os outros módulos', async () => {
  const app = harness({ payload: {
    med_clientes: [{ id: ID }, { id: 'cli_preservar' }],
    med_tarefas: [{ id: 'tar_01', clientId: ID }],
    med_financeiro: [{ id: 'fin_01', clienteId: ID }],
  } })
  const result = await app.call()
  assert.equal(result.status, 409)
  assert.equal(result.body.dependencies.length, 2)
  assert.equal(app.state.payload.med_clientes.length, 2)
  assert.equal(app.state.payload.med_tarefas.length, 1)
  assert.equal(app.state.audits.length, 0)
})

test('handler bloqueia cadastro presente nas permissões de outro usuário', async () => {
  const app = harness({ assigned: [{ id: 'member_02', permissions: { client_ids: [ID] } }] })
  const result = await app.call()
  assert.equal(result.status, 409)
  assert.equal(app.state.payload.med_clientes.length, 2)
})

test('handler exclui somente cadastro livre, mantém os demais e audita', async () => {
  const app = harness()
  const result = await app.call()
  assert.equal(result.status, 200)
  assert.equal(result.body.ok, true)
  assert.equal(result.body.client_id, ID)
  assert.deepEqual(app.state.payload.med_clientes.map(client => client.id), ['cli_preservar'])
  assert.equal(app.state.version, 2)
  assert.equal(app.state.audits.length, 1)
  assert.equal(app.state.audits[0].entity_id, ID)
  assert.equal((await app.call()).status, 404)
})

test('handler tenta novamente após conflito otimista e evita remoção concorrente', async () => {
  const app = harness({ conflicts: 1 })
  assert.equal((await app.call()).status, 200)
  assert.equal(app.state.version, 2)
  assert.equal(app.state.audits.length, 1)
})
