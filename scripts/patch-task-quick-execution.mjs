import { readFileSync, writeFileSync } from 'node:fs'

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Task quick execution patch failed (${label})`)
  return source.replace(from, to)
}

function replaceBlock(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)
  if (start < 0 || end < 0) throw new Error(`Task quick execution patch failed (${label})`)
  return source.slice(0, start) + replacement + source.slice(end)
}

export function applyTaskQuickExecutionPatch(root) {
  const commandPath = `${root}src/components/OperationalCommandCenter.jsx`
  let command = readFileSync(commandPath, 'utf8')
  if (!command.includes("TaskQuickExecution from './TaskQuickExecution.jsx'")) {
    command = replaceOrFail(command,
      "} from '../lib/operationalIntelligence.js'\n",
      "} from '../lib/operationalIntelligence.js'\nimport TaskQuickExecution from './TaskQuickExecution.jsx'\nimport { undoTaskCompletion } from '../lib/taskExecution.js'\n",
      'command imports',
    )

    const workCard = `function WorkCard({ item, day, onOpen, tasks, update, onNotice, onCompleted, compact = false }) {
  const task = item.type === 'task' ? (tasks || []).find(candidate => String(candidate.id) === String(item.id)) : null
  return <article className={'occ-work-card level-' + item.level + (compact ? ' compact' : '')}>
    <div className="occ-work-main">
      <div className="occ-work-tags"><LevelBadge level={item.level} /><span className={'occ-kind type-' + item.type}>{item.kindLabel || (item.type === 'finance' ? 'Financeiro' : item.type === 'partner' ? 'Parceiro' : 'Item')}</span>{item.priority && item.priority !== 'Normal' ? <span className="occ-priority">{item.priority}</span> : null}</div>
      <strong>{item.title}</strong>
      <small>{item.client || 'Escritório'}{item.subtitle && !String(item.subtitle).startsWith(String(item.client || '')) ? ' · ' + item.subtitle : ''}</small>
      <p>{deadlineText(item, day)}</p>
      {task ? <TaskQuickExecution task={task} tasks={tasks} update={update} onOpen={() => onOpen(item)} onNotice={onNotice} onCompleted={onCompleted} compact={compact} /> : null}
    </div>
    {!task ? <div className="occ-work-actions"><button type="button" onClick={() => onOpen(item)}>Abrir</button></div> : null}
  </article>
}

`
    command = replaceBlock(command, 'function WorkCard(', 'function Empty', workCard, 'command work card')

    command = replaceOrFail(command,
      "  const [notice, setNotice] = useState('')",
      "  const [notice, setNotice] = useState('')\n  const [undoState, setUndoState] = useState(null)",
      'command undo state',
    )
    command = replaceOrFail(command,
      "  useEffect(() => {\n    if (!notice) return undefined\n    const timer = setTimeout(() => setNotice(''), 2800)\n    return () => clearTimeout(timer)\n  }, [notice])",
      "  useEffect(() => {\n    if (!notice) return undefined\n    const timer = setTimeout(() => { setNotice(''); setUndoState(null) }, undoState ? 6000 : 2800)\n    return () => clearTimeout(timer)\n  }, [notice, undoState])",
      'command notice timer',
    )
    command = replaceOrFail(command,
      "  function submitQuery(event) {",
      "  function registerQuickCompletion(transaction, title) {\n    if (transaction) setUndoState({ transaction, title })\n  }\n\n  function undoQuickCompletion() {\n    if (!undoState?.transaction) return\n    const result = undoTaskCompletion(office.tasks || [], undoState.transaction)\n    if (!result.changed) { setNotice(result.error || 'Não foi possível desfazer.'); return }\n    update(draft => { draft.tasks = result.tasks })\n    setUndoState(null)\n    setNotice('Conclusão desfeita.')\n  }\n\n  function submitQuery(event) {",
      'command undo handler',
    )
    command = replaceOrFail(command,
      "    {notice ? <div className=\"occ-toast\">{notice}</div> : null}",
      "    {notice ? <div className=\"occ-toast task-quick-toast\"><span>{notice}</span>{undoState ? <button type=\"button\" onClick={undoQuickCompletion}>Desfazer</button> : null}</div> : null}",
      'command undo toast',
    )
    command = command.replaceAll(
      '<WorkCard key={item.key} item={item} day={day} onOpen={onOpenItem} onPlanTomorrow={planTomorrow} onClearPlan={clearPlan} />',
      '<WorkCard key={item.key} item={item} day={day} onOpen={onOpenItem} tasks={office.tasks || []} update={update} onNotice={setNotice} onCompleted={registerQuickCompletion} />',
    )
    writeFileSync(commandPath, command)
  }

  const calendarPath = `${root}src/components/CalendarReact.jsx`
  let calendar = readFileSync(calendarPath, 'utf8')
  if (!calendar.includes("TaskQuickExecution from './TaskQuickExecution.jsx'")) {
    calendar = replaceOrFail(calendar,
      "import { useMemo, useState } from 'react'",
      "import { useEffect, useMemo, useState } from 'react'",
      'calendar useEffect',
    )
    calendar = replaceOrFail(calendar,
      "import { collectCalendarEvents, monthGrid } from '../lib/calendarEvents.js'",
      "import { collectCalendarEvents, monthGrid } from '../lib/calendarEvents.js'\nimport TaskQuickExecution from './TaskQuickExecution.jsx'\nimport { undoTaskCompletion } from '../lib/taskExecution.js'",
      'calendar imports',
    )

    const eventButton = `function EventButton({ event, onOpen, onQuickTask, currentDay, list = false }) {
  const overdue = !event.done && event.date < currentDay
  const state = event.done ? 'Concluído' : overdue ? 'Atrasado' : event.type === 'task' ? 'Executar' : 'Abrir registro'
  return <button type="button" className={(list ? 'calendar-list-event' : 'calendar-month-event') + ' ' + event.type + (event.done ? ' done' : '') + (overdue ? ' overdue' : '')} onClick={() => event.type === 'task' ? onQuickTask(event) : onOpen(event)} title={event.label + ' · ' + event.client} aria-label={event.label + '. ' + state}>
    {list ? <><span><i className={'calendar-type-dot ' + event.type} />{event.label}<small>{event.client} · {event.status}</small></span><em>{state}</em></> : event.label}
  </button>
}

`
    calendar = replaceBlock(calendar, 'function EventButton(', 'export default function CalendarReact', eventButton, 'calendar event button')
    calendar = replaceOrFail(calendar,
      "  const [mode, setModeState] = useState(() => office.ui?.calendarMode === 'list' ? 'list' : 'month')",
      "  const [mode, setModeState] = useState(() => office.ui?.calendarMode === 'list' ? 'list' : 'month')\n  const [selectedTaskEvent, setSelectedTaskEvent] = useState(null)\n  const [notice, setNotice] = useState('')\n  const [undoState, setUndoState] = useState(null)",
      'calendar quick state',
    )
    calendar = replaceOrFail(calendar,
      "  const title = capitalizeFirst(referenceDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))",
      "  const title = capitalizeFirst(referenceDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))\n  const selectedTask = useMemo(() => selectedTaskEvent ? (office.tasks || []).find(task => String(task.id) === String(selectedTaskEvent.id)) : null, [office.tasks, selectedTaskEvent])\n\n  useEffect(() => {\n    if (!notice) return undefined\n    const timer = setTimeout(() => { setNotice(''); setUndoState(null) }, undoState ? 6000 : 2800)\n    return () => clearTimeout(timer)\n  }, [notice, undoState])",
      'calendar selected task',
    )
    calendar = replaceOrFail(calendar,
      "  return <div className=\"react-module-page calendar-page\">",
      "  function registerQuickCompletion(transaction, taskTitle) { if (transaction) setUndoState({ transaction, title: taskTitle }) }\n  function undoQuickCompletion() {\n    if (!undoState?.transaction) return\n    const result = undoTaskCompletion(office.tasks || [], undoState.transaction)\n    if (!result.changed) { setNotice(result.error || 'Não foi possível desfazer.'); return }\n    update(draft => { draft.tasks = result.tasks })\n    setUndoState(null)\n    setNotice('Conclusão desfeita.')\n  }\n\n  return <div className=\"react-module-page calendar-page\">\n    {notice ? <div className=\"occ-toast task-quick-toast\"><span>{notice}</span>{undoState ? <button type=\"button\" onClick={undoQuickCompletion}>Desfazer</button> : null}</div> : null}",
      'calendar handlers',
    )
    calendar = replaceOrFail(calendar,
      "      </header>\n\n      {mode === 'month' ?",
      "      </header>\n\n      {selectedTaskEvent && selectedTask ? <section className=\"calendar-task-quick-panel\"><header><div><span>Execução rápida</span><strong>{selectedTask.titulo || 'Tarefa'}</strong><small>{selectedTaskEvent.client} · {selectedTaskEvent.date}</small></div><button type=\"button\" onClick={() => setSelectedTaskEvent(null)} aria-label=\"Fechar execução rápida\">×</button></header><TaskQuickExecution task={selectedTask} tasks={office.tasks || []} update={update} onOpen={() => onOpenEvent(selectedTaskEvent)} onNotice={setNotice} onCompleted={registerQuickCompletion} /></section> : null}\n\n      {mode === 'month' ?",
      'calendar quick panel',
    )
    calendar = calendar.replaceAll(
      '<EventButton event={event} onOpen={onOpenEvent} currentDay={currentDay}',
      '<EventButton event={event} onOpen={onOpenEvent} onQuickTask={setSelectedTaskEvent} currentDay={currentDay}',
    )
    writeFileSync(calendarPath, calendar)
  }

  const cssPath = `${root}src/calendar-react.css`
  let css = readFileSync(cssPath, 'utf8')
  if (!css.includes('.calendar-task-quick-panel')) {
    css += `\n.calendar-task-quick-panel{display:grid;gap:10px;margin:0 18px 14px;padding:14px 16px;border:1px solid #dbe2ec;border-radius:14px;background:#fff;box-shadow:0 8px 24px #0f172a0d}.calendar-task-quick-panel>header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.calendar-task-quick-panel>header>div{display:grid;gap:2px}.calendar-task-quick-panel>header span{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#2456e8}.calendar-task-quick-panel>header strong{font-size:14px;color:#0f172a}.calendar-task-quick-panel>header small{font-size:11px;color:#64748b}.calendar-task-quick-panel>header>button{border:0;background:#f7f8fa;width:30px;height:30px;border-radius:8px;font-size:18px;cursor:pointer}.task-quick-toast{display:flex!important;align-items:center;justify-content:space-between;gap:14px}.task-quick-toast button{border:0;border-radius:8px;background:#fff;color:#2456e8;padding:6px 10px;font-weight:800;cursor:pointer}@media(max-width:600px){.calendar-task-quick-panel{margin:0 10px 12px;padding:12px}.task-quick-toast{align-items:flex-start}}\n`
    writeFileSync(cssPath, css)
  }
}
