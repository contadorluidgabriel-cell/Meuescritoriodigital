import { isDone } from './storage.js'

const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'

export function collectCalendarEvents(office) {
  const clients = new Map((office.clients || []).map(client => [String(client.id), clientName(client)]))
  const events = []

  ;(office.tasks || []).forEach(task => {
    if (!task.prazo) return
    events.push({
      key: `task|${task.id}`,
      date: task.prazo,
      label: `Tarefa · ${task.titulo || 'Sem título'}`,
      type: 'task',
      id: String(task.id),
      clientId: String(task.clientId || ''),
      client: task.clientId ? clients.get(String(task.clientId)) || 'Cliente' : 'Interna',
      done: isDone(task.status),
      status: task.status || 'Pendente',
    })
  })

  ;(office.processes || []).forEach(process => {
    if (!process.prazoFinal) return
    events.push({
      key: `process|${process.id}`,
      date: process.prazoFinal,
      label: `Processo · ${process.tipo || 'Sem tipo'}`,
      type: 'process',
      id: String(process.id),
      clientId: String(process.clientId || ''),
      client: clients.get(String(process.clientId)) || 'Cliente',
      done: isDone(process.status),
      status: process.status || 'Novo',
    })
  })

  ;(office.obligations || []).forEach(obligation => {
    ;(obligation.clientes || []).forEach(link => {
      if (!link.vencimento) return
      const linkClient = clients.get(String(link.clienteId)) || 'Cliente'
      events.push({
        key: `obligation|${obligation.id}|${link.clienteId}`,
        date: link.vencimento,
        label: `Obrigação · ${obligation.nome || 'Sem nome'} · ${linkClient}`,
        type: 'obligation',
        id: String(obligation.id),
        clientId: String(link.clienteId || ''),
        client: linkClient,
        done: isDone(link.status) || link.status === 'Não se aplica',
        status: link.status || 'Pendente',
      })
    })
  })

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label, 'pt-BR'))
}

export function monthGrid(referenceDate) {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const leading = (new Date(year, month, 1).getDay() + 6) % 7
  const lastDay = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((leading + lastDay) / 7) * 7
  return Array.from({ length: totalCells }, (_, index) => {
    const day = index - leading + 1
    if (day < 1 || day > lastDay) return null
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  })
}
