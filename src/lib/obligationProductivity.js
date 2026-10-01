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

export function isBusinessDay(value) {
  const date = value instanceof Date ? value : parseDay(value)
  if (!date) return false
  const weekday = date.getDay()
  return weekday !== 0 && weekday !== 6
}

export function businessDaysInclusive(from, to) {
  const start = parseDay(from)
  const end = parseDay(to)
  if (!start || !end || start > end) return 0
  let count = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    if (isBusinessDay(cursor)) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

export function productionDoneOn(link = {}, day = '') {
  const target = isoDay(day)
  return Math.max(0, (link.historicoProducao || [])
    .filter(item => isoDay(item?.data) === target)
    .reduce((sum, item) => sum + Number(item?.quantidade || 0), 0))
}

export function linkProductivity(link = {}, due = '', day = new Date().toISOString().slice(0, 10)) {
  const total = integer(link.quantidadePessoas)
  const completed = Math.min(total, integer(link.quantidadeConcluida))
  const pending = Math.max(0, total - completed)
  const dueDay = isoDay(due || link.vencimento)
  const currentDay = isoDay(day)
  const doneToday = productionDoneOn(link, currentDay)

  if (!total) return { total, completed, pending, due: dueDay, businessDaysRemaining: 0, requiredPerDay: 0, doneToday, remainingToday: 0, overdue: false, completedAll: false }

  const completedAll = pending === 0
  const overdue = Boolean(dueDay && currentDay > dueDay && !completedAll)
  const businessDaysRemaining = dueDay && currentDay <= dueDay ? businessDaysInclusive(currentDay, dueDay) : 0
  const requiredPerDay = completedAll ? 0 : businessDaysRemaining > 0 ? Math.ceil(pending / businessDaysRemaining) : pending
  const remainingToday = completedAll ? 0 : Math.max(0, requiredPerDay - doneToday)

  return { total, completed, pending, due: dueDay, businessDaysRemaining, requiredPerDay, doneToday, remainingToday, overdue, completedAll }
}

export function obligationProductivity(obligation = {}, day = new Date().toISOString().slice(0, 10)) {
  const links = Array.isArray(obligation.clientes) ? obligation.clientes : []
  const rows = links.map(link => linkProductivity(link, link.vencimento || obligation.vencimento || '', day))
  const active = rows.filter(row => !row.completedAll)
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const completed = rows.reduce((sum, row) => sum + row.completed, 0)
  const pending = rows.reduce((sum, row) => sum + row.pending, 0)
  const doneToday = rows.reduce((sum, row) => sum + row.doneToday, 0)
  const requiredToday = active.reduce((sum, row) => sum + row.requiredPerDay, 0)
  const remainingToday = active.reduce((sum, row) => sum + row.remainingToday, 0)
  const dueDays = active.map(row => row.due).filter(Boolean)
  const sameDue = dueDays.length > 0 && new Set(dueDays).size === 1
  const businessDaysRemaining = sameDue ? active[0]?.businessDaysRemaining || 0 : null
  return {
    total,
    completed,
    pending,
    doneToday,
    requiredToday,
    remainingToday,
    businessDaysRemaining,
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
