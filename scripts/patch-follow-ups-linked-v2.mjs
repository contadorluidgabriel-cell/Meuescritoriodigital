import { readFileSync, writeFileSync } from 'node:fs'

const replace = (text, from, to, label) => {
  if (!text.includes(from)) throw new Error(`Follow-ups V2: missing ${label}`)
  return text.replace(from, to)
}
function file(root, path, mutate) {
  const full = `${root}${path}`
  let source = readFileSync(full, 'utf8')
  if (source.includes('MED_RESULT_FOLLOWUPS_LINKED_V2')) return
  source = mutate(source)
  writeFileSync(full, source)
}
const tag = '// MED_RESULT_FOLLOWUPS_LINKED_V2\n'

export function applyFollowUpsLinkedV2(root) {
  file(root, 'src/App.jsx', app => {
    app = replace(app, "import FollowUpsWorkspace, { FollowUpsToday } from './components/FollowUpsWorkspace.jsx'", "import FollowUpsWorkspace, { FollowUpsToday } from './components/FollowUpsWorkspace.jsx'\n" + tag, 'app import')
    app = replace(app, "  const [followUpTarget, setFollowUpTarget] = useState({ id: '', request: 0 })", "  const [followUpTarget, setFollowUpTarget] = useState({ id: '', request: 0 })\n  const [followUpDraft, setFollowUpDraft] = useState({ data: null, request: 0 })", 'draft state')
    app = replace(app, '  function openFollowUp(id) {', "  function startFollowUpFromWork(data) {\n    setFollowUpDraft(current => ({ data, request: current.request + 1 }))\n    setFollowUpTarget({ id: '', request: 0 })\n    setView('acompanhamentos')\n  }\n\n  function openFollowUp(id) {", 'completion routing')
    app = replace(app, '<FollowUpsWorkspace office={office}', '<FollowUpsWorkspace createDraft={followUpDraft.data} createRequest={followUpDraft.request} office={office}', 'draft route')
    app = replace(app, '<ClientsReact office={office}', '<ClientsReact followUps={followUps} onOpenFollowUp={openFollowUp} office={office}', 'clients route')
    app = replace(app, '<ProcessesReact office={office}', '<ProcessesReact followUps={followUps} onOpenFollowUp={openFollowUp} onStartFollowUp={startFollowUpFromWork} office={office}', 'process route')
    app = replace(app, '<TasksReact office={office}', '<TasksReact followUps={followUps} onOpenFollowUp={openFollowUp} onStartFollowUp={startFollowUpFromWork} office={office}', 'tasks route')
    return app
  })
  file(root, 'src/components/FollowUpsWorkspace.jsx', source => {
    source = tag + source
    source = replace(source, "focusId = '', focusRequest = 0 })", "focusId = '', focusRequest = 0, createDraft = null, createRequest = 0 })", 'draft props')
    source = replace(source, '  useEffect(() => { if (focusRequest && focusId)', "  useEffect(() => { if (createRequest && createDraft) { setForm({ ...blank(), ...createDraft }); setSelectedId(''); setTab('active') } }, [createRequest])\n  useEffect(() => { if (focusRequest && focusId)", 'draft effect')
    return source
  })
  file(root, 'src/components/ProcessesReact.jsx', source => {
    source = "import FollowUpLinked from './FollowUpLinked.jsx'\n" + tag + source
    source = replace(source, 'function ProcessEditor({ process, office, onClose, onSave }) {', 'function ProcessEditor({ process, office, onClose, onSave, followUps }) {', 'editor props')
    const status = /(<Field label="Status"><select value={draft\.status}[\s\S]*?<\/select><\/Field>)/
    if (!status.test(source)) throw new Error('Follow-ups V2: process status missing')
    source = source.replace(status, `$1{draft.status === 'Concluído' && !followUps?.records?.some(row => row.status === 'active' && row.sourceType === 'process' && String(row.sourceId) === String(draft.id)) ? <Field label="Acompanhar resultado" full><div className="third-party-toggle"><label><input type="checkbox" checked={Boolean(draft.followUpRequested)} onChange={event => setField('followUpRequested', event.target.checked)} /> Quero lembrar de conferir o resultado deste processo</label></div>{draft.followUpRequested ? <input type="date" aria-label="Data da conferência do resultado" required value={draft.followUpDate || today()} onChange={event => setField('followUpDate', event.target.value)} /> : null}</Field> : null}`)
    source = replace(source, 'function ProcessDetails({ process, clientsById, update, onClose }) {', 'function ProcessDetails({ process, clientsById, update, onClose, followUps, onOpenFollowUp }) {', 'detail props')
    source = replace(source, '<div className="process-meta">', '<FollowUpLinked records={followUps?.records} sourceType="process" sourceId={process.id} onOpen={onOpenFollowUp} /><div className="process-meta">', 'process linked panel')
    const signature = /export default function ProcessesReact\(\{([^}]*)\}\) \{/
    if (!signature.test(source)) throw new Error('Follow-ups V2: process signature missing')
    source = source.replace(signature, (_all, props) => `export default function ProcessesReact({ ${props.trim()}, followUps, onOpenFollowUp, onStartFollowUp }) {`)
    const save = /  function saveProcess\(process\) \{[^\n]+\}/
    if (!save.test(source)) throw new Error('Follow-ups V2: save process missing')
    const newSave = [
      '  function saveProcess(process) {',
      '    const { followUpRequested, followUpDate, ...cleanProcess } = process',
      "    const normalized = initializeProcessPlanning({ ...cleanProcess, previsaoConclusaoInicial: cleanProcess.previsaoConclusaoInicial || cleanProcess.previsaoConclusao || '' }, cleanProcess.dataAbertura || today())",
      "    const saved = normalized.id ? normalized : { ...normalized, id: uid('proc') }",
      '    update(draft => { draft.processes = normalized.id ? draft.processes.map(item => String(item.id) === String(saved.id) ? saved : item) : [...draft.processes, saved] })',
      "    setEditing(null); setNotice('Processo salvo.')",
      "    if (followUpRequested && saved.status === 'Concluído') onStartFollowUp?.({ sourceType: 'process', sourceId: saved.id, clientId: saved.clientId, title: 'Verificar resultado: ' + saved.tipo, checkDate: followUpDate || today() })",
      '  }',
    ].join('\n')
    source = source.replace(save, newSave)
    source = replace(source, 'onSave={saveProcess} key={editing.id', 'onSave={saveProcess} followUps={followUps} key={editing.id', 'editor call')
    source = replace(source, '<ProcessDetails process={detailProcess} clientsById={clientsById} update={update}', '<ProcessDetails process={detailProcess} clientsById={clientsById} followUps={followUps} onOpenFollowUp={onOpenFollowUp} update={update}', 'detail call')
    return source
  })
  file(root, 'src/components/TasksReactBase.jsx', source => {
    source = "import FollowUpLinked from './FollowUpLinked.jsx'\n" + tag + source
    const signature = /export default function TasksReact\(\{([^}]*)\}\) \{/
    if (!signature.test(source)) throw new Error('Follow-ups V2: task signature missing')
    source = source.replace(signature, (_all, props) => `export default function TasksReact({ ${props.trim()}, followUps, onOpenFollowUp, onStartFollowUp }) {`)
    const status = /(<Field label="Status"><select value={editing\.status}[\s\S]*?<\/select><\/Field>)/
    if (!status.test(source)) throw new Error('Follow-ups V2: task status missing')
    source = source.replace(status, `$1{isDone(editing.status) && !followUps?.records?.some(row => row.status === 'active' && row.sourceType === 'task' && String(row.sourceId) === String(editing.id)) ? <Field label="Acompanhar resultado" full><div className="third-party-toggle"><label><input type="checkbox" checked={Boolean(editing.followUpRequested)} onChange={event => setField('followUpRequested', event.target.checked)} /> Quero lembrar de conferir o resultado deste serviço</label></div>{editing.followUpRequested ? <input type="date" aria-label="Data da conferência do resultado" required value={editing.followUpDate || today()} onChange={event => setField('followUpDate', event.target.value)} /> : null}</Field> : null}`)
    source = replace(source, "    setNotice('Tarefa salva.')\n  }", "    setNotice('Tarefa salva.')\n    if (editing.followUpRequested && isDone(task.status)) onStartFollowUp?.({ sourceType: 'task', sourceId: task.id, clientId: task.clientId, title: 'Verificar resultado: ' + task.titulo, checkDate: editing.followUpDate || today() })\n  }", 'task save connection')
    return source
  })
  file(root, 'src/components/ClientsReact.jsx', source => {
    source = "import FollowUpLinked from './FollowUpLinked.jsx'\n" + tag + source
    const signature = /export default function ClientsReact\(\{([^}]*)\}\) \{/
    if (!signature.test(source)) throw new Error('Follow-ups V2: client signature missing')
    source = source.replace(signature, (_all, props) => `export default function ClientsReact({ ${props.trim()}, followUps, onOpenFollowUp }) {`)
    source = replace(source, 'onOpenFinance={create => onOpenFinance?.(details.id, create)} />', 'onOpenFinance={create => onOpenFinance?.(details.id, create)} followUps={followUps} onOpenFollowUp={onOpenFollowUp} />', 'client details call')
    source = replace(source, 'function ClientDetails({ client, office, access, onRefresh, onClose, onEdit, onOpenTasks, onNewProcess, onOpenProcess, onOpenFinance }) {', 'function ClientDetails({ client, office, access, onRefresh, onClose, onEdit, onOpenTasks, onNewProcess, onOpenProcess, onOpenFinance, followUps, onOpenFollowUp }) {', 'client detail props')
    source = replace(source, '<ClientPrimaryResponsible client={client} office={office} access={access} onRefresh={onRefresh} />', '<ClientPrimaryResponsible client={client} office={office} access={access} onRefresh={onRefresh} /><FollowUpLinked records={followUps?.records} clientId={client.id} onOpen={onOpenFollowUp} />', 'client linked panel')
    return source
  })
}
