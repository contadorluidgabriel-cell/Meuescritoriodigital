import { isDone, today } from './storage.js'

const clone = value => value == null ? value : structuredClone(value)
const pad = value => String(value).padStart(2, '0')
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

export const PROCESS_DEPENDENCIES = {
  interno: { id: 'interno', label: 'Escritório', status: 'Em andamento' },
  cliente: { id: 'cliente', label: 'Cliente', status: 'Aguardando cliente' },
  orgao: { id: 'orgao', label: 'Órgão', status: 'Aguardando órgão' },
  terceiro: { id: 'terceiro', label: 'Terceiro', status: 'Aguardando terceiro' },
}

export const PROCESS_STEP_STATUSES = [
  'Pendente',
  'Em andamento',
  'Aguardando cliente',
  'Aguardando órgão',
  'Aguardando terceiro',
  'Em análise',
  'Em exigência',
  'Concluída',
  'Não se aplica',
]

const PROCESS_STEP_STATUS_BY_NORMALIZED = new Map(PROCESS_STEP_STATUSES.map(status => [normalize(status), status]))

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
}

function ymd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function addBusinessDays(value, amount = 0) {
  const date = parseDate(value)
  if (!date) return ''
  let remaining = Math.max(0, Math.trunc(Number(amount) || 0))
  while (remaining > 0) {
    date.setDate(date.getDate() + 1)
    const weekday = date.getDay()
    if (weekday !== 0 && weekday !== 6) remaining -= 1
  }
  return ymd(date)
}

export function normalizeProcessDependency(value) {
  const normalized = normalize(value)
  if (normalized === 'cliente') return 'cliente'
  if (normalized === 'orgao' || normalized === 'externo') return 'orgao'
  if (normalized === 'terceiro') return 'terceiro'
  return 'interno'
}

export function normalizeProcessStepStatus(value) {
  const normalized = normalize(value)
  if (PROCESS_STEP_STATUS_BY_NORMALIZED.has(normalized)) return PROCESS_STEP_STATUS_BY_NORMALIZED.get(normalized)
  if (normalized === 'concluido' || normalized === 'concluida') return 'Concluída'
  if (normalized === 'nao aplicavel' || normalized === 'n/a') return 'Não se aplica'
  return 'Pendente'
}

export function processStepSettled(value) {
  const status = typeof value === 'object' ? value?.status : value
  const normalized = normalizeProcessStepStatus(status)
  return normalized === 'Concluída' || normalized === 'Não se aplica'
}

function waitingDependencyFromStatus(status) {
  const normalized = normalizeProcessStepStatus(status)
  if (normalized === 'Aguardando cliente') return 'cliente'
  if (normalized === 'Aguardando órgão') return 'orgao'
  if (normalized === 'Aguardando terceiro') return 'terceiro'
  return ''
}

export function processStepStatusLabel(step = {}) {
  const status = normalizeProcessStepStatus(step.status)
  const target = String(step.aguardandoEm || '').trim()
  if (target && status.startsWith('Aguardando ')) return `Aguardando ${target}`
  return status
}

function processStatusFromStep(step = {}) {
  const status = normalizeProcessStepStatus(step.status)
  if (status === 'Pendente') {
    const dependency = normalizeProcessDependency(step.responsavelTipo)
    return PROCESS_DEPENDENCIES[dependency]?.status || 'Em andamento'
  }
  if (status === 'Concluída' || status === 'Não se aplica') return 'Em andamento'
  return status
}

export function orderedProcessSteps(process = {}) {
  return [...(process.etapas || [])].filter(step => step.ativa !== false).sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
}

export function currentProcessStep(process = {}) {
  const steps = orderedProcessSteps(process)
  if (!steps.length) return { step: null, index: -1, steps, allDone: false }
  const requested = Math.max(0, Math.min(Number(process.etapaAtual || 0), steps.length - 1))
  if (!processStepSettled(steps[requested])) return { step: steps[requested], index: requested, steps, allDone: false }
  const after = steps.findIndex((step, index) => index > requested && !processStepSettled(step))
  if (after >= 0) return { step: steps[after], index: after, steps, allDone: false }
  const firstPending = steps.findIndex(step => !processStepSettled(step))
  if (firstPending >= 0) return { step: steps[firstPending], index: firstPending, steps, allDone: false }
  return { step: null, index: -1, steps, allDone: true }
}

export function initializeProcessStep(step = {}, baseDate = today()) {
  const next = { ...clone(step) }
  next.status = normalizeProcessStepStatus(next.status)
  if (processStepSettled(next)) return next

  const statusDependency = waitingDependencyFromStatus(next.status)
  const dependency = statusDependency || normalizeProcessDependency(next.responsavelTipo)
  next.responsavelTipo = dependency
  next.ativadaEm ||= baseDate
  const prazoDias = Math.max(0, Math.trunc(Number(next.prazoDias) || 0))
  const followupDias = Math.max(0, Math.trunc(Number(next.followupDias) || 0))
  if (!next.prazoEtapa && prazoDias) next.prazoEtapa = addBusinessDays(baseDate, prazoDias)
  if (dependency !== 'interno') {
    next.aguardandoDesde ||= baseDate
    if (!next.proximaRevisao && followupDias) next.proximaRevisao = addBusinessDays(baseDate, followupDias)
  }
  return next
}

export function initializeProcessPlanning(process = {}, baseDate = today()) {
  const next = clone(process) || {}
  if (next.previsaoConclusao && !next.previsaoConclusaoInicial) next.previsaoConclusaoInicial = next.previsaoConclusao
  const { step, index, steps } = currentProcessStep(next)
  if (!step || index < 0) return next
  const initialized = initializeProcessStep(step, baseDate)
  next.etapas = (next.etapas || []).map(item => String(item.id) === String(step.id) ? initialized : item)
  next.etapaAtual = Math.max(0, steps.findIndex(item => String(item.id) === String(step.id)))
  if (!isDone(next.status)) next.status = processStatusFromStep(initialized)
  return next
}

export function setCurrentProcessStep(process = {}, stepId, baseDate = today()) {
  let next = clone(process) || {}
  const steps = orderedProcessSteps(next)
  const index = steps.findIndex(step => String(step.id) === String(stepId))
  if (index < 0) return { process: next, changed: false, error: 'Etapa não encontrada.' }
  const initialized = initializeProcessStep(steps[index], baseDate)
  next.etapas = (next.etapas || []).map(step => String(step.id) === String(stepId) ? initialized : step)
  next.etapaAtual = index
  if (!isDone(next.status)) next.status = processStatusFromStep(initialized)
  return { process: next, changed: true, step: initialized }
}

function advanceAfterSettled(next, stepId, baseDate) {
  const ordered = orderedProcessSteps(next)
  const targetIndex = ordered.findIndex(step => String(step.id) === String(stepId))
  const current = currentProcessStep(next)
  const nextPending = ordered.find((step, index) => index > targetIndex && !processStepSettled(step)) || ordered.find(step => !processStepSettled(step))
  if (nextPending) {
    const result = setCurrentProcessStep(next, nextPending.id, baseDate)
    return { ...result, completedStepId: String(stepId) }
  }
  next.etapaAtual = Math.max(0, targetIndex)
  if (!isDone(next.status) && current.allDone) next.status = 'Em andamento'
  return { process: next, changed: true, completedStepId: String(stepId), allStepsDone: true }
}

export function setProcessStepStatus(process = {}, stepId, status, { waitingTarget = '', baseDate = today() } = {}) {
  let next = clone(process) || {}
  const target = (next.etapas || []).find(step => String(step.id) === String(stepId))
  if (!target) return { process: next, changed: false, error: 'Etapa não encontrada.' }

  const normalizedStatus = normalizeProcessStepStatus(status)
  const statusDependency = waitingDependencyFromStatus(normalizedStatus)
  const updated = initializeProcessStep({
    ...target,
    status: normalizedStatus,
    responsavelTipo: statusDependency || target.responsavelTipo || 'interno',
    aguardandoEm: waitingTarget !== '' ? String(waitingTarget || '').trim() : String(target.aguardandoEm || '').trim(),
    concluidoEm: processStepSettled(normalizedStatus) ? (target.concluidoEm || baseDate) : '',
    aguardandoDesde: statusDependency ? (target.aguardandoDesde || baseDate) : target.aguardandoDesde || '',
  }, baseDate)

  next.etapas = (next.etapas || []).map(step => String(step.id) === String(stepId) ? updated : step)
  const ordered = orderedProcessSteps(next)
  const index = ordered.findIndex(step => String(step.id) === String(stepId))
  const current = currentProcessStep(process)
  const wasCurrent = String(current.step?.id || '') === String(stepId)

  if (processStepSettled(updated)) {
    if (wasCurrent) return advanceAfterSettled(next, stepId, baseDate)
    return { process: next, changed: true, step: updated }
  }

  if (wasCurrent || Number(process.etapaAtual || 0) === index) {
    next.etapaAtual = Math.max(0, index)
    if (!isDone(next.status)) next.status = processStatusFromStep(updated)
  }
  return { process: next, changed: true, step: updated }
}

export function toggleProcessStep(process = {}, stepId, baseDate = today()) {
  const target = (process.etapas || []).find(step => String(step.id) === String(stepId))
  if (!target) return { process: clone(process) || {}, changed: false, error: 'Etapa não encontrada.' }
  const reopening = processStepSettled(target)
  const result = setProcessStepStatus(process, stepId, reopening ? 'Pendente' : 'Concluída', { baseDate })
  if (!reopening) return result
  const activated = setCurrentProcessStep(result.process, stepId, baseDate)
  return { ...activated, reopened: true }
}

export function continueProcessWaiting(process = {}, baseDate = today()) {
  let next = clone(process) || {}
  const { step } = currentProcessStep(next)
  if (!step) return { process: next, changed: false, error: 'O processo não possui etapa pendente para acompanhamento.' }
  const dependency = normalizeProcessDependency(step.responsavelTipo)
  if (dependency === 'interno') return { process: next, changed: false, error: 'A etapa atual depende do escritório, não de acompanhamento externo.' }
  const interval = Math.max(1, Math.trunc(Number(step.followupDias) || 3))
  const updated = { ...step, aguardandoDesde: step.aguardandoDesde || baseDate, proximaRevisao: addBusinessDays(baseDate, interval) }
  next.etapas = (next.etapas || []).map(item => String(item.id) === String(step.id) ? updated : item)
  if (!isDone(next.status)) next.status = processStatusFromStep(updated)
  return { process: next, changed: true, step: updated }
}

export function processActionState(process = {}, { day = today() } = {}) {
  const { step, index, steps, allDone } = currentProcessStep(process)
  const internalDue = String(process.previsaoConclusao || '')
  const officialDue = String(process.prazoFinal || '')
  if (!step) {
    const actionLabel = allDone && steps.length ? 'Concluir processo' : 'Definir próxima etapa'
    const actionDate = internalDue || officialDue
    const actionOverdue = Boolean(actionDate && actionDate < day)
    const officialOverdue = Boolean(officialDue && officialDue < day)
    const internalOverdue = Boolean(internalDue && internalDue < day)
    const attention = Boolean(actionDate === day || internalDue === day || (officialDue && officialDue >= day && officialDue <= addBusinessDays(day, 2)))
    return {
      step: null,
      stepIndex: -1,
      stepCount: steps.length,
      allStepsDone: Boolean(allDone),
      dependency: 'interno',
      dependencyLabel: 'Escritório',
      stepStatus: '',
      stepStatusLabel: '',
      waitingTarget: '',
      actionLabel,
      actionDate,
      internalDue,
      officialDue,
      waitingSince: '',
      actionOverdue,
      internalOverdue,
      officialOverdue,
      level: officialOverdue || actionOverdue || internalOverdue ? 'critical' : attention ? 'attention' : 'info',
    }
  }

  const stepStatus = normalizeProcessStepStatus(step.status)
  const dependency = waitingDependencyFromStatus(stepStatus) || normalizeProcessDependency(step.responsavelTipo)
  const waitingTarget = String(step.aguardandoEm || '').trim()
  const dependencyLabel = waitingTarget || PROCESS_DEPENDENCIES[dependency]?.label || 'Escritório'
  const actionDate = dependency === 'interno'
    ? String(step.prazoEtapa || internalDue || officialDue || '')
    : String(step.proximaRevisao || step.prazoEtapa || internalDue || officialDue || '')

  let actionLabel = `Executar · ${step.nome || 'Etapa atual'}`
  if (stepStatus === 'Pendente') actionLabel = `Iniciar · ${step.nome || 'Etapa atual'}`
  if (stepStatus === 'Em exigência') actionLabel = `Resolver exigência · ${step.nome || 'Etapa atual'}`
  if (stepStatus === 'Em análise') actionLabel = dependency === 'interno'
    ? `Analisar · ${step.nome || 'Etapa atual'}`
    : `Acompanhar análise${waitingTarget ? ` · ${waitingTarget}` : ''} · ${step.nome || 'Etapa atual'}`
  if (dependency === 'cliente' || stepStatus === 'Aguardando cliente') actionLabel = `Cobrar / acompanhar ${waitingTarget || 'cliente'} · ${step.nome || 'Etapa atual'}`
  if (dependency === 'orgao' || stepStatus === 'Aguardando órgão') actionLabel = `Conferir ${waitingTarget || 'órgão'} · ${step.nome || 'Etapa atual'}`
  if (dependency === 'terceiro' || stepStatus === 'Aguardando terceiro') actionLabel = `Acompanhar ${waitingTarget || 'terceiro'} · ${step.nome || 'Etapa atual'}`

  const actionOverdue = Boolean(actionDate && actionDate < day)
  const officialOverdue = Boolean(officialDue && officialDue < day)
  const internalOverdue = Boolean(internalDue && internalDue < day)
  const attention = Boolean(actionDate === day || internalDue === day || (officialDue && officialDue >= day && officialDue <= addBusinessDays(day, 2)))
  return {
    step,
    stepIndex: index,
    stepCount: steps.length,
    allStepsDone: false,
    dependency,
    dependencyLabel,
    stepStatus,
    stepStatusLabel: processStepStatusLabel(step),
    waitingTarget,
    actionLabel,
    actionDate,
    internalDue,
    officialDue,
    waitingSince: String(step.aguardandoDesde || ''),
    actionOverdue,
    internalOverdue,
    officialOverdue,
    level: officialOverdue || actionOverdue || internalOverdue ? 'critical' : attention ? 'attention' : 'info',
  }
}
