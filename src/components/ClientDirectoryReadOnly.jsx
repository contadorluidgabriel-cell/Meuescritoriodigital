import { useMemo, useState } from 'react'
import '../client-directory-readonly.css'

const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function ClientDirectoryReadOnly({ office, access, onOpenTasks, onOpenProcesses }) {
  const [query, setQuery] = useState('')
  const clients = useMemo(() => (office.clients || []).filter(client => {
    if (!query.trim()) return true
    return normalize(`${clientName(client)} ${client.fantasia || ''} ${client.documento || ''}`).includes(normalize(query))
  }).sort((a, b) => clientName(a).localeCompare(clientName(b), 'pt-BR')), [office.clients, query])

  return <div className="client-readonly-shell">
    <header><div><span>{access?.membership?.role === 'partner' ? 'Portal do parceiro' : 'Consulta'}</span><h1>Clientes</h1><p>{access?.membership?.role === 'partner' ? 'Somente clientes vinculados à sua parceria.' : 'Consulta de clientes sem permissão para alterar o cadastro.'}</p></div><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar cliente…" /></header>
    <section className="client-readonly-grid">{clients.map(client => <article key={client.id}><div className="client-readonly-top"><span>{String(clientName(client)).slice(0, 2).toUpperCase()}</span><div><strong>{clientName(client)}</strong><small>{client.documento || client.tributacao || 'Cadastro do cliente'}</small></div></div><dl><div><dt>Status</dt><dd>{client.status || 'Ativo'}</dd></div><div><dt>Relacionamento</dt><dd>{client.relacionamento || '—'}</dd></div><div><dt>Atendimento</dt><dd>{client.perfilAtendimento || 'Direto'}</dd></div>{client.email ? <div><dt>E-mail</dt><dd>{client.email}</dd></div> : null}{client.telefone ? <div><dt>Telefone</dt><dd>{client.telefone}</dd></div> : null}</dl><footer><button type="button" onClick={() => onOpenTasks?.(String(client.id))}>Tarefas</button><button type="button" onClick={() => onOpenProcesses?.(String(client.id))}>Processos</button></footer></article>)}</section>
    {!clients.length ? <div className="client-readonly-empty">Nenhum cliente disponível neste acesso.</div> : null}
  </div>
}
