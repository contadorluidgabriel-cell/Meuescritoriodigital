import { useMemo, useState } from 'react'
import { today } from '../lib/storage.js'
import { collectCalendarEvents, monthGrid } from '../lib/calendarEvents.js'

const weekdays = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']
const capitalizeFirst = value => value ? value.charAt(0).toUpperCase() + value.slice(1) : ''

function initialMonth() {
  const date = new Date(`${today()}T12:00:00`)
  date.setDate(1)
  return date
}

function moveMonth(date, amount) {
  const next = new Date(date)
  next.setDate(1)
  next.setMonth(next.getMonth() + amount)
  return next
}

function EventButton({ event, onOpen, currentDay, list = false }) {
  const overdue = !event.done && event.date < currentDay
  const state = event.done ? 'Concluído' : overdue ? 'Atrasado' : 'Abrir registro'
  return <button type="button" className={`${list ? 'calendar-list-event' : 'calendar-month-event'} ${event.type} ${event.done ? 'done' : ''} ${overdue ? 'overdue' : ''}`} onClick={() => onOpen(event)} title={`${event.label} · ${event.client}`} aria-label={`${event.label}. ${state}`}>
    {list ? <><span><i className={`calendar-type-dot ${event.type}`} />{event.label}<small>{event.client} · {event.status}</small></span><em>{state}</em></> : event.label}
  </button>
}

export default function CalendarReact({ office, update, sync, onOpenEvent }) {
  const [referenceDate, setReferenceDate] = useState(initialMonth)
  const [mode, setModeState] = useState(() => office.ui?.calendarMode === 'list' ? 'list' : 'month')
  const currentDay = today()
  const events = useMemo(() => collectCalendarEvents(office), [office.clients, office.obligations, office.processes, office.tasks])
  const monthPrefix = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}`
  const monthEvents = useMemo(() => events.filter(event => event.date.startsWith(monthPrefix)), [events, monthPrefix])
  const eventsByDate = useMemo(() => {
    const map = new Map()
    monthEvents.forEach(event => map.set(event.date, [...(map.get(event.date) || []), event]))
    return map
  }, [monthEvents])
  const days = useMemo(() => monthGrid(referenceDate), [referenceDate])
  const datesWithEvents = useMemo(() => [...eventsByDate.keys()].sort(), [eventsByDate])
  const title = capitalizeFirst(referenceDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))

  function setMode(nextMode) {
    setModeState(nextMode)
    update(draft => { draft.ui ||= {}; draft.ui.calendarMode = nextMode })
  }

  return <div className="react-module-page calendar-page">
    <div className="react-module-topbar">
      <div><h1>Calendário</h1><p>Derivado automaticamente de tarefas, processos e vencimentos de obrigações.</p></div>
      <div className="react-module-actions calendar-actions">
        <span className="sync-indicator">{sync}</span>
        <div className="calendar-view-switch" aria-label="Visualização do calendário">
          <button type="button" className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>Mês</button>
          <button type="button" className={mode === 'list' ? 'active' : ''} onClick={() => setMode('list')}>Lista</button>
        </div>
        <div className="calendar-navigation">
          <button type="button" onClick={() => setReferenceDate(current => moveMonth(current, -1))} aria-label="Mês anterior" title="Mês anterior">‹</button>
          <button type="button" onClick={() => setReferenceDate(initialMonth())}>Hoje</button>
          <button type="button" onClick={() => setReferenceDate(current => moveMonth(current, 1))} aria-label="Próximo mês" title="Próximo mês">›</button>
        </div>
      </div>
    </div>

    <section className="calendar-card">
      <header className="calendar-card-head">
        <div><h2>{title}</h2><p>{monthEvents.length} prazo(s) no mês</p></div>
        <div className="calendar-legend" aria-label="Legenda"><span className="task">Tarefas</span><span className="process">Processos</span><span className="obligation">Obrigações</span></div>
      </header>

      {mode === 'month' ? <div className="calendar-scroll"><div className="calendar-month-grid">
        {weekdays.map(day => <div className="calendar-weekday" key={day}>{day}</div>)}
        {days.map((date, index) => date ? <div className={`calendar-day ${date === currentDay ? 'today' : ''}`} key={date}><b>{Number(date.slice(-2))}</b><div>{(eventsByDate.get(date) || []).map(event => <EventButton event={event} onOpen={onOpenEvent} currentDay={currentDay} key={event.key} />)}</div></div> : <div className="calendar-day empty" aria-hidden="true" key={`empty-${index}`} />)}
      </div></div> : <div className="calendar-list">
        {datesWithEvents.map(date => <section className="calendar-list-day" key={date}><h3>{capitalizeFirst(new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }))}</h3><div>{eventsByDate.get(date).map(event => <EventButton event={event} onOpen={onOpenEvent} currentDay={currentDay} list key={event.key} />)}</div></section>)}
        {!datesWithEvents.length ? <div className="calendar-empty"><b>Nenhum prazo neste mês.</b><span>Use as setas para consultar outro período.</span></div> : null}
      </div>}
    </section>
  </div>
}
