import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizedSharedClientFields, sharedClientError } from '../src/lib/sharedWork.js'

test('cadastro PF não coleta data de nascimento', () => {
  const ui = readFileSync('src/components/ClientsReact.jsx', 'utf8')
  assert.match(ui, /MED_PF_CLIENT_FORM_V2/)
  assert.doesNotMatch(ui, /Data de nascimento/)
  assert.doesNotMatch(ui, /dataNascimento/)
})

test('PF pode ser atendimento direto ou compartilhado e mantém parceiro ao salvar', () => {
  const ui = readFileSync('src/components/ClientsReact.jsx', 'utf8')
  assert.match(ui, /label="Forma de atendimento"/)
  assert.match(ui, /editing\.tipo === 'PJ' \? <option value="Terceirizador">Terceirizador<\/option> : null/)
  assert.match(ui, /<option value="Compartilhado">Compartilhado<\/option>/)
  assert.match(ui, /<SharedClientFields editing=\{editing\} setField=\{setField\} office=\{office\} \/>/)
  assert.match(ui, /client\.tipo === 'PF'.*mensalidade: 0, vencimento: null \}\)/s)
  assert.doesNotMatch(ui, /client\.tipo === 'PF'.*perfilAtendimento: 'Direto'.*parceiroIds: \[\]/s)
})

test('PF compartilhado avulso exige parceiro e não exige divisão mensal', () => {
  const office = { partners: [{ id: 'par-1', nome: 'Parceiro', status: 'Ativo' }] }
  const valid = {
    tipo: 'PF',
    relacionamento: 'Avulso',
    perfilAtendimento: 'Compartilhado',
    parceiroIds: ['par-1'],
    parceiroId: 'par-1',
    mensalidade: 0,
  }
  assert.equal(sharedClientError(valid, office), '')
  assert.deepEqual(normalizedSharedClientFields(valid).parceiroIds, ['par-1'])
  assert.match(sharedClientError({ ...valid, parceiroIds: [], parceiroId: '' }, office), /Selecione pelo menos um parceiro/)
})

test('data e motivo de saída aparecem somente quando o cliente está Inativo e são manuais', () => {
  const ui = readFileSync('src/components/ClientsReact.jsx', 'utf8')
  assert.match(ui, /editing\.status === 'Inativo' \? <>.*label="Data de saída".*label="Motivo da saída"/s)
  assert.match(ui, /value=\{editing\.dataSaida\} onChange=\{event => setField\('dataSaida', event\.target\.value\)\}/)
  assert.doesNotMatch(ui, /setField\('dataSaida', today\(\)\)/)
  assert.doesNotMatch(ui, /dataSaida: today\(\)/)
})
