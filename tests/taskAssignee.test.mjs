import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('formulario de tarefa usa seletor de usuarios do workspace', () => {
  const source = read('src/components/TasksReactBase.jsx')
  assert.match(source, /TaskAssigneeSelect/)
  assert.match(source, /responsavelUserId/)
  assert.match(source, /Selecione o responsável da tarefa/)
  assert.doesNotMatch(source, /<Field label="Responsável"><input value=\{editing\.responsavel\}/)
})

test('nova tarefa inicia atribuida ao usuario atual', () => {
  const source = read('src/components/TasksReactBase.jsx')
  assert.match(source, /responsavelUserId: currentTaskUserId/)
  assert.match(source, /responsavel: currentTaskUserName/)
})

test('seletor lista somente usuarios internos ativos e usa user_id como chave', () => {
  const source = read('src/components/TaskAssigneeSelect.jsx')
  assert.match(source, /member\?\.status === 'active'/)
  assert.match(source, /member\?\.role !== 'partner'/)
  assert.match(source, /String\(member\.user_id\)/)
})
