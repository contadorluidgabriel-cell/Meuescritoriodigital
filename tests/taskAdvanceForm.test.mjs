import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const patch = readFileSync(new URL('../scripts/patch-task-deadlines.mjs', import.meta.url), 'utf8')

test('formulário de tarefa recebe antecedência do Meu Dia', () => {
  assert.match(patch, /Antecedência no Meu Dia/)
  assert.match(patch, /antecedenciaDias: 0/)
  assert.match(patch, /antecedenciaDias: editing\.prazo \? Math\.max/)
  assert.match(patch, /disabled=!\{?editing\.prazo|disabled=\{!editing\.prazo\}/)
  assert.match(patch, /5 dias antes/)
  assert.match(patch, /a tarefa aparece no Meu Dia até ser concluída/)
})
