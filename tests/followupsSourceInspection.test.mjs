import { test } from 'node:test'
import { readFileSync } from 'node:fs'
test('inspect follow-up completion integration points', () => {
 for(const [file,needles] of [
 ['src/components/ProcessesReact.jsx',['function ProcessEditor(','function ProcessDetails(','function saveProcess(','<Field label="Status"><select value={draft.status}', '<div className="process-meta">','<form','function submit','onSave(draft','onSave({','{editing ? <ProcessEditor']],
 ['src/components/TasksReactBase.jsx',['function saveTask(event)','const task = {','<Field label="Status"><select value={editing.status}','<form className="task-form"','function toggleTask','function completeTask','setEditing(null)','onSubmit={saveTask}']],
 ['src/components/ClientsReact.jsx',['function ClientDetails(','return <','client-details','client-detail','<ClientDetails client={details}']]
 ]) {const s=readFileSync(file,'utf8'); console.log('FILE',file);for(const n of needles){const at=s.indexOf(n);console.log('ANCHOR',n,'AT',at,at<0?'':JSON.stringify(s.slice(Math.max(0,at-120),at+1050)))}}
})
