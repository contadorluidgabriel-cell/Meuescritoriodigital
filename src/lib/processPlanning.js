import { isDone, today } from './storage.js'

const clone = value => value == null ? value : structuredClone(value)
const pad = value => String(value).padStart(2, '0')

export const PROCESS_DEPENDENCIES = {
  interno: { id: 'interno', label: 'Escritório', status: 'Em andamento' },
  cliente: { id: 'cliente', label: 'Cliente', status: 'Aguardando cliente' },
  orgao: { id: 'orgao', label: 'Órgão / terceiro', status: 'Aguardando órgão' },
}

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
  const normalized = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (normalized === 'cliente') return 'cliente'
  if (normalized === 'orgao' || normalized === 'órgão' || normalized === 'terceiro' || normalized === 'externo') return 'orgao'
  return 'interno'
}

export function orderedProcessSteps(process = {}) {
  return [...(process.etapas || [])].filter(step => step.ativa !== false).sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
}

export function currentProcessStep(process = {}) {
  const steps = orderedProcessSteps(process)
  if (!steps.length) return { step: null, index: -1, steps, allDone: false }
  const requested = Math.max(0, Math.min(Number(process.etapaAtual || 0), steps.length - 1))
  if (!isDone(steps[requested]?.status)) return { step: steps[requested], index: requested, steps, allDone: false }
  const after = steps.findIndex((step, index) => index > requested && !isDone(step.status))
  if (after >= 0) return { step: steps[after], index: after, steps, allDone: false }
  const firstPending = steps.findIndex(step => !isDone(step.status))
  if (firstPending >= 0) return { step: steps[firstPending], index: firstPending, steps, allDone: false }
  return { step: null, index: -1, steps, allDone: true }
}

export function initializeProcessStep(step = {}, baseDate = today()) {
  const next = { ...clone(step) }
  if (isDone(next.status)) return next
  const dependency = normalizeProcessDependency(next.responsavelTipo)
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
  if (!isDone(next.status)) next.status = PROCESS_DEPENDENCIES[initialized.responsavelTipo]?.status || 'Em andamento'
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
  if (!isDone(next.status)) next.status = PROCESS_DEPENDENCIES[initialized.responsavelTipo]?.status || 'Em andamento'
  return { process: next, changed: true, step: initialized }
}

export function toggleProcessStep(process = {}, stepId, baseDate = today()) {
  let next = clone(process) || {}
  const target = (next.etapas || []).find(step => String(step.id) === String(stepId))
  if (!target) return { process: next, changed: false, error: 'Etapa não encontrada.' }
  const reopening = isDone(target.status)
  next.etapas = (next.etapas || []).map(step => {
    if (String(step.id) !== String(stepId)) return step
    if (reopening) return { ...step, status: 'Pendente', concluidoEm: '' }
    return { ...step, status: 'Concluída', concluidoEm: baseDate }
  })
  const ordered = orderedProcessSteps(next)
  const targetIndex = ordered.findIndex(step => String(step.id) === String(stepId))
  if (reopening) {
    const result = setCurrentProcessStep(next, stepId, baseDate)
    return { ...result, reopened: true }
  }
  const nextPending = ordered.find((step, index) => index > targetIndex && !isDone(step.status)) || ordered.find(step => !isDone(step.status))
  if (nextPending) {
    const result = setCurrentProcessStep(next, nextPending.id, baseDate)
    return { ...result, completedStepId: String(stepId) }
  }
  next.etapaAtual = Math.max(0, targetIndex)
  return { process: next, changed: true, completedStepId: String(stepId), allStepsDone: true }
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
  if (!isDone(next.status)) next.status = PROCESS_DEPENDENCIES[dependency].status
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
  const dependency = normalizeProcessDependency(step.responsavelTipo)
  const actionDate = dependency === 'interno'
    ? String(step.prazoEtapa || internalDue || officialDue || '')
    : String(step.proximaRevisao || step.prazoEtapa || internalDue || officialDue || '')
  const actionLabel = dependency === 'cliente'
    ? `Cobrar / acompanhar cliente · ${step.nome || 'Etapa atual'}`
    : dependency === 'orgao'
      ? `Conferir órgão / terceiro · ${step.nome || 'Etapa atual'}`
      : `Executar · ${step.nome || 'Etapa atual'}`
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
    dependencyLabel: PROCESS_DEPENDENCIES[dependency].label,
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
