import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const file = path => readFileSync(path, 'utf8')

test('Acompanhamentos aparece no menu e no Meu Dia sem substituir tarefas ou processos', () => {
  const app = file('src/App.jsx')
  const menu = file('src/components/AppChrome.jsx')
  assert.match(menu, /followUps: item\('acompanhamentos'/)
  assert.match(app, /view === 'acompanhamentos' \? <FollowUpsWorkspace/)
  assert.match(app, /view === 'meu-dia' \? <FollowUpsToday/)
  assert.match(app, /view === 'processos' \? <Suspense/)
  assert.match(app, /view === 'tarefas' \?/)
})

test('conclusão de processo oferece acompanhamento opcional sem alterar sua conclusão', () => {
  const process = file('src/components/ProcessesReact.jsx')
  assert.match(process, /Quero lembrar de conferir o resultado deste processo/)
  assert.match(process, /followUpRequested && saved\.status === 'Concluído'/)
  assert.match(process, /const \{ followUpRequested, followUpDate, \.\.\.cleanProcess \} = process/)
  assert.match(process, /<FollowUpLinked records=\{followUps\?\.records\} sourceType="process"/)
})

test('serviço avulso oferece lembrete no fechamento e acesso ao resultado na edição', () => {
  const tasks = file('src/components/TasksReactBase.jsx')
  assert.match(tasks, /Quero lembrar de conferir o resultado deste serviço/)
  assert.match(tasks, /editing\.followUpRequested && isDone\(task\.status\)/)
  assert.match(tasks, /<FollowUpLinked records=\{followUps\?\.records\} sourceType="task"/)
})

test('cliente mostra acompanhamentos vinculados e formulário permite assunto interno', () => {
  const clients = file('src/components/ClientsReact.jsx')
  const module = file('src/components/FollowUpsWorkspace.jsx')
  assert.match(clients, /<FollowUpLinked records=\{followUps\?\.records\} clientId=\{client\.id\}/)
  assert.match(module, /Sem cliente vinculado/)
  assert.match(module, /Ainda sem resultado/)
  assert.match(module, /Resultado confirmado/)
  assert.match(module, /Reabrir acompanhamento/)
  assert.match(module, /Excluir definitivamente o acompanhamento/)
})

test('servidor é a fonte da verdade; dados não dependem do armazenamento local', () => {
  const hook = file('src/hooks/useFollowUps.js')
  assert.match(hook, /invokeEdgeJson\('office-follow-ups'/)
  assert.doesNotMatch(hook, /localStorage\.setItem|sessionStorage\.setItem/)
  assert.match(file('src/components/FollowUpsWorkspace.jsx'), /row\.status === 'active'/)
})
