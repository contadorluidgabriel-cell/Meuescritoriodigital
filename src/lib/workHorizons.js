import { addDays, collectCommandCenterItems } from './operationalIntelligence.js'
import { taskIsInAdvanceWindow } from './taskAdvance.js'

export const WORK_HORIZONS = {
  today: { id: 'today', label: 'Hoje', shortLabel: 'Hoje', days: 1 },
  week: { id: 'week', label: 'Próximos 7 dias', shortLabel: '7 dias', days: 7 },
  month: { id: 'month', label: 'Próximos 30 dias', shortLabel: '30 dias', days: 30 },
}

const uniqueByKey = items => [...new Map((items || []).map(item => [item.key, item])).values()]
const itemDate = item => String(item?.effectiveDate || item?.planned || item?.due || '')
const officialDue = item => String(item?.due || '')

function dateLabel(value, options = {}) {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('pt-BR', options)
}

function rangeLabel(start, end) {
  if (start === end) return dateLabel(start, { weekday: 'short', day: '2-digit', month: 'short' })
  const startDate = new Date(`${start}T12:00:00`)
  const endDate = new Date(`${end}T12:00:00`)
  const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()
  if (sameMonth) return `${dateLabel(start, { day: '2-digit' })}–${dateLabel(end, { day: '2-digit', month: 'short' })}`
  return `${dateLabel(start, { day: '2-digit', month: 'short' })} – ${dateLabel(end, { day: '2-digit', month: 'short' })}`
}

function dayGroups(items, day, end) {
  const groups = []
  let cursor = day
  while (cursor <= end) {
    const rows = items.filter(item => itemDate(item) === cursor)
    if (rows.length) groups.push({
      key: cursor,
      start: cursor,
      end: cursor,
      label: cursor === day ? 'Hoje' : dateLabel(cursor, { weekday: 'long', day: '2-digit', month: 'short' }),
      items: rows,
    })
    cursor = addDays(cursor, 1)
  }
  return groups
}

function weekGroups(items, day, end) {
  const groups = []
  let start = day
  let index = 1
  while (start <= end) {
    const finish = addDays(start, 6) > end ? end : addDays(start, 6)
    const rows = items.filter(item => {
      const date = itemDate(item)
      return date >= start && date <= finish
    })
    if (rows.length) groups.push({ key: `week-${index}`, start, end: finish, label: `Semana ${index} · ${rangeLabel(start, finish)}`, items: rows })
    start = addDays(finish, 1)
    index += 1
  }
  return groups
}

function taskSourceMap(office = {}) {
  return new Map((office.tasks || []).map(task => [String(task.id || ''), task]))
}

function isVisibleTodayByAdvance(item, tasksById, day) {
  if (item?.type !== 'task') return false
  const task = tasksById.get(String(item.id || ''))
  return task ? taskIsInAdvanceWindow(task, day) : false
}

export function horizonEnd(day, horizon = 'today') {
  const config = WORK_HORIZONS[horizon] || WORK_HORIZONS.today
  return addDays(day, config.days - 1)
}

export function buildWorkHorizon(office = {}, { day, horizon = 'today' } = {}) {
  const config = WORK_HORIZONS[horizon] || WORK_HORIZONS.today
  const end = horizonEnd(day, config.id)
  const all = collectCommandCenterItems(office, { day, daysBefore: 60 })
  const tasksById = taskSourceMap(office)
  const overdue = all.filter(item => {
    const due = officialDue(item)
    return due && due < day
  })
  const inPeriod = all.filter(item => {
    const date = itemDate(item)
    if (date && date >= day && date <= end) return true
    return config.id === 'today' && isVisibleTodayByAdvance(item, tasksById, day)
  })
  const items = uniqueByKey([...overdue, ...inPeriod])
  const unscheduled = all.filter(item => !itemDate(item) && ['task', 'process', 'obligation'].includes(item.type))
  const periodGroups = config.id === 'today'
    ? (inPeriod.length ? [{ key: day, start: day, end: day, label: 'Hoje', items: uniqueByKey(inPeriod) }] : [])
    : config.id === 'month'
      ? weekGroups(inPeriod, day, end)
      : dayGroups(inPeriod, day, end)
  const groups = [
    ...(overdue.length ? [{ key: 'overdue', start: '', end: '', label: 'Atrasados', overdue: true, items: overdue }] : []),
    ...periodGroups,
  ]
  const operational = items.filter(item => ['task', 'process', 'obligation'].includes(item.type))
  const critical = items.filter(item => item.level === 'critical')
  const typeCounts = {
    task: items.filter(item => item.type === 'task').length,
    process: items.filter(item => item.type === 'process').length,
    obligation: items.filter(item => item.type === 'obligation').length,
    finance: items.filter(item => ['finance', 'payable', 'partner'].includes(item.type)).length,
  }
  const groupCounts = periodGroups.map(group => group.items.length)
  const maxLoad = groupCounts.length ? Math.max(...groupCounts) : 0
  const averageLoad = groupCounts.length ? groupCounts.reduce((sum, value) => sum + value, 0) / groupCounts.length : 0
  const peak = periodGroups.find(group => group.items.length === maxLoad) || null
  const overloaded = Boolean(peak && maxLoad >= 5 && maxLoad > averageLoad * 1.45)

  return {
    horizon: config.id,
    label: config.label,
    shortLabel: config.shortLabel,
    day,
    end,
    items,
    inPeriod,
    overdue,
    unscheduled,
    groups,
    operational,
    critical,
    typeCounts,
    total: items.length,
    scheduledTotal: inPeriod.length,
    peak,
    overloaded,
  }
}
