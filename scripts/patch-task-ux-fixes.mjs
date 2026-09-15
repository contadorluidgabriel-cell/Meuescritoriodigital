import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label, path) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`Task UX patch failed (${label}) in ${path}`)
  return source.replace(from, to)
}

export function applyTaskUxFixesPatch(root) {
  const commandPath = `${root}src/components/OperationalCommandCenter.jsx`
  let command = readFileSync(commandPath, 'utf8')

  command = replaceRequired(
    command,
    "import PendingInbox from './PendingInbox.jsx'",
    "import PendingInbox from './PendingInbox.jsx'\nimport QuickTaskCreate from './QuickTaskCreate.jsx'",
    'quick task import',
    commandPath,
  )

  command = replaceRequired(
    command,
    "  const [notice, setNotice] = useState('')",
    "  const [notice, setNotice] = useState('')\n  const [quickTaskOpen, setQuickTaskOpen] = useState(false)\n  const canCreateTask = access?.membership?.role !== 'partner' && access?.membership?.permissions?.tasks !== false",
    'quick task state',
    commandPath,
  )

  command = replaceRequired(
    command,
    "      <div className=\"occ-hero-actions\"><button type=\"button\" onClick={() => onNavigate('tarefas')}><Icon name=\"tasks\" size={17} /> Tarefas</button><button type=\"button\" className=\"secondary\" onClick={() => onNavigate('calendario')}><Icon name=\"calendar\" size={17} /> Calendário</button></div>",
    "      <div className=\"occ-hero-actions\">{canCreateTask ? <button type=\"button\" className=\"primary\" onClick={() => setQuickTaskOpen(true)}><Icon name=\"plus\" size={17} /> Nova tarefa</button> : null}<button type=\"button\" onClick={() => onNavigate('tarefas')}><Icon name=\"tasks\" size={17} /> Tarefas</button><button type=\"button\" className=\"secondary\" onClick={() => onNavigate('calendario')}><Icon name=\"calendar\" size={17} /> Calendário</button></div>",
    'quick task action',
    commandPath,
  )

  command = replaceRequired(
    command,
    "  return <div className=\"occ-shell occ-v123\">\n    {notice ? <div className=\"occ-toast\">{notice}</div> : null}",
    "  return <div className=\"occ-shell occ-v123\">\n    {quickTaskOpen ? <QuickTaskCreate office={office} update={update} day={day} onClose={() => setQuickTaskOpen(false)} onCreated={task => setNotice(`Tarefa ${task.titulo ? `“${task.titulo}” ` : ''}criada no Meu Dia.`)} /> : null}\n    {notice ? <div className=\"occ-toast\">{notice}</div> : null}",
    'quick task modal',
    commandPath,
  )

  writeFileSync(commandPath, command)
}
