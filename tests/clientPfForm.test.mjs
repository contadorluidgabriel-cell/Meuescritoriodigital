import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { clientServiceKey, createInitialClientServices } from '../src/lib/clientServices.js'

const makeId = (() => {
  const counters = new Map()
  return prefix => {
    const next = (counters.get(prefix) || 0) + 1
    counters.set(prefix, next)
    return `${prefix}-${next}`
  }
})()

test('selecionar modelos não cria serviços sem ação explícita no formulário PF', () => {
  const ui = readFileSync('src/components/ClientsReact.jsx', 'utf8')
  assert.match(ui, /^\/\/ MED_PF_CLIENT_FORM_V1$/m)
  assert.doesNotMatch(ui, /^MED_PF_CLIENT_FORM_V1$/m)
  assert.match(ui, /event\.nativeEvent\?\.submitter\?\.value === 'save-create-services'/)
  assert.match(ui, /value="save"[^>]*>Salvar cliente/)
  assert.match(ui, /value="save-create-services"[^>]*>Salvar e criar serviços/)
  assert.match(ui, /Nada será criado até você usar “Salvar e criar serviços”/)
})

test('formulário PF oculta dados empresariais e mantém cadastro enxuto', () => {
  const ui = readFileSync('src/components/ClientsReact.jsx', 'utf8')
  assert.match(ui, /editing\.tipo === 'PF' \? 'Nome completo \*' : 'Razão Social \*'/)
  assert.doesNotMatch(ui, /Data de nascimento/)
  assert.match(ui, /editing\.tipo === 'PJ' \? <>.*label="Tributação"/s)
  assert.match(ui, /editing\.tipo === 'PJ' \? <>.*label="Mensalidade"/s)
  assert.match(ui, /editing\.tipo === 'PF' \? <Field label="Serviços contratados"/)
  assert.match(ui, /client\.tipo === 'PF'.*relacionamento: 'Avulso'.*mensalidade: 0/s)
})

test('criação manual gera uma tarefa e um processo a partir dos modelos selecionados', () => {
  const client = { id: 'cli-1', dataEntrada: '2026-09-25', drive: 'https://drive.google.com/example' }
  const taskTemplates = [{
    id: 'task-model-1',
    titulo: 'IRPF',
    departamento: 'Fiscal',
    diasPrazo: 3,
    prioridade: 'Alta',
    descricao: 'Preparar declaração',
    subtarefas: ['Documentos', 'Transmitir'],
  }]
  const processModels = [{
    id: 'process-model-1',
    nome: 'Abertura de CNPJ',
    descricao: 'Constituição empresarial',
    etapas: [
      { id: 'm1', nome: 'Coleta de documentos', responsavelTipo: 'interno', prazoDias: 2, followupDias: 3 },
      { id: 'm2', nome: 'Etapa opcional', opcional: true, responsavelTipo: 'interno', prazoDias: 1, followupDias: 3 },
    ],
  }]

  const created = createInitialClientServices({
    client,
    selectedKeys: [clientServiceKey('task', 'task-model-1'), clientServiceKey('process', 'process-model-1')],
    taskTemplates,
    processModels,
    baseDate: '2026-09-25',
    makeId,
    now: () => '2026-09-25T12:00:00.000Z',
  })

  assert.equal(created.tasks.length, 1)
  assert.equal(created.tasks[0].clientId, 'cli-1')
  assert.equal(created.tasks[0].titulo, 'IRPF')
  assert.equal(created.tasks[0].prazo, '2026-09-28')
  assert.equal(created.tasks[0].subtarefas.length, 2)

  assert.equal(created.processes.length, 1)
  assert.equal(created.processes[0].clientId, 'cli-1')
  assert.equal(created.processes[0].modeloId, 'process-model-1')
  assert.equal(created.processes[0].tipo, 'Abertura de CNPJ')
  assert.equal(created.processes[0].status, 'Em andamento')
  assert.equal(created.processes[0].etapas.length, 1)
  assert.equal(created.processes[0].etapas[0].nome, 'Coleta de documentos')
  assert.equal(created.processes[0].etapas[0].ativadaEm, '2026-09-25')
  assert.equal(created.processes[0].etapas[0].prazoEtapa, '2026-09-29')
})

test('apenas os modelos marcados são criados', () => {
  const created = createInitialClientServices({
    client: { id: 'cli-2', dataEntrada: '2026-09-25' },
    selectedKeys: [clientServiceKey('task', 'a')],
    taskTemplates: [
      { id: 'a', titulo: 'Selecionada' },
      { id: 'b', titulo: 'Não selecionada' },
    ],
    processModels: [{ id: 'p', nome: 'Não selecionado', etapas: [] }],
    baseDate: '2026-09-25',
    makeId: prefix => `${prefix}-x`,
    now: () => '2026-09-25T12:00:00.000Z',
  })
  assert.deepEqual(created.tasks.map(item => item.titulo), ['Selecionada'])
  assert.equal(created.processes.length, 0)
})
