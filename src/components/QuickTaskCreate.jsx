import { useMemo, useState } from 'react'
import { today, uid } from '../lib/storage.js'
import '../quick-task-create.css'

const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'

export default function QuickTaskCreate({ office, update, day = today(), onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [department, setDepartment] = useState('')
  const [priority, setPriority] = useState('Normal')
  const [due, setDue] = useState(day)
  const [error, setError] = useState('')

  const clients = useMemo(() => [...(office?.clients || [])].sort((a, b) => clientName(a).localeCompare(clientName(b), 'pt-BR')), [office?.clients])
  const departments = useMemo(() => (office?.departments || []).map(item => typeof item === 'string' ? item : item?.name).filter(Boolean), [office?.departments])

  function submit(event) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) { setError('Informe o título da tarefa.'); return }

    const timestamp = new Date().toISOString()
    const task = {
      id: uid('task'),
      titulo: cleanTitle,
      clientId: clientId || '',
      departamento: department || '',
      responsavel: '',
      responsavelUserId: '',
      prioridade: priority || 'Normal',
      prazo: due || '',
      planejadoPara: day,
      status: 'Pendente',
      recorrencia: '',
      antecedenciaDias: 0,
      subtarefas: [],
      observacoes: '',
      origem: 'Meu Dia',
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    update(draft => {
      draft.tasks = [...(draft.tasks || []), task]
    })
    onCreated?.(task)
    onClose?.()
  }

  return <div className="quick-task-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.() }}>
    <section className="quick-task-modal" role="dialog" aria-modal="true" aria-labelledby="quick-task-title">
      <header>
        <div><span>Meu Dia</span><h2 id="quick-task-title">Nova tarefa</h2><p>A tarefa entra no expediente de hoje imediatamente.</p></div>
        <button type="button" className="quick-task-close" onClick={onClose} aria-label="Fechar">×</button>
      </header>

      <form onSubmit={submit}>
        <label className="quick-task-full"><span>Tarefa</span><input autoFocus value={title} onChange={event => { setTitle(event.target.value); setError('') }} placeholder="Ex.: Conferir documentos do cliente" /></label>
        <label><span>Cliente</span><select value={clientId} onChange={event => setClientId(event.target.value)}><option value="">Tarefa interna</option>{clients.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}</option>)}</select></label>
        <label><span>Departamento</span><select value={department} onChange={event => setDepartment(event.target.value)}><option value="">Sem departamento</option>{departments.map(value => <option value={value} key={value}>{value}</option>)}</select></label>
        <label><span>Prioridade</span><select value={priority} onChange={event => setPriority(event.target.value)}><option>Normal</option><option>Baixa</option><option>Média</option><option>Alta</option><option>Urgente</option></select></label>
        <label><span>Prazo</span><input type="date" value={due} onChange={event => setDue(event.target.value)} /></label>
        {error ? <p className="quick-task-error">{error}</p> : null}
        <footer><button type="button" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Criar tarefa</button></footer>
      </form>
    </section>
  </div>
}
