import { readFileSync, writeFileSync } from 'node:fs'

function change(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Follow-ups linked patch: missing ${label}`)
  return source.replace(before, after)
}
function patchFile(root, file, patch) {
  const path = `${root}${file}`
  let source = readFileSync(path, 'utf8')
  if (source.includes('MED_RESULT_FOLLOWUPS_LINKED_V1')) return
  source = patch(source)
  writeFileSync(path, source)
}

export function applyFollowUpsLinkedPatch(root) {
  patchFile(root, 'src/App.jsx', app => {
    app = change(app, "import FollowUpsWorkspace, { FollowUpsToday } from './components/FollowUpsWorkspace.jsx'", "import FollowUpsWorkspace, { FollowUpsToday } from './components/FollowUpsWorkspace.jsx'\n// MED_RESULT_FOLLOWUPS_LINKED_V1", 'app import')
    app = change(app, "  const [followUpTarget, setFollowUpTarget] = useState({ id: '', request: 0 })", "  const [followUpTarget, setFollowUpTarget] = useState({ id: '', request: 0 })\n  const [followUpDraft, setFollowUpDraft] = useState({ data: null, request: 0 })", 'compose state')
    app = change(app, "  function openFollowUp(id) {", "  function startFollowUpFromWork(data) {\n    setFollowUpDraft(current => ({ data, request: current.request + 1 }))\n    setFollowUpTarget({ id: '', request: 0 })\n    setView('acompanhamentos')\n  }\n\n  function openFollowUp(id) {", 'compose action')
    app = change(app, "<FollowUpsWorkspace office={office}", "<FollowUpsWorkspace createDraft={followUpDraft.data} createRequest={followUpDraft.request} office={office}", 'compose route')
    app = change(app, "<ClientsReact office={office}", "<ClientsReact followUps={followUps} onOpenFollowUp={openFollowUp} office={office}", 'client route')
    app = change(app, "<ProcessesReact office={office}", "<ProcessesReact followUps={followUps} onOpenFollowUp={openFollowUp} onStartFollowUp={startFollowUpFromWork} office={office}", 'process route')
    app = change(app, "<TasksReact office={office}", "<TasksReact followUps={followUps} onOpenFollowUp={openFollowUp} onStartFollowUp={startFollowUpFromWork} office={office}", 'task route')
    return app
  })
  patchFile(root, 'src/components/FollowUpsWorkspace.jsx', source => {
    source = change(source, "import './follow-ups.css'", "import './follow-ups.css'\n// MED_RESULT_FOLLOWUPS_LINKED_V1", 'module import')
    source = change(source, "focusId = '', focusRequest = 0 })", "focusId = '', focusRequest = 0, createDraft = null, createRequest = 0 })", 'compose props')
    source = change(source, "  useEffect(() => { if (focusRequest && focusId)", "  useEffect(() => { if (createRequest && createDraft) { setForm({ ...blank(), ...createDraft }); setSelectedId(''); setTab('active') } }, [createRequest])\n  useEffect(() => { if (focusRequest && focusId)", 'compose effect')
    return source
  })
  patchFile(root, 'src/components/ProcessesReact.jsx', source => {
    source = change(source, "import React,", "import React,", 'process import anchor')
    source = "import FollowUpLinked from './FollowUpLinked.jsx'\n// MED_RESULT_FOLLOWUPS_LINKED_V1\n" + source
    source = change(source, 'function ProcessEditor({ process, office, onClose, onSave }) {', 'function ProcessEditor({ process, office, onClose, onSave, followUps }) {', 'editor props')
    const statusField = /(<Field label="Status"><select value={draft\.status}[\s\S]*?<\/select><\/Field>)/
    if (!statusField.test(source)) throw new Error('Follow-ups linked patch: process status field missing')
    source = source.replace(statusField, '$1{draft.status === \'Concluído\' && !followUps?.records?.some(row => row.status === \'active\' && row.sourceType === \'process\' && String(row.sourceId) === String(draft.id)) ? <Field label="Acompanhar resultado" full><div className="third-party-toggle"><label><input type="checkbox" checked={Boolean(draft.followUpRequested)} onChange={event => setField(\'followUpRequested\', event.target.checked)} /> Quero lembrar de conferir o resultado deste processo</label></div>{draft.followUpRequested ? <input type="date" aria-label="Data da conferência do resultado" required value={draft.followUpDate || today()} onChange={event => setField(\'followUpDate\', event.target.value)} /> : null}</Field> : null}')
    source = change(source, 'function ProcessDetails({ process, clientsById, update, onClose }) {', 'function ProcessDetails({ process, clientsById, update, onClose, followUps, onOpenFollowUp }) {', 'details props')
    source = change(source, '<div className="process-meta">', '<FollowUpLinked records={followUps?.records} sourceType="process" sourceId={process.id} onOpen={onOpenFollowUp} /><div className="process-meta">', 'details linked reminders')
    const signature = /export default function ProcessesReact\(\{([^}]*)\}\) \{/
    if (!signature.test(source)) throw new Error('Follow-ups linked patch: process signature missing')
    source = source.replace(signature, (whole, props) => `export default function ProcessesReact({ ${props.trim()}, followUps, onOpenFollowUp, onStartFollowUp }) {`)
    const save = /  function saveProcess\(process\) \{[^\n]+\}/
    if (!save.test(source)) throw new Error('Follow-ups linked patch: process save missing')
    source = source.replace(save, `  function saveProcess(process) {\n    const { followUpRequested, followUpDate, ...cleanProcess } = process\n    const normalized = initializeProcessPlanning({ ...cleanProcess, previsaoConclusaoInicial: cleanProcess.previsaoConclusaoInicial || cleanProcess.previsaoConclusao || '' }, cleanProcess.dataAbertura || today())\n    const saved = normalized.id ? normalized : { ...normalized, id: uid('proc') }\n    update(draft => { draft.processes = normalized.id ? draft.processes.map(item => String(item.id) === String(saved.id) ? saved : item) : [...draft.processes, saved] })\n    setEditing(null); setNotice('Processo salvo.')\n    if (followUpRequested && saved.status === 'Concluído') onStartFollowUp?.({ sourceType: 'process', sourceId: saved.id, clientId: saved.clientId, title: \\`Verificar resultado: \\${saved.tipo}\\`, checkDate: followUpDate || today() })\n  }`.replaceAll('\\`','`').replaceAll('\\${','${'))
    source = change(source, 'onSave={saveProcess} key={editing.id', 'onSave={saveProcess} followUps={followUps} key={editing.id', 'editor wiring')
    source = change(source, '<ProcessDetails process={detailProcess} clientsById={clientsById} update={update}', '<ProcessDetails process={detailProcess} clientsById={clientsById} followUps={followUps} onOpenFollowUp={onOpenFollowUp} update={update}', 'details wiring')
    return source
  })
  patchFile(root, 'src/components/TasksReactBase.jsx', source => {
    source = "import FollowUpLinked from './FollowUpLinked.jsx'\n// MED_RESULT_FOLLOWUPS_LINKED_V1\n" + source
    const signature = /export default function TasksReact\(\{([^}]*)\}\) \{/
    if (!signature.test(source)) throw new Error('Follow-ups linked patch: task signature missing')
    source = source.replace(signature, (whole, props) => `export default function TasksReact({ ${props.trim()}, followUps, onOpenFollowUp, onStartFollowUp }) {`)
    const status = /(<Field label="Status"><select value={editing\.status}[\s\S]*?<\/select><\/Field>)/
    if (!status.test(source)) throw new Error('Follow-ups linked patch: task status missing')
    source = source.replace(status, '$1{isDone(editing.status) && !followUps?.records?.some(row => row.status === \'active\' && row.sourceType === \'task\' && String(row.sourceId) === String(editing.id)) ? <Field label="Acompanhar resultado" full><div className="third-party-toggle"><label><input type="checkbox" checked={Boolean(editing.followUpRequested)} onChange={event => setField(\'followUpRequested\', event.target.checked)} /> Quero lembrar de conferir o resultado deste serviço</label></div>{editing.followUpRequested ? <input type="date" aria-label="Data da conferência do resultado" required value={editing.followUpDate || today()} onChange={event => setField(\'followUpDate\', event.target.value)} /> : null}</Field> : null}')
    source = change(source, "    setNotice('Tarefa salva.')\n  }", "    setNotice('Tarefa salva.')\n    if (editing.followUpRequested && isDone(task.status)) onStartFollowUp?.({ sourceType: 'task', sourceId: task.id, clientId: task.clientId, title: `Verificar resultado: ${task.titulo}`, checkDate: editing.followUpDate || today() })\n  }", 'task save connection')
    source = change(source, "    setNotice(wasDone ? 'Tarefa reaberta.' : 'Tarefa concluída.')", "    setNotice(wasDone ? 'Tarefa reaberta.' : 'Tarefa concluída.')", 'task quick complete preserved')
    return source
  })
  patchFile(root, 'src/components/ClientsReact.jsx', source => {
    source = "import FollowUpLinked from './FollowUpLinked.jsx'\n// MED_RESULT_FOLLOWUPS_LINKED_V1\n" + source
    const signature = /export default function ClientsReact\(\{([^}]*)\}\) \{/
    if (!signature.test(source)) throw new Error('Follow-ups linked patch: client signature missing')
    source = source.replace(signature, (whole, props) => `export default function ClientsReact({ ${props.trim()}, followUps, onOpenFollowUp }) {`)
    source = change(source, 'onOpenFinance={create => onOpenFinance?.(details.id, create)} />', 'onOpenFinance={create => onOpenFinance?.(details.id, create)} followUps={followUps} onOpenFollowUp={onOpenFollowUp} />', 'client detail connection')
    source = change(source, 'function ClientDetails({ client, office, access, onRefresh, onClose, onEdit, onOpenTasks, onNewProcess, onOpenProcess, onOpenFinance }) {', 'function ClientDetails({ client, office, access, onRefresh, onClose, onEdit, onOpenTasks, onNewProcess, onOpenProcess, onOpenFinance, followUps, onOpenFollowUp }) {', 'client detail props')
    source = change(source, '<ClientPrimaryResponsible client={client} office={office} access={access} onRefresh={onRefresh} />', '<ClientPrimaryResponsible client={client} office={office} access={access} onRefresh={onRefresh} /><FollowUpLinked records={followUps?.records} clientId={client.id} onOpen={onOpenFollowUp} />', 'client detail reminder')
    return source
  })
}
