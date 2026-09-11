import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('menu lateral nao expõe Pendencias como modulo duplicado', () => {
  const source = read('src/components/AppChrome.jsx')
  assert.equal(source.includes("common.pending"), false)
  assert.match(source, /Visão geral'.*common\.myDay, common\.calendar/s)
  assert.match(source, /Gestão'.*Painel do Escritório/s)
})

test('Meu Dia possui somente Hoje, Pendencias e Proximos', () => {
  const source = read('src/components/OperationalCommandCenter.jsx')
  assert.match(source, /\['today', 'Hoje'\]/)
  assert.match(source, /\['pending', 'Pendências'\]/)
  assert.match(source, /\['upcoming', 'Próximos'\]/)
  assert.equal(source.includes("['metrics', 'Indicadores']"), false)
  assert.equal(source.includes("['ask', 'Consultar']"), false)
  assert.match(source, /WorkHorizonBoard/)
})

test('Painel do Escritorio e gerencial e nao executa conclusoes operacionais', () => {
  const source = read('src/components/Dashboard.jsx')
  assert.match(source, /MED_MANAGEMENT_DASHBOARD/)
  assert.equal(source.includes('useGoogleTasks('), false)
  assert.equal(source.includes('function completeItems'), false)
  assert.equal(source.includes('appendNextRecurringTask'), false)
  assert.match(source, /Saúde operacional/)
  assert.match(source, /Honorários e recebimentos/)
  assert.match(source, /Composição dos clientes/)
})

test('horizonte operacional suporta modo hoje e proximos sem duplicar telas', () => {
  const source = read('src/components/WorkHorizonBoard.jsx')
  assert.match(source, /mode === 'today'/)
  assert.match(source, /mode === 'upcoming'/)
  assert.match(source, /\['week', 'month'\]/)
  assert.match(source, /onShowPending/)
})

test('Meu Dia abre focado em tarefas processos e obrigacoes', () => {
  const board = read('src/components/WorkHorizonBoard.jsx')
  const view = read('src/lib/workBoardView.js')
  assert.match(board, /useState\('operation'\)/)
  assert.match(board, /\['operation', 'Operação'\]/)
  assert.match(board, /\['finance', 'Financeiro'\]/)
  assert.match(board, /Tarefas/)
  assert.match(board, /Processos/)
  assert.match(board, /Obrigações/)
  assert.match(board, /finance-option/)
  assert.match(view, /operationalTypes = \['task', 'process', 'obligation'\]/)
  assert.match(view, /type === 'operation'/)
})
