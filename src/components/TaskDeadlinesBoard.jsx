import { useEffect, useMemo, useState } from 'react'
import { today } from '../lib/storage.js'
import { TASK_DEADLINE_FILTERS, buildTaskDeadlineView, taskDeadlineMeta } from '../lib/taskDeadlines.js'
import { TASK_ADVANCE_OPTIONS, taskAdvanceMeta } from '../lib/taskAdvance.js'
import { undoTaskCompletion } from '../lib/taskExecution.js'
import TaskQuickExecution from './TaskQuickExecution.jsx'
import '../task-deadlines.css'

const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : ''
const clientLabel = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'

function uniqueValues(tasks, field) {
  return [...new Set((tasks || []).map(task => String(task?.[field] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

function DeadlineCard({ task, clientsById, tasks, update, onOpenTask, onNotice, onCompleted, day }) {
  const meta = taskDeadlineMeta(task, day)
  const advance = taskAdvanceMeta(task, day)
  const client = task.clientId ? clientLabel(clientsById.get(String(task.clientId))) : 'Tarefa interna'

  function changeAdvance(event) {
    const value = Math.max(0, Math.min(90, Number(event.target.value) || 0))
    update(draft => {
      const current = (draft.tasks || []).find(row => String(row.id || '') === String(task.id || ''))
      if (!current) return
      current.antecedenciaDias = value
    })
    onNotice?.(value
      ? `Antecedência definida em ${value} ${value === 1 ? 'dia' : 'dias'}.`
      : 'Antecedência removida; a tarefa entra no Meu Dia no próprio prazo.')
  }

  return <article className={`task-deadline-card tone-${meta.tone}`}>
    <div className="task-deadline-copy">
      <div className="task-deadline-tags">
        <span>Tarefa</span>
        {task.status ? <b className={String(task.status).toLowerCase().includes('aguardando') ? 'waiting' : ''}>{task.status}</b> : null}
        {task.prioridade ? <b>{task.prioridade}</b> : null}
        {advance.active && advance.days ? <b className="advance-active">No Meu Dia</b> : null}
      </div>
      <strong>{task.titulo || 'Tarefa sem título'}</strong>
      <small>{client}{task.departamento ? ` · ${task.departamento}` : ''}{task.responsavel ? ` · ${task.responsavel}` : ''}</small>
      <div className="task-deadline-date-row">
        <span className={`deadline-${meta.tone}`}>{meta.label}</span>
        {meta.due ? <small>Prazo {dateLabel(meta.due)}</small> : null}
        {meta.planned && meta.planned !== meta.due ? <small>Planejada {dateLabel(meta.planned)}</small> : null}
        {advance.days && advance.start ? <small>Entra no Meu Dia em {dateLabel(advance.start)}</small> : null}
      </div>
      <label className={`task-advance-control ${!meta.due ? 'is-disabled' : ''}`}>
        <span>Antecedência no Meu Dia</span>
        <select value={advance.days} onChange={changeAdvance} disabled={!meta.due} aria-label={`Antecedência da tarefa ${task.titulo || ''}`}>
          {TASK_ADVANCE_OPTIONS.map(value => <option value={value} key={value}>{value === 0 ? 'No dia do prazo' : `${value} ${value === 1 ? 'dia antes' : 'dias antes'}`}</option>)}
        </select>
        {!meta.due ? <small>Defina um prazo para usar antecedência.</small> : <small>Do início dessa janela até concluir, a tarefa aparece no Hoje.</small>}
      </label>
    </div>
    <TaskQuickExecution
      task={task}
      tasks={tasks}
      clients={[...clientsById.values()]}
      update={update}
      onOpen={() => onOpenTask?.(task.id)}
      onNotice={onNotice}
      onCompleted={onCompleted}
      compact
    />
  </article>
}

export default function TaskDeadlinesBoard({ office, update, onNavigate, onOpenTask, day = today() }) {
  const [scope, setScope] = useState('all')
  const [clientId, setClientId] = useState('')
  const [responsible, setResponsible] = useState('')
  const [department, setDepartment] = useState('')
  const [notice, setNotice] = useState('')
  const [undoState, setUndoState] = useState(null)
  const tasks = office?.tasks || []
  const clients = office?.clients || []
  const clientsById = useMemo(() => new Map(clients.map(client => [String(client.id), client])), [clients])
  const responsibleOptions = useMemo(() => uniqueValues(tasks, 'responsavel'), [tasks])
  const departmentOptions = useMemo(() => uniqueValues(tasks, 'departamento'), [tasks])
  const clientOptions = useMemo(() => clients
    .filter(client => tasks.some(task => String(task.clientId || '') === String(client.id)))
    .sort((a, b) => clientLabel(a).localeCompare(clientLabel(b), 'pt-BR')), [clients, tasks])
  const view = useMemo(() => buildTaskDeadlineView(tasks, { day, scope, clientId, responsible, department }), [tasks, day, scope, clientId, responsible, department])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => { setNotice(''); setUndoState(null) }, undoState ? 6000 : 3000)
    return () => clearTimeout(timer)
  }, [notice, undoState])

  function registerCompletion(transaction, title) {
    if (transaction) setUndoState({ transaction, title })
  }

  function undoCompletion() {
    if (!undoState?.transaction) return
    const result = undoTaskCompletion(office.tasks || [], undoState.transaction)
    if (!result.changed) { setNotice(result.error || 'Não foi possível desfazer.'); return }
    update(draft => { draft.tasks = result.tasks })
    setUndoState(null)
    setNotice('Conclusão desfeita.')
  }

  function clearContextFilters() {
    setClientId('')
    setResponsible('')
    setDepartment('')
  }

  const hasContextFilter = Boolean(clientId || responsible || department)

  return <section className="task-deadlines-board" aria-label="Prazos das tarefas">
    {notice ? <div className="task-deadline-toast"><span>{notice}</span>{undoState ? <button type="button" onClick={undoCompletion}>Desfazer</button> : null}</div> : null}

    <header className="task-deadlines-header">
      <div>
        <span>Controle operacional</span>
        <h2>Prazos das tarefas</h2>
        <p>Defina o prazo e, quando precisar começar antes, escolha a antecedência. Durante essa janela a tarefa passa a aparecer no Meu Dia até ser concluída.</p>
      </div>
      {onNavigate ? <button type="button" className="task-deadline-calendar" onClick={() => onNavigate('calendario')}>Ver calendário</button> : null}
    </header>

    <nav className="task-deadline-scopes" aria-label="Filtrar tarefas por prazo">
      {TASK_DEADLINE_FILTERS.map(([id, label]) => <button type="button" className={scope === id ? 'active' : ''} onClick={() => setScope(id)} key={id}>
        <span>{label}</span><b>{view.counts[id] || 0}</b>
      </button>)}
    </nav>

    <div className="task-deadline-context-filters">
      <label><span>Cliente</span><select value={clientId} onChange={event => setClientId(event.target.value)}><option value="">Todos</option>{clientOptions.map(client => <option value={String(client.id)} key={client.id}>{clientLabel(client)}</option>)}</select></label>
      <label><span>Responsável</span><select value={responsible} onChange={event => setResponsible(event.target.value)}><option value="">Todos</option>{responsibleOptions.map(value => <option value={value} key={value}>{value}</option>)}</select></label>
      <label><span>Departamento</span><select value={department} onChange={event => setDepartment(event.target.value)}><option value="">Todos</option>{departmentOptions.map(value => <option value={value} key={value}>{value}</option>)}</select></label>
      {hasContextFilter ? <button type="button" className="task-deadline-clear" onClick={clearContextFilters}>Limpar filtros</button> : null}
    </div>

    <div className="task-deadline-summary"><strong>{view.total}</strong><span>{view.total === 1 ? 'tarefa encontrada' : 'tarefas encontradas'}</span></div>

    <div className="task-deadline-list">
      {view.tasks.length ? view.tasks.map(task => <DeadlineCard key={task.id} task={task} clientsById={clientsById} tasks={tasks} update={update} onOpenTask={onOpenTask} onNotice={setNotice} onCompleted={registerCompletion} day={day} />) : <div className="task-deadline-empty"><span>✓</span><strong>Nenhuma tarefa neste filtro.</strong><small>Altere o período ou os filtros de cliente, responsável e departamento.</small></div>}
    </div>
  </section>
}
