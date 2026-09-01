const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const doneStatuses = new Set(['concluida', 'concluido', 'finalizada', 'finalizado', 'feito', 'done'])

const pad = value => String(value).padStart(2, '0')

export function localClockParts(now = new Date(), timeZone = 'America/Sao_Paulo') {
  let formatter
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
    timeZone = 'UTC'
  }
  const map = Object.fromEntries(formatter.formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
  const date = `${map.year}-${map.month}-${map.day}`
  const time = `${map.hour}:${map.minute}`
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return { date, time, weekday, timeZone }
}

function minutes(value = '00:00') {
  const [hour, minute] = String(value).slice(0, 5).split(':').map(Number)
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0)
}

export function shouldDispatch(preference = {}, type = 'daily', now = new Date(), windowMinutes = 14) {
  if (!preference.enabled) return false
  const parts = localClockParts(now, preference.timezone || 'America/Sao_Paulo')
  const mapping = {
    daily: ['daily_enabled', 'daily_time'],
    weekly: ['weekly_enabled', 'weekly_time'],
    closing: ['closing_enabled', 'closing_time'],
  }
  const [enabledKey, timeKey] = mapping[type] || []
  if (!enabledKey || !preference[enabledKey]) return false
  if (type === 'weekly' && Number(preference.weekly_weekday) !== parts.weekday) return false
  const delta = minutes(parts.time) - minutes(preference[timeKey])
  return delta >= 0 && delta <= windowMinutes
}

function addDays(value, amount) {
  const [year, month, day] = String(value).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + amount))
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function weekBounds(localDate) {
  const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  const start = addDays(localDate, mondayOffset)
  return { start, end: addDays(start, 6) }
}

export function periodKey(type, localDate) {
  if (type === 'weekly') return weekBounds(localDate).start
  return localDate
}

function taskDate(task = {}) {
  const value = String(task.prazo || '')
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

function taskDone(task = {}) {
  return doneStatuses.has(normalize(task.status))
}

function tasksFromPayload(payload = {}) {
  return Array.isArray(payload.med_tarefas) ? payload.med_tarefas : []
}

function plural(value, singular, pluralForm) {
  return `${value} ${value === 1 ? singular : pluralForm}`
}

export function buildTaskDigest(payload = {}, type = 'daily', localDate = '') {
  const tasks = tasksFromPayload(payload).filter(task => taskDate(task))
  const today = tasks.filter(task => taskDate(task) === localDate)
  const overdue = tasks.filter(task => !taskDone(task) && taskDate(task) < localDate)
  const todayDone = today.filter(taskDone)
  const todayPending = today.filter(task => !taskDone(task))

  if (type === 'weekly') {
    const { start, end } = weekBounds(localDate)
    const week = tasks.filter(task => taskDate(task) >= start && taskDate(task) <= end)
    const weekDone = week.filter(taskDone)
    const weekPending = week.filter(task => !taskDone(task))
    return {
      title: `Tarefas da semana · ${week.length}`,
      body: `${plural(weekPending.length, 'pendente', 'pendentes')} · ${plural(weekDone.length, 'concluída', 'concluídas')}${overdue.length ? ` · ${plural(overdue.length, 'atrasada', 'atrasadas')}` : ''}.`,
      url: '/?push=calendario',
      tag: `office-weekly-${start}`,
    }
  }

  if (type === 'closing') {
    return {
      title: 'Fechamento do dia',
      body: `${todayDone.length}/${today.length} tarefas do dia concluídas · ${plural(todayPending.length, 'pendente', 'pendentes')}${overdue.length ? ` · ${plural(overdue.length, 'atrasada', 'atrasadas')}` : ''}.`,
      url: '/?push=tarefas',
      tag: `office-closing-${localDate}`,
    }
  }

  return {
    title: `Tarefas de hoje · ${today.length}`,
    body: `${plural(todayPending.length, 'pendente', 'pendentes')} de ${today.length}${overdue.length ? ` · ${plural(overdue.length, 'atrasada', 'atrasadas')}` : ' · sem atrasos'}.`,
    url: '/?push=tarefas',
    tag: `office-daily-${localDate}`,
  }
}
