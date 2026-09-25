import { today, uid } from './storage.js'
import { initializeProcessPlanning } from './processPlanning.js'

const text = value => String(value || '').trim()

function addCalendarDays(value, amount = 0) {
  const base = value || today()
  const next = new Date(`${base}T00:00:00`)
  next.setDate(next.getDate() + Number(amount || 0))
  return today(next)
}

export function clientServiceKey(type, id) {
  return `${type}:${String(id || '')}`
}

export function createTaskFromClientTemplate(model = {}, client = {}, { baseDate = today(), makeId = uid, now = () => new Date().toISOString() } = {}) {
  const start = client.dataEntrada || baseDate
  return {
    id: makeId('tar'),
    templateId: String(model.id || ''),
    titulo: text(model.titulo) || 'Serviço',
    descricao: text(model.descricao),
    clientId: String(client.id || ''),
    departamento: text(model.departamento),
    responsavel: '',
    prazo: addCalendarDays(start, model.diasPrazo),
    prioridade: model.prioridade || 'Normal',
    status: 'Pendente',
    recorrencia: model.recorrencia || '',
    usaCompetencia: !!model.usaCompetencia,
    competencia: '',
    competenciaAvancoAutomatico: model.competenciaAvancoAutomatico !== false,
    subtarefas: (model.subtarefas || []).map(item => ({
      id: makeId('sub'),
      titulo: text(item?.titulo || item?.nome || item),
      concluida: false,
    })).filter(item => item.titulo),
    updatedAt: now(),
  }
}

export function createProcessFromClientModel(model = {}, client = {}, { baseDate = today(), makeId = uid } = {}) {
  const openedAt = client.dataEntrada || baseDate
  const steps = (model.etapas || [])
    .filter(step => step?.opcional !== true)
    .map((step, index) => ({
      id: makeId('et'),
      nome: text(step?.nome),
      opcional: false,
      ativa: true,
      status: 'Pendente',
      ordem: index,
      responsavelTipo: step?.responsavelTipo || 'interno',
      prazoDias: Math.max(0, Number(step?.prazoDias) || 0),
      followupDias: Math.max(1, Number(step?.followupDias) || 3),
      prazoEtapa: '',
      proximaRevisao: '',
      aguardandoDesde: '',
      aguardandoEm: '',
      concluidoEm: '',
      ativadaEm: '',
    }))
    .filter(step => step.nome)

  const process = {
    id: makeId('proc'),
    clientId: String(client.id || ''),
    relacionados: [],
    modeloId: String(model.id || ''),
    tipo: text(model.nome) || 'Processo',
    origem: 'Cadastro do cliente',
    dataAbertura: openedAt,
    prazoFinal: '',
    previsaoConclusao: '',
    previsaoConclusaoInicial: '',
    status: 'Novo',
    drive: text(client.drive),
    observacoes: text(model.descricao),
    etapas: steps,
    etapaAtual: 0,
    dataConclusao: '',
    protocolos: [],
  }
  return initializeProcessPlanning(process, openedAt)
}

export function createInitialClientServices({
  client = {},
  selectedKeys = [],
  taskTemplates = [],
  processModels = [],
  baseDate = today(),
  makeId = uid,
  now = () => new Date().toISOString(),
} = {}) {
  const selected = new Set(selectedKeys || [])
  const tasks = (taskTemplates || [])
    .filter(model => selected.has(clientServiceKey('task', model.id)))
    .map(model => createTaskFromClientTemplate(model, client, { baseDate, makeId, now }))
  const processes = (processModels || [])
    .filter(model => selected.has(clientServiceKey('process', model.id)))
    .map(model => createProcessFromClientModel(model, client, { baseDate, makeId }))
  return { tasks, processes }
}
