const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const doneStatuses = new Set(['concluida', 'concluido', 'finalizada', 'finalizado', 'feito', 'done'])
const pad = value => String(value).padStart(2, '0')
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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
    midday: ['midday_enabled', 'midday_time'],
    weekly: ['weekly_enabled', 'weekly_time'],
    closing: ['closing_enabled', 'closing_time'],
    weekly_closing: ['weekly_closing_enabled', 'weekly_closing_time'],
  }
  const [enabledKey, timeKey] = mapping[type] || []
  if (!enabledKey || !preference[enabledKey]) return false
  if (type === 'weekly' && Number(preference.weekly_weekday) !== parts.weekday) return false
  if (type === 'weekly_closing' && Number(preference.weekly_closing_weekday) !== parts.weekday) return false
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
  if (type === 'weekly' || type === 'weekly_closing') return weekBounds(localDate).start
  return localDate
}

function taskDate(task = {}) {
  const value = String(task.prazo || '')
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

function taskDone(task = {}) { return doneStatuses.has(normalize(task.status)) }
function processDone(process = {}) { return doneStatuses.has(normalize(process.status)) }
function obligationDone(link = {}) { return doneStatuses.has(normalize(link.status)) || normalize(link.status) === 'nao se aplica' }
function tasksFromPayload(payload = {}) { return Array.isArray(payload.med_tarefas) ? payload.med_tarefas : [] }
function plural(value, singular, pluralForm) { return `${value} ${value === 1 ? singular : pluralForm}` }

function clientMap(payload = {}) {
  return new Map((Array.isArray(payload.med_clientes) ? payload.med_clientes : []).map(client => [String(client.id), client.razao || client.nome || client.fantasia || 'Cliente']))
}

function workFromPayload(payload = {}, preference = {}) {
  const clients = clientMap(payload)
  const includeTasks = preference.include_tasks !== false
  const includeProcesses = preference.include_processes !== false
  const includeObligations = preference.include_obligations !== false
  const result = []

  if (includeTasks) tasksFromPayload(payload).forEach(task => {
    const date = taskDate(task)
    if (!date) return
    result.push({ type: 'task', id: String(task.id || ''), title: task.titulo || 'Tarefa', client: task.clientId ? clients.get(String(task.clientId)) || 'Cliente' : 'Interna', date, done: taskDone(task), priority: normalize(task.prioridade), completedDate: taskDone(task) ? String(task.updatedAt || '').slice(0, 10) : '' })
  })

  if (includeProcesses) (Array.isArray(payload.med_processos) ? payload.med_processos : []).forEach(process => {
    const date = String(process.prazoFinal || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    result.push({ type: 'process', id: String(process.id || ''), title: process.tipo || 'Processo', client: clients.get(String(process.clientId)) || 'Cliente', date, done: processDone(process), priority: '', completedDate: processDone(process) ? String(process.dataConclusao || process.updatedAt || '').slice(0, 10) : '' })
  })

  if (includeObligations) (Array.isArray(payload.med_obrigacoes) ? payload.med_obrigacoes : []).forEach(obligation => {
    ;(Array.isArray(obligation.clientes) ? obligation.clientes : []).forEach(link => {
      const date = String(link.vencimento || '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
      result.push({ type: 'obligation', id: `${obligation.id || ''}:${link.clienteId || ''}`, title: obligation.nome || 'Obrigação', client: clients.get(String(link.clienteId)) || 'Cliente', date, done: obligationDone(link), priority: '', completedDate: obligationDone(link) ? String(link.concluidoEm || link.updatedAt || '').slice(0, 10) : '' })
    })
  })

  return result
}

function paymentRows(charge = {}) {
  if (Array.isArray(charge.pagamentos) && charge.pagamentos.length) return charge.pagamentos
  if (normalize(charge.status) === 'recebido' && Number(charge.valor || 0) > 0) return [{ data: charge.recebidoEm || charge.vencimento || '', valorRecebido: Number(charge.valor || 0), desconto: 0, acrescimo: 0 }]
  return []
}

function financeSummary(charge = {}) {
  const total = Math.max(0, Number(charge.valor || 0))
  const payments = paymentRows(charge)
  const received = payments.reduce((sum, payment) => sum + Number(payment.valorRecebido || payment.valor || 0), 0)
  const discounts = payments.reduce((sum, payment) => sum + Number(payment.desconto || 0), 0)
  const surcharges = payments.reduce((sum, payment) => sum + Number(payment.acrescimo || 0), 0)
  return { total, payments, received, balance: Math.max(0, total - Math.max(0, received + discounts - surcharges)) }
}

function financeFromPayload(payload = {}, preference = {}) {
  if (preference.include_finance === false) return []
  const clients = clientMap(payload)
  return (Array.isArray(payload.med_financeiro) ? payload.med_financeiro : []).filter(charge => normalize(charge.status) !== 'cancelado').map(charge => {
    const summary = financeSummary(charge)
    return {
      id: String(charge.id || ''),
      title: charge.descricao || 'Cobrança',
      client: clients.get(String(charge.clienteId)) || 'Cliente',
      due: String(charge.vencimento || ''),
      summary,
    }
  })
}

function workPriority(item, localDate) {
  let score = 0
  if (!item.done && item.date < localDate) score += 120
  else if (!item.done && item.date === localDate) score += 90
  if (item.priority === 'urgente') score += 45
  else if (item.priority === 'alta') score += 30
  return score
}

function topTitles(items, localDate, limit = 3) {
  return items.filter(item => !item.done).map(item => ({ ...item, score: workPriority(item, localDate) })).sort((a, b) => b.score - a.score || a.date.localeCompare(b.date)).slice(0, limit).map(item => item.title)
}

function completionCount(payload = {}, work = [], start = '', end = '') {
  const direct = work.filter(item => item.completedDate && item.completedDate >= start && item.completedDate <= end).length
  const history = (Array.isArray(payload.med_historico_painel) ? payload.med_historico_painel : []).filter(item => {
    const date = String(item.completedAt || '').slice(0, 10)
    return date && date >= start && date <= end
  }).length
  return Math.max(direct, history)
}

function financialWindow(finance = [], start = '', end = '', localDate = '') {
  let received = 0, overdue = 0, due = 0
  finance.forEach(charge => {
    if (charge.due && charge.due >= start && charge.due <= end && charge.summary.balance > 0.009) due += charge.summary.balance
    if (charge.due && charge.due < localDate && charge.summary.balance > 0.009) overdue += charge.summary.balance
    charge.summary.payments.forEach(payment => {
      const date = String(payment.data || payment.recebidoEm || '')
      if (date >= start && date <= end) received += Number(payment.valorRecebido || payment.valor || 0)
    })
  })
  return { received, overdue, due }
}

export function buildOfficeDigest(payload = {}, type = 'daily', localDate = '', preference = {}) {
  const work = workFromPayload(payload, preference)
  const finance = financeFromPayload(payload, preference)
  const todayItems = work.filter(item => item.date === localDate)
  const todayPending = todayItems.filter(item => !item.done)
  const overdue = work.filter(item => !item.done && item.date < localDate)
  const critical = overdue.length + todayPending.filter(item => item.priority === 'urgente' || item.priority === 'alta').length
  const first = topTitles([...overdue, ...todayPending, ...work.filter(item => item.date > localDate)], localDate)
  const financial = financialWindow(finance, localDate, localDate, localDate)

  if (type === 'midday') {
    const doneToday = completionCount(payload, work, localDate, localDate)
    return {
      title: 'Check-in do dia',
      body: `${plural(doneToday, 'entrega registrada', 'entregas registradas')} · ${plural(todayPending.length, 'item de hoje pendente', 'itens de hoje pendentes')}${overdue.length ? ` · ${plural(overdue.length, 'atraso', 'atrasos')}` : ' · sem atrasos'}.`,
      url: '/?push=meu-dia',
      tag: `office-midday-${localDate}`,
      actions: [{ action: 'open-day', title: 'Meu Dia' }, { action: 'open-pending', title: 'Pendências' }],
    }
  }

  if (type === 'weekly' || type === 'weekly_closing') {
    const { start, end } = weekBounds(localDate)
    const week = work.filter(item => item.date >= start && item.date <= end)
    const weekPending = week.filter(item => !item.done)
    const weekDone = week.filter(item => item.done)
    const finances = financialWindow(finance, start, end, localDate)
    if (type === 'weekly_closing') {
      const completed = completionCount(payload, work, start, end)
      return {
        title: 'Fechamento semanal',
        body: `${plural(completed, 'entrega registrada', 'entregas registradas')} · ${plural(weekPending.length, 'pendência da semana', 'pendências da semana')} · ${money(finances.received)} recebidos${finances.overdue > 0 ? ` · ${money(finances.overdue)} vencidos` : ''}.`,
        url: '/?push=meu-dia',
        tag: `office-weekly-closing-${start}`,
        actions: [{ action: 'open-day', title: 'Meu Dia' }, { action: 'open-finance', title: 'Financeiro' }],
      }
    }
    const priorities = topTitles([...overdue, ...weekPending], localDate)
    return {
      title: `Semana · ${week.length} item(ns)`,
      body: `${plural(weekPending.length, 'pendente', 'pendentes')} · ${plural(weekDone.length, 'concluído', 'concluídos')}${overdue.length ? ` · ${plural(overdue.length, 'atraso', 'atrasos')}` : ''}${priorities.length ? `. Prioridade: ${priorities.join(', ')}` : ''}.`,
      url: '/?push=meu-dia',
      tag: `office-weekly-${start}`,
      actions: [{ action: 'open-day', title: 'Planejar' }, { action: 'open-pending', title: 'Pendências' }],
    }
  }

  if (type === 'closing') {
    const completed = completionCount(payload, work, localDate, localDate)
    return {
      title: 'Fechamento do dia',
      body: `${plural(completed, 'entrega registrada', 'entregas registradas')} · ${plural(todayPending.length, 'pendência de hoje', 'pendências de hoje')}${overdue.length ? ` · ${plural(overdue.length, 'atraso aberto', 'atrasos abertos')}` : ' · sem atrasos'}${financial.received > 0 ? ` · ${money(financial.received)} recebidos` : ''}.`,
      url: '/?push=meu-dia',
      tag: `office-closing-${localDate}`,
      actions: [{ action: 'open-day', title: 'Ver fechamento' }, { action: 'open-pending', title: 'Pendências' }],
    }
  }

  const priorityCopy = first.length ? ` Primeiro: ${first.join(', ')}.` : ''
  return {
    title: critical ? `Meu Dia · ${critical} crítico(s)` : `Meu Dia · ${todayPending.length} para hoje`,
    body: `${plural(todayPending.length, 'item de hoje', 'itens de hoje')} · ${plural(overdue.length, 'atraso', 'atrasos')}${financial.overdue > 0 ? ` · ${money(financial.overdue)} vencidos` : ''}.${priorityCopy}`,
    url: '/?push=meu-dia',
    tag: `office-daily-${localDate}`,
    actions: [{ action: 'open-day', title: 'Abrir Meu Dia' }, { action: 'open-pending', title: 'Pendências' }],
  }
}

// Compatibilidade com os testes e integrações da primeira versão do push.
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
