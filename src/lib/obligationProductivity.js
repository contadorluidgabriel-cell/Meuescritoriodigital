const integer = value => Math.max(0, Math.trunc(Number(value) || 0))
const isoDay = value => String(value || '').slice(0, 10)

function parseDay(value) {
  const day = isoDay(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const date = new Date(day + 'T12:00:00')
  return Number.isNaN(date.getTime()) ? null : date
}

function formatIso(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calendarDaysInclusive(from, to) {
  const start = parseDay(from)
  const end = parseDay(to)
  if (!start || !end || start > end) return 0
  const diff = Math.floor((end.getTime() - start.getTime()) / 86400000)
  return diff + 1
}

// Mantidos por compatibilidade com chamadas antigas; o ritmo produtivo usa dias corridos.
export function isBusinessDay(value) {
  return Boolean(value instanceof Date ? !Number.isNaN(value.getTime()) : parseDay(value))
}

export function businessDaysInclusive(from, to) {
  return calendarDaysInclusive(from, to)
}

export function productionDoneOn(link = {}, day = '') {
  const target = isoDay(day)
  return Math.max(0, (link.historicoProducao || [])
    .filter(item => isoDay(item?.data) === target)
    .reduce((sum, item) => sum + Number(item?.quantidade || 0), 0))
}

export function addCalendarDays(from, amount = 0) {
  const start = parseDay(from)
  const total = Math.max(0, Math.trunc(Number(amount) || 0))
  if (!start) return ''
  const cursor = new Date(start)
  cursor.setDate(cursor.getDate() + total)
  return formatIso(cursor)
}

export function addBusinessDays(from, amount = 0) {
  return addCalendarDays(from, amount)
}

function historyPace(link = {}, day = '') {
  const currentDay = isoDay(day)
  const history = (Array.isArray(link.historicoProducao) ? link.historicoProducao : [])
    .filter(item => isoDay(item?.data) && isoDay(item.data) <= currentDay)
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')))
  if (!history.length) return { historyDays: 0, elapsedDays: 0, produced: 0, averagePerDay: 0, firstProductionDay: '' }

  const firstProductionDay = isoDay(history[0].data)
  const produced = Math.max(0, Math.round(history.reduce((sum, item) => sum + Number(item?.quantidade || 0), 0)))
  const elapsedDays = Math.max(1, calendarDaysInclusive(firstProductionDay, currentDay))
  return {
    historyDays: history.length,
    elapsedDays,
    produced,
    averagePerDay: produced > 0 ? Math.round(produced / elapsedDays) : 0,
    firstProductionDay,
  }
}

export function linkProductivity(link = {}, due = '', day = new Date().toISOString().slice(0, 10)) {
  const total = integer(link.quantidadePessoas)
  const completed = Math.min(total, integer(link.quantidadeConcluida))
  const pending = Math.max(0, total - completed)
  const dueDay = isoDay(due || link.vencimento)
  const currentDay = isoDay(day)
  const doneToday = productionDoneOn(link, currentDay)
  const todayAvailable = true
  const pace = historyPace(link, currentDay)

  if (!total) return {
    total, completed, pending, due: dueDay, daysRemaining: 0, requiredPerDay: 0,
    todayTarget: 0, doneToday, remainingToday: 0, todayAvailable,
    overdue: false, completedAll: false, averagePerDay: pace.averagePerDay,
    projectedFinish: '', projectedDays: 0, paceStatus: 'sem-dados',
  }

  const completedAll = pending === 0
  const overdue = Boolean(dueDay && currentDay > dueDay && !completedAll)
  const daysRemaining = dueDay && currentDay <= dueDay ? calendarDaysInclusive(currentDay, dueDay) : 0

  // Keep today's target stable as production is posted during the day.
  const pendingAtStartOfDay = Math.max(0, pending + doneToday)
  const todayTarget = completedAll || !todayAvailable
    ? 0
    : daysRemaining > 0
      ? Math.ceil(pendingAtStartOfDay / daysRemaining)
      : pendingAtStartOfDay
  const remainingToday = completedAll || !todayAvailable ? 0 : Math.max(0, todayTarget - doneToday)

  // Required pace for the next available business day after the current position.
  const futureDays = Math.max(0, daysRemaining - 1)
  const pendingAfterTodayTarget = Math.max(0, pending - remainingToday)
  const requiredPerDay = completedAll
    ? 0
    : futureDays > 0
      ? Math.ceil(pendingAfterTodayTarget / futureDays)
      : todayAvailable ? todayTarget : pending

  const averagePerDay = pace.averagePerDay
  const projectedDays = completedAll ? 0 : averagePerDay > 0 ? Math.ceil(pending / averagePerDay) : 0
  const projectedFinish = projectedDays > 0 ? addCalendarDays(currentDay, projectedDays) : ''

  let paceStatus = 'sem-dados'
  if (completedAll) paceStatus = 'concluida'
  else if (overdue) paceStatus = 'atrasada'
  else if (averagePerDay > 0) {
    const baseline = Math.max(1, todayAvailable ? todayTarget : requiredPerDay)
    const ratio = averagePerDay / baseline
    paceStatus = ratio >= 1.1 ? 'adiantada' : ratio >= 0.9 ? 'no-ritmo' : ratio >= 0.7 ? 'atencao' : 'abaixo'
  }

  return {
    total,
    completed,
    pending,
    due: dueDay,
    daysRemaining,
    requiredPerDay,
    todayTarget,
    doneToday,
    remainingToday,
    todayAvailable,
    overdue,
    completedAll,
    averagePerDay,
    projectedFinish,
    projectedDays,
    paceStatus,
    historyDays: pace.historyDays,
    elapsedDays: pace.elapsedDays,
  }
}

export function obligationProductivity(obligation = {}, day = new Date().toISOString().slice(0, 10)) {
  const links = Array.isArray(obligation.clientes) ? obligation.clientes : []
  const rows = links.map(link => linkProductivity(link, link.vencimento || obligation.vencimento || '', day))
  const active = rows.filter(row => !row.completedAll)
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const completed = rows.reduce((sum, row) => sum + row.completed, 0)
  const pending = rows.reduce((sum, row) => sum + row.pending, 0)
  const doneToday = rows.reduce((sum, row) => sum + row.doneToday, 0)
  const requiredToday = active.reduce((sum, row) => sum + row.todayTarget, 0)
  const nextRequiredPerDay = active.reduce((sum, row) => sum + row.requiredPerDay, 0)
  const remainingToday = active.reduce((sum, row) => sum + row.remainingToday, 0)
  const dueDays = active.map(row => row.due).filter(Boolean)
  const sameDue = dueDays.length > 0 && new Set(dueDays).size === 1
  const daysRemaining = sameDue ? active[0]?.daysRemaining || 0 : null
  return {
    total,
    completed,
    pending,
    doneToday,
    requiredToday,
    nextRequiredPerDay,
    remainingToday,
    daysRemaining,
    due: sameDue ? dueDays[0] : '',
    mixedDue: dueDays.length > 1 && !sameDue,
    overdue: active.some(row => row.overdue),
    completedAll: pending === 0 && total > 0,
  }
}

export function appendProductionHistory(link = {}, previousCompleted = 0, nextCompleted = 0, day = new Date().toISOString().slice(0, 10)) {
  const previous = integer(previousCompleted)
  const next = integer(nextCompleted)
  const delta = next - previous
  if (!delta) return Array.isArray(link.historicoProducao) ? link.historicoProducao : []
  const target = isoDay(day)
  const history = Array.isArray(link.historicoProducao) ? link.historicoProducao.map(item => ({ ...item })) : []
  const index = history.findIndex(item => isoDay(item?.data) === target)
  if (index >= 0) {
    history[index] = {
      ...history[index],
      data: target,
      quantidade: Number(history[index].quantidade || 0) + delta,
      totalApos: next,
    }
  } else {
    history.push({ data: target, quantidade: delta, totalApos: next })
  }
  return history.sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')))
}

export function productionHistorySummary(link = {}) {
  const history = Array.isArray(link.historicoProducao) ? link.historicoProducao : []
  const positiveDays = history.filter(item => Number(item.quantidade || 0) > 0)
  const produced = positiveDays.reduce((sum, item) => sum + Number(item.quantidade || 0), 0)
  return {
    days: positiveDays.length,
    produced,
    averagePerProductionDay: positiveDays.length ? Math.round(produced / positiveDays.length) : 0,
  }
}
