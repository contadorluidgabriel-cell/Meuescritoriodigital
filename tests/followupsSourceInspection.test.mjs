import { test } from 'node:test'
import { readFileSync } from 'node:fs'
test('inspect exact integration anchors',()=>{
for(const [file,needles] of [
['src/components/ProcessesReact.jsx',['function ProcessEditor(', 'function ProcessDetails(', 'function saveProcess(', 'function submit(event)', 'onSave({ ...draft', 'onSave({','<div className="process-meta">','return <Modal title={','const [error, setError] = useState','onSave={saveProcess}']],
['src/components/TasksReactBase.jsx',['function saveTask(event)','commitTasks(nextTasks)','setEditing(null)\n    setNotice(\'Tarefa salva.\')','function toggleTask(id)','<form className="task-form"','<Field label="Status"><select value={editing.status}']],
['src/components/ClientsReact.jsx',['function ClientDetails(','const tabs =','return <Modal title=', 'return <div className="client','return <div className={`client','onOpenFinance }) {','{tab === \'overview\'','<ClientDetails client={details}']]
]){const s=readFileSync(file,'utf8');console.log('FILE',file);for(const needle of needles){const from=needle==='function submit(event)'?s.indexOf(needle,s.indexOf('function ProcessEditor(')):s.indexOf(needle,needle==='return <div className="client'||needle==='return <div className={`client'||needle==='return <Modal title='?s.indexOf('function ClientDetails('):0);console.log('ANCHOR',needle,'AT',from,from<0?'':JSON.stringify(s.slice(Math.max(0,from-100),from+1850)))}}
})