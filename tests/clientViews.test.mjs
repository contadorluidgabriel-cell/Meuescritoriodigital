import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ui = () => readFileSync('src/components/ClientsReact.jsx', 'utf8')

test('Clientes possui quatro visões operacionais sem separar a base de dados', () => {
  const source = ui()
  assert.match(source, /MED_CLIENT_VIEWS_V1/)
  assert.match(source, /\['recurring', 'Recorrentes'\]/)
  assert.match(source, /\['oneoff', 'Avulsos'\]/)
  assert.match(source, /\['person', 'Pessoa Física'\]/)
  assert.match(source, /\['inactive', 'Inativos'\]/)
  assert.match(source, /office\.clients\.filter/)
  assert.match(source, /clientViewOf\(client\) === clientView/)
})

test('classificação prioriza inativo, depois pessoa física e só então relacionamento PJ', () => {
  const source = ui()
  const inactive = source.indexOf("client?.status === 'Inativo'")
  const person = source.indexOf("documentType(client?.documento, client?.tipo) === 'PF'")
  const oneoff = source.indexOf("client?.relacionamento === 'Avulso'")
  assert.ok(inactive >= 0 && person > inactive && oneoff > person)
})

test('visão padrão é Recorrentes e salvar redireciona para a classificação do cliente', () => {
  const source = ui()
  assert.match(source, /useState\('recurring'\)/)
  assert.match(source, /setClientView\(clientViewOf\(client\)\)/)
})

test('filtros antigos de status e relacionamento são substituídos pelas abas e a busca permanece', () => {
  const source = ui()
  assert.match(source, /role="tablist" aria-label="Visões de clientes"/)
  assert.match(source, /Buscar nesta visão por nome, CPF\/CNPJ ou ID/)
  assert.doesNotMatch(source, /Ativos e inativos<\/option>/)
  assert.doesNotMatch(source, /Recorrentes e avulsos<\/option>/)
})

test('estilos das visões carregam contadores e estado ativo', () => {
  const css = readFileSync('src/clients-react.css', 'utf8')
  assert.match(css, /MED_CLIENT_VIEWS_V1/)
  assert.match(css, /client-view-tabs/)
  assert.match(css, /button\.active b/)
})
