import { paymentSummary } from './financePro.js'
import { collectOfficeNotifications } from './notificationCenter.js'
import { today, isDone } from './storage.js'

const DAY_MS = 86400000
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pad = value => String(value).padStart(2, '0')

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
}

export function addDays(value, amount) {
  const date = parseDate(value)
  if (!date) return ''
  date.setDate(date.getDate() + amount)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function daysBetween(base, target) {
  const a = parseDate(base), b = parseDate(target)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

export function weekBounds(day = today()) {
  const date = parseDate(day)
  if (!date) return { start: day, end: day }
  const weekday = date.getDay()
  const offset = weekday === 0 ? -6 : 1 - weekday
  const start = addDays(day, offset)
  return { start, end: addDays(start, 6) }
}

function processDone(process = {}) {
  return isDone(process.status)
}

function obligationDone(link = {}) {
  return isDone(link.status) || normalize(link.status) === 'nao se aplica'
}

function taskPriorityWeight(value) {
  const normalized = normalize(value)
  if (normalized === 'urgente') return 45
  if (normalized === 'alta') return 32
  if (normalized === 'media' || normalized === 'média') return 15
  return 0
}

function dueScore(days) {
  if (days === null) return 0
  if (days < 0) return 120 + Math.min(45, Math.abs(days) * 3)
  if (days === 0) return 95
  if (days === 1) return 70
  if (days <= 3) return 45
  if (days <= 7) return 25
  return 0
}

function operationalLevel(days, score, status = '') {
  if (days !== null && days < 0) return 'critical'
  if (score >= 90) return 'critical'
  if (days === 0 || score >= 55 || normalize(status) === 'aguardando cliente') return 'attention'
  return 'info'
}

export function collectOperationalWork(office = {}, { day = today(), includeDone = false } = {}) {
  const clients = new Map((office.clients || []).map(client => [String(client.id), client]))
  const items = []

  ;(office.tasks || []).forEach(task => {
    const done = isDone(task.status)
    if (!includeDone && done) return
    const due = String(task.prazo || '')
    const planned = String(task.planejadoPara || '')
    const days = due ? daysBetween(day, due) : null
    const score = dueScore(days) + taskPriorityWeight(task.prioridade) + (normalize(task.status) === 'aguardando cliente' ? 8 : 0)
    items.push({
      key: `task:${task.id}`,
      type: 'task',
      kindLabel: 'Tarefa',
      id: String(task.id || ''),
      clientId: String(task.clientId || ''),
      client: task.clientId ? clientName(clients.get(String(task.clientId))) : 'Interna',
      title: task.titulo || 'Tarefa',
      subtitle: task.departamento || task.responsavel || 'Operação',
      due,
      planned,
      effectiveDate: planned || due,
      days,
      status: task.status || 'Pendente',
      priority: task.prioridade || 'Normal',
      score,
      level: operationalLevel(days, score, task.status),
      done,
      view: 'tarefas',
    })
  })

  ;(office.processes || []).forEach(process => {
    const done = processDone(process)
    if (!includeDone && done) return
    const due = String(process.prazoFinal || '')
    const days = due ? daysBetween(day, due) : null
    const score = dueScore(days) + (normalize(process.status).includes('aguard') ? 8 : 0)
    items.push({
      key: `process:${process.id}`,
      type: 'process',
      kindLabel: 'Processo',
      id: String(process.id || ''),
      clientId: String(process.clientId || ''),
      client: clientName(clients.get(String(process.clientId))),
      title: process.tipo || 'Processo',
      subtitle: process.status || 'Processo em andamento',
      due,
      planned: '',
      effectiveDate: due,
      days,
      status: process.status || 'Em andamento',
      priority: '',
      score,
      level: operationalLevel(days, score, process.status),
      done,
      view: 'processos',
    })
  })

  ;(office.obligations || []).forEach(obligation => {
    ;(obligation.clientes || []).forEach(link => {
      const done = obligationDone(link)
      if (!includeDone && done) return
      const due = String(link.vencimento || '')
      const days = due ? daysBetween(day, due) : null
      const score = dueScore(days)
      items.push({
        key: `obligation:${obligation.id}:${link.clienteId}`,
        type: 'obligation',
        kindLabel: 'Obrigação',
        id: String(obligation.id || ''),
        clientId: String(link.clienteId || ''),
        client: clientName(clients.get(String(link.clienteId))),
        title: obligation.nome || 'Obrigação',
        subtitle: obligation.categoria || link.status || 'Obrigação',
        due,
        planned: '',
        effectiveDate: due,
        days,
        status: link.status || 'Pendente',
        priority: '',
        score,
        level: operationalLevel(days, score, link.status),
        done,
        view: 'obrigacoes',
      })
    })
  })

  return items.sort((a, b) => b.score - a.score || (a.days ?? 9999) - (b.days ?? 9999) || a.title.localeCompare(b.title, 'pt-BR'))
}

export function collectCommandCenterItems(office = {}, { day = today(), daysBefore = 30 } = {}) {
  const work = collectOperationalWork(office, { day })
  const workByKey = new Map(work.map(item => [item.key, item]))
  const alerts = collectOfficeNotifications(office, { day, daysBefore }).map(alert => {
    if (alert.category === 'operation') {
      const prefix = alert.type === 'task' ? `task:${alert.id}` : alert.type === 'process' ? `process:${alert.id}` : `obligation:${alert.id}:${alert.clientId}`
      const matching = workByKey.get(prefix)
      if (matching) return matching
    }
    const score = alert.level === 'critical' ? 125 : alert.level === 'attention' ? 72 : 28
    return {
      ...alert,
      key: `alert:${alert.key}`,
      score,
      due: alert.date || '',
      planned: '',
      effectiveDate: alert.date || '',
      status: alert.kindLabel,
      priority: '',
      client: String(alert.subtitle || '').split(' · ')[0] || 'Cliente',
      view: alert.type === 'finance' || alert.type === 'partner' ? 'honorarios' : alert.type === 'task' ? 'tarefas' : alert.type === 'process' ? 'processos' : 'obrigacoes',
    }
  })

  const merged = new Map()
  ;[...work, ...alerts].forEach(item => {
    const key = item.type === 'task' ? `task:${item.id}` : item.type === 'process' ? `process:${item.id}` : item.type === 'obligation' ? `obligation:${item.id}:${item.clientId}` : item.key
    const current = merged.get(key)
    if (!current || Number(item.score || 0) > Number(current.score || 0)) merged.set(key, item)
  })
  return [...merged.values()].sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || (a.days ?? 9999) - (b.days ?? 9999))
}

export function buildMyDay(office = {}, { day = today() } = {}) {
  const all = collectCommandCenterItems(office, { day, daysBefore: 30 })
  const plannedToday = all.filter(item => item.planned === day)
  const dueToday = all.filter(item => item.due === day && item.planned !== day)
  const overdue = all.filter(item => typeof item.days === 'number' && item.days < 0)
  const critical = all.filter(item => item.level === 'critical')
  const top = [...new Map([...plannedToday, ...dueToday, ...overdue, ...critical, ...all].map(item => [item.key, item])).values()].slice(0, 5)
  return {
    day,
    top,
    plannedToday,
    dueToday,
    overdue,
    critical,
    attention: all.filter(item => item.level === 'attention'),
    all,
  }
}

export function buildWeekPlan(office = {}, { day = today() } = {}) {
  const { start, end } = weekBounds(day)
  const work = collectOperationalWork(office, { day })
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index)
    const items = work.filter(item => item.effectiveDate === date)
    return { date, items, critical: items.filter(item => item.level === 'critical').length }
  })
  return {
    start,
    end,
    days,
    unscheduled: work.filter(item => !item.effectiveDate),
    overdue: work.filter(item => item.due && item.due < day),
  }
}

function completionDateForWork(item, source) {
  if (item.type === 'task') return String(source.updatedAt || '').slice(0, 10)
  if (item.type === 'process') return String(source.dataConclusao || source.updatedAt || '').slice(0, 10)
  if (item.type === 'obligation') return String(source.concluidoEm || source.updatedAt || '').slice(0, 10)
  return ''
}

export function buildOperationalMetrics(office = {}, { day = today() } = {}) {
  const pending = collectOperationalWork(office, { day })
  const currentMonth = day.slice(0, 7)
  const monthStart = `${currentMonth}-01`
  const completedHistory = (office.history || []).filter(entry => String(entry.completedAt || '').slice(0, 10) >= addDays(day, -30))
  const openFinance = (office.finance || []).filter(charge => {
    if (normalize(charge.status) === 'cancelado') return false
    return paymentSummary(charge).balance > 0.009
  })
  const overdueFinance = openFinance.filter(charge => charge.vencimento && String(charge.vencimento) < day)
  const billedMonth = (office.finance || []).filter(charge => String(charge.competencia || charge.vencimento || '').startsWith(currentMonth) && normalize(charge.status) !== 'cancelado')
    .reduce((sum, charge) => sum + paymentSummary(charge).total, 0)
  const receivedMonth = (office.finance || []).reduce((sum, charge) => sum + paymentSummary(charge).payments.filter(payment => String(payment.data || '').startsWith(currentMonth)).reduce((inner, payment) => inner + Number(payment.valorRecebido || 0), 0), 0)
  const criticalByClient = new Map()
  pending.filter(item => item.level === 'critical' && item.clientId).forEach(item => criticalByClient.set(item.clientId, (criticalByClient.get(item.clientId) || 0) + 1))
  const clientsAtRisk = [...criticalByClient.entries()].filter(([, count]) => count >= 2).length
  const withDeadline = pending.filter(item => item.due)
  const onTimePending = withDeadline.filter(item => (item.days ?? -1) >= 0).length
  return {
    openWork: pending.length,
    overdueWork: pending.filter(item => typeof item.days === 'number' && item.days < 0).length,
    dueToday: pending.filter(item => item.due === day).length,
    waitingClient: pending.filter(item => normalize(item.status) === 'aguardando cliente').length,
    completed30: completedHistory.length,
    pendingOnTimePercent: withDeadline.length ? Math.round(onTimePending * 100 / withDeadline.length) : 100,
    clientsAtRisk,
    financeOpen: openFinance.reduce((sum, charge) => sum + paymentSummary(charge).balance, 0),
    financeOverdue: overdueFinance.reduce((sum, charge) => sum + paymentSummary(charge).balance, 0),
    billedMonth,
    receivedMonth,
    monthStart,
  }
}

function dateLabel(value) {
  const date = parseDate(value)
  return date ? date.toLocaleDateString('pt-BR') : ''
}

export function buildClientTimeline(office = {}, clientId = '') {
  const id = String(clientId || '')
  if (!id) return []
  const events = []
  const push = event => { if (event.date) events.push(event) }

  ;(office.tasks || []).filter(task => String(task.clientId || '') === id).forEach(task => {
    if (task.prazo) push({ key: `task-due-${task.id}`, type: 'task', date: task.prazo, title: task.titulo || 'Tarefa', detail: `Prazo · ${task.status || 'Pendente'}` })
    if (isDone(task.status) && task.updatedAt) push({ key: `task-done-${task.id}`, type: 'task', date: String(task.updatedAt).slice(0, 10), title: task.titulo || 'Tarefa', detail: 'Concluída/atualizada' })
  })

  ;(office.processes || []).filter(process => String(process.clientId || '') === id).forEach(process => {
    if (process.prazoFinal) push({ key: `process-due-${process.id}`, type: 'process', date: process.prazoFinal, title: process.tipo || 'Processo', detail: `Prazo · ${process.status || 'Em andamento'}` })
    if (process.dataConclusao) push({ key: `process-done-${process.id}`, type: 'process', date: String(process.dataConclusao).slice(0, 10), title: process.tipo || 'Processo', detail: 'Processo concluído' })
  })

  ;(office.obligations || []).forEach(obligation => {
    const link = (obligation.clientes || []).find(row => String(row.clienteId || '') === id)
    if (!link) return
    if (link.vencimento) push({ key: `obligation-due-${obligation.id}`, type: 'obligation', date: link.vencimento, title: obligation.nome || 'Obrigação', detail: `Vencimento · ${link.status || 'Pendente'}` })
    if (link.concluidoEm) push({ key: `obligation-done-${obligation.id}`, type: 'obligation', date: String(link.concluidoEm).slice(0, 10), title: obligation.nome || 'Obrigação', detail: 'Obrigação concluída' })
  })

  ;(office.finance || []).filter(charge => String(charge.clienteId || '') === id).forEach(charge => {
    if (charge.vencimento) push({ key: `finance-due-${charge.id}`, type: 'finance', date: charge.vencimento, title: charge.descricao || 'Cobrança', detail: `Vencimento · ${money(paymentSummary(charge).balance)} em aberto` })
    paymentSummary(charge).payments.forEach(payment => {
      if (payment.data) push({ key: `finance-pay-${charge.id}-${payment.id}`, type: 'finance', date: payment.data, title: charge.descricao || 'Cobrança', detail: `Recebimento · ${money(payment.valorRecebido)}` })
    })
  })

  ;(office.history || []).filter(entry => String(entry.clientId || '') === id || normalize(entry.client) === normalize(clientName((office.clients || []).find(client => String(client.id) === id)))).forEach(entry => {
    const date = String(entry.completedAt || '').slice(0, 10)
    if (date) push({ key: `history-${entry.id}`, type: entry.type || 'history', date, title: entry.title || 'Conclusão', detail: 'Registrado como concluído' })
  })

  return events.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title, 'pt-BR')).slice(0, 120)
}

export function replanTask(tasks = [], taskId = '', plannedDate = '', at = new Date().toISOString()) {
  return (tasks || []).map(task => {
    if (String(task.id) !== String(taskId)) return task
    const previous = String(task.planejadoPara || '')
    const history = Array.isArray(task.replanejamentoHistorico) ? [...task.replanejamentoHistorico] : []
    history.push({ de: previous || task.prazo || '', para: plannedDate || '', em: at })
    return {
      ...task,
      planejadoPara: plannedDate || '',
      replanejamentoHistorico: history.slice(-20),
      updatedAt: at,
    }
  })
}

function queryResult(title, subtitle, items = [], mode = '') {
  return { title, subtitle, items: items.slice(0, 40), mode }
}

export function answerOfficeQuery(office = {}, rawQuery = '', { day = today() } = {}) {
  const query = normalize(rawQuery)
  if (!query) return queryResult('Pergunte ao escritório', 'Digite algo como “o que vence essa semana?” ou “quem não pagou?”.', [], 'empty')
  const all = collectCommandCenterItems(office, { day, daysBefore: 45 })
  const week = buildWeekPlan(office, { day })
  const clients = office.clients || []

  if (query.includes('nao pag') || query.includes('não pag') || query.includes('inadimpl') || query.includes('cobranca venc') || query.includes('cobrança venc')) {
    const items = all.filter(item => item.type === 'finance' && typeof item.days === 'number' && item.days < 0)
    return queryResult('Cobranças vencidas', `${items.length} cobrança(s) com saldo vencido.`, items, 'finance')
  }
  if (query.includes('process') && (query.includes('parad') || query.includes('atras') || query.includes('pend'))) {
    const items = all.filter(item => item.type === 'process' && (item.days === null || item.days < 0 || !isDone(item.status)))
    return queryResult('Processos que pedem atenção', `${items.length} processo(s) em aberto encontrados.`, items, 'process')
  }
  if (query.includes('semana') || query.includes('7 dias')) {
    const items = week.days.flatMap(row => row.items)
    return queryResult('Visão da semana', `${items.length} item(ns) planejados entre ${dateLabel(week.start)} e ${dateLabel(week.end)}.`, items, 'week')
  }
  if (query.includes('hoje') || query.includes('agora')) {
    const mine = buildMyDay(office, { day })
    return queryResult('O que exige atenção hoje', `${mine.top.length} prioridade(s) principais · ${mine.overdue.length} atraso(s).`, mine.top, 'today')
  }
  if (query.includes('atras') || query.includes('pendenc') || query.includes('pendênc')) {
    const items = all.filter(item => item.level === 'critical' || (typeof item.days === 'number' && item.days < 0))
    return queryResult('Pendências críticas', `${items.length} item(ns) atrasado(s) ou crítico(s).`, items, 'critical')
  }

  const matchedClient = clients.find(client => normalize(`${clientName(client)} ${client.fantasia || ''} ${client.documento || ''}`).includes(query) || query.includes(normalize(clientName(client))))
  if (matchedClient) {
    const id = String(matchedClient.id)
    const items = all.filter(item => String(item.clientId || '') === id)
    return queryResult(clientName(matchedClient), `${items.length} pendência(s) atual(is) para este cliente.`, items, 'client')
  }

  const items = all.filter(item => normalize(`${item.title} ${item.client || ''} ${item.subtitle || ''} ${item.status || ''}`).includes(query))
  return queryResult(items.length ? 'Resultados no escritório' : 'Nada encontrado', items.length ? `${items.length} item(ns) relacionado(s) à busca.` : 'Não encontrei pendências correspondentes nos dados atuais.', items, 'search')
}
