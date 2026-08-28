import { useEffect, useMemo, useRef, useState } from 'react'
import { today, uid } from '../lib/storage.js'

const emptyClient = {
  tipo: 'PJ', documento: '', razao: '', fantasia: '', tributacao: 'MEI', atividade: 'Comércio', departamentos: [],
  telefone: '', whatsapp: '', email: '', endereco: '', relacionamento: 'Recorrente', mensalidade: '', vencimento: '',
  status: 'Ativo', drive: '', observacoes: '', dataEntrada: '', dataSaida: '', motivoSaida: '', comunicacoes: [],
}
const taxOptions = ['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Outro']
const activityOptions = ['Comércio', 'Serviço', 'Comércio + Serviço', 'Indústria', 'Todas']
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const documentDigits = value => String(value || '').replace(/\D/g, '')
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const addDays = (date, amount) => { const next = new Date(`${date || today()}T00:00:00`); next.setDate(next.getDate() + Number(amount || 0)); return today(next) }

function Field({ label, full = false, children }) { return <label className={`client-field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label> }
function Modal({ title, subtitle, onClose, children, wide = false }) { return <div className="client-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className={`client-modal-card ${wide ? 'wide' : ''}`}><header><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>{children}</div></div> }

export default function ClientsReact({ office, update, sync, onOpenTasks, onOpenProcesses, initialClientId = '', openClientRequest = 0 }) {
  const [query, setQuery] = useState(''), [status, setStatus] = useState(''), [relationship, setRelationship] = useState('')
  const [editing, setEditing] = useState(null), [details, setDetails] = useState(null), [error, setError] = useState('')
  const [selectedTemplates, setSelectedTemplates] = useState(new Set())
  const handledClientOpen = useRef(0)
  const rows = useMemo(() => office.clients.filter(client => {
    const matchesQuery = !query || normalize(`${clientName(client)} ${client.fantasia || ''} ${client.documento || ''} ${client.id}`).includes(normalize(query))
    return matchesQuery && (!status || client.status === status) && (!relationship || client.relacionamento === relationship)
  }), [office.clients, query, relationship, status])

  const departmentChoices = useMemo(() => {
    const active = (office.departments || []).filter(item => item.active !== false).map(item => item.name)
    return [...new Set([...active, ...(editing?.departamentos || [])])]
  }, [editing?.departamentos, office.departments])
  const activeDepartments = useMemo(() => new Set((office.departments || []).filter(item => item.active !== false).map(item => item.name)), [office.departments])
  const matchingTemplates = useMemo(() => !editing?.id ? (office.taskTemplates || []).filter(model => (!model.departamento || editing?.departamentos?.includes(model.departamento)) && (!(model.regimes || []).length || model.regimes.includes(editing?.tributacao))) : [], [editing, office.taskTemplates])

  useEffect(() => {
    if (!initialClientId || !openClientRequest || handledClientOpen.current === openClientRequest) return
    handledClientOpen.current = openClientRequest
    const client = (office.clients || []).find(item => String(item.id) === String(initialClientId))
    if (client) setDetails(client)
  }, [initialClientId, office.clients, openClientRequest])

  function openNew() { setEditing({ ...emptyClient, departamentos: [], dataEntrada: today() }); setSelectedTemplates(new Set()); setError('') }
  function openEdit(client) { setEditing({ ...emptyClient, ...structuredClone(client), departamentos: [...(client.departamentos || [])], comunicacoes: [...(client.comunicacoes || [])] }); setSelectedTemplates(new Set()); setError('') }
  function setField(name, value) { setEditing(current => ({ ...current, [name]: value })) }
  function toggleDepartment(name) { setEditing(current => ({ ...current, departamentos: current.departamentos.includes(name) ? current.departamentos.filter(item => item !== name) : [...current.departamentos, name] })) }
  function toggleTemplate(id) { setSelectedTemplates(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next }) }

  function saveClient(event) {
    event.preventDefault()
    const normalizedDocument = documentDigits(editing.documento)
    if (!editing.razao.trim() || !normalizedDocument) { setError('Informe nome e CPF/CNPJ.'); return }
    if (office.clients.some(client => client.id !== editing.id && documentDigits(client.documento) === normalizedDocument)) { setError('Este CPF/CNPJ já está cadastrado.'); return }
    const isNew = !editing.id
    const client = { ...editing, id: editing.id || uid('cli'), documento: editing.documento.trim(), razao: editing.razao.trim(), fantasia: editing.fantasia.trim(), atividade: editing.atividade.trim(), telefone: editing.telefone.trim(), whatsapp: editing.whatsapp.trim(), email: editing.email.trim(), endereco: editing.endereco.trim(), mensalidade: Number(editing.mensalidade) || 0, vencimento: Number(editing.vencimento) || null, drive: editing.drive.trim(), observacoes: editing.observacoes.trim(), motivoSaida: editing.motivoSaida.trim(), comunicacoes: editing.comunicacoes || [] }
    update(draft => {
      draft.clients = isNew ? [...draft.clients, client] : draft.clients.map(item => item.id === client.id ? client : item)
      if (isNew && selectedTemplates.size) {
        const createdTasks = (draft.taskTemplates || []).filter(model => selectedTemplates.has(model.id) && (!model.departamento || client.departamentos.includes(model.departamento)) && (!(model.regimes || []).length || model.regimes.includes(client.tributacao))).map(model => ({ id: uid('tar'), titulo: model.titulo, descricao: model.descricao || '', clientId: client.id, departamento: model.departamento || '', responsavel: '', prazo: addDays(client.dataEntrada, model.diasPrazo), prioridade: model.prioridade || 'Normal', status: 'Pendente', recorrencia: model.recorrencia || '', subtarefas: (model.subtarefas || []).map(title => ({ id: uid('sub'), titulo: title.titulo || title.nome || String(title), concluida: false })), updatedAt: new Date().toISOString() }))
        draft.tasks = [...draft.tasks, ...createdTasks]
      }
    })
    setEditing(null)
  }

  return <div className="react-module-page">
    <div className="react-module-topbar"><div><h1>Clientes</h1><p>Base central e única do sistema.</p></div><div className="react-module-actions"><span className="sync-indicator">{sync}</span><button className="primary" onClick={openNew}>+ Novo cliente</button></div></div>
    <section className="react-module-card"><div className="client-filters"><input placeholder="Buscar nome, CPF/CNPJ ou ID" value={query} onChange={event => setQuery(event.target.value)} /><select value={status} onChange={event => setStatus(event.target.value)}><option value="">Ativos e inativos</option><option>Ativo</option><option>Inativo</option></select><select value={relationship} onChange={event => setRelationship(event.target.value)}><option value="">Recorrentes e avulsos</option><option>Recorrente</option><option>Avulso</option></select></div>
      <div className="client-table"><div className="client-row client-head"><span>Cliente</span><span>CPF/CNPJ</span><span>Tributação</span><span>Departamentos</span><span>Relacionamento</span><span>Status</span><span /></div>{rows.map(client => <div className="client-row" key={client.id}><div><b>{clientName(client)}</b><small>{client.fantasia || client.tipo || ''}</small></div><span>{client.documento || '—'}</span><span>{client.tributacao || '—'}</span><span>{(client.departamentos || []).join(', ') || '—'}</span><span>{client.relacionamento}</span><span className={`client-status ${client.status === 'Inativo' ? 'inactive' : ''}`}>{client.status}</span><div className="row-actions"><button onClick={() => setDetails(client)}>Abrir</button><button onClick={() => openEdit(client)}>Editar</button></div></div>)}</div>
      {!rows.length ? <div className="empty">Nenhum cliente encontrado.</div> : null}
    </section>

    {editing ? <Modal title={editing.id ? 'Editar cliente' : 'Novo cliente'} subtitle="Cadastro central do sistema." onClose={() => setEditing(null)} wide><form className="client-form" onSubmit={saveClient}>
      <Field label="Tipo"><select value={editing.tipo} onChange={event => setField('tipo', event.target.value)}><option>PJ</option><option>PF</option></select></Field><Field label="CPF/CNPJ *"><input value={editing.documento} onChange={event => setField('documento', event.target.value)} /></Field>
      <Field label="Nome / Razão Social *"><input value={editing.razao} onChange={event => setField('razao', event.target.value)} /></Field><Field label="Nome Fantasia"><input value={editing.fantasia} onChange={event => setField('fantasia', event.target.value)} /></Field>
      <Field label="Tributação"><select value={editing.tributacao} onChange={event => setField('tributacao', event.target.value)}>{taxOptions.map(item => <option key={item}>{item}</option>)}</select></Field><Field label="Atividade"><select value={editing.atividade} onChange={event => setField('atividade', event.target.value)}>{activityOptions.map(item => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Departamentos" full><div className="choice-list">{departmentChoices.map(name => <label key={name}><input type="checkbox" checked={editing.departamentos.includes(name)} onChange={() => toggleDepartment(name)} /> {name}{activeDepartments.has(name) ? '' : ' (inativo)'}</label>)}</div></Field>
      <Field label="Telefone"><input value={editing.telefone} onChange={event => setField('telefone', event.target.value)} /></Field><Field label="WhatsApp"><input value={editing.whatsapp} onChange={event => setField('whatsapp', event.target.value)} /></Field>
      <Field label="E-mail"><input type="email" value={editing.email} onChange={event => setField('email', event.target.value)} /></Field><Field label="Relacionamento"><select value={editing.relacionamento} onChange={event => setField('relacionamento', event.target.value)}><option>Recorrente</option><option>Avulso</option></select></Field>
      <Field label="Mensalidade"><input type="number" min="0" step="0.01" value={editing.mensalidade} onChange={event => setField('mensalidade', event.target.value)} /></Field><Field label="Dia de vencimento"><input type="number" min="1" max="31" value={editing.vencimento} onChange={event => setField('vencimento', event.target.value)} /></Field>
      <Field label="Status"><select value={editing.status} onChange={event => setField('status', event.target.value)}><option>Ativo</option><option>Inativo</option></select></Field><Field label="Data de entrada"><input type="date" value={editing.dataEntrada} onChange={event => setField('dataEntrada', event.target.value)} /></Field>
      <Field label="Data de saída"><input type="date" value={editing.dataSaida} onChange={event => setField('dataSaida', event.target.value)} /></Field><Field label="Motivo da saída" full><input value={editing.motivoSaida} onChange={event => setField('motivoSaida', event.target.value)} placeholder="Opcional; use quando o cliente sair" /></Field>
      <Field label="Endereço" full><textarea value={editing.endereco} onChange={event => setField('endereco', event.target.value)} /></Field><Field label="Google Drive" full><input type="url" value={editing.drive} onChange={event => setField('drive', event.target.value)} placeholder="https://..." /></Field>
      {!editing.id ? <Field label="Tarefas iniciais do cliente" full><div className="template-picker">{matchingTemplates.map(model => <label key={model.id}><input type="checkbox" checked={selectedTemplates.has(model.id)} onChange={() => toggleTemplate(model.id)} /><span><b>{model.titulo}</b><small>{model.departamento || 'Geral'} · prazo em {model.diasPrazo || 0} dia(s){model.recorrencia ? ` · ${model.recorrencia}` : ''}</small></span></label>)}{!matchingTemplates.length ? <p>Nenhum modelo compatível com os departamentos e a tributação selecionados.</p> : null}</div></Field> : null}
      <Field label="Observações" full><textarea value={editing.observacoes} onChange={event => setField('observacoes', event.target.value)} /></Field>{error ? <p className="client-error">{error}</p> : null}<footer className="client-form-actions"><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary">Salvar cliente</button></footer>
    </form></Modal> : null}

    {details ? <ClientDetails client={details} office={office} onClose={() => setDetails(null)} onEdit={() => { setDetails(null); openEdit(details) }} onOpenTasks={() => onOpenTasks(details.id)} onNewProcess={() => onOpenProcesses(details.id)} onOpenProcess={processId => onOpenProcesses('', processId)} /> : null}
  </div>
}

function ClientDetails({ client, office, onClose, onEdit, onOpenTasks, onNewProcess, onOpenProcess }) {
  const [tab, setTab] = useState('overview')
  const clientId = String(client.id)
  const tasks = office.tasks.filter(item => String(item.clientId) === clientId)
  const processes = office.processes.filter(item => String(item.clientId) === clientId || (item.relacionados || []).some(id => String(id) === clientId))
  const obligations = office.obligations.filter(item => (item.clientes || []).some(link => String(link.clienteId) === clientId))
  return <Modal title={clientName(client)} subtitle={`${client.documento || ''} · ${client.tributacao || ''}`} onClose={onClose} wide><div className="client-summary"><article><b>Contato</b><p>WhatsApp: {client.whatsapp || '—'}<br />Telefone: {client.telefone || '—'}<br />{client.email || '—'}</p></article><article><b>Relacionamento</b><p>{client.relacionamento}{client.relacionamento === 'Recorrente' ? ` · ${Number(client.mensalidade || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}</p></article><article><b>Documentos</b><p>{client.drive ? <a href={client.drive} target="_blank" rel="noreferrer">Abrir Google Drive</a> : 'Sem link de Drive'}</p></article></div><div className="details-actions"><button onClick={onOpenTasks}>+ Tarefa</button><button onClick={onNewProcess}>+ Processo</button><button onClick={onEdit}>Editar cliente</button></div><div className="details-tabs">{[['overview','Visão geral'],['obligations','Obrigações'],['processes','Processos'],['tasks','Tarefas']].map(([id,label]) => <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}>{label}</button>)}</div>{tab === 'overview' ? <div className="overview-grid"><article><small>Tarefas abertas</small><strong>{tasks.filter(item => !/conclu/i.test(item.status)).length}</strong></article><article><small>Processos ativos</small><strong>{processes.filter(item => !/conclu/i.test(item.status)).length}</strong></article><article><small>Obrigações</small><strong>{obligations.length}</strong></article><p>{client.observacoes || 'Nenhuma observação.'}</p></div> : null}{tab === 'tasks' ? <DetailList rows={tasks} title="titulo" /> : null}{tab === 'processes' ? <DetailList rows={processes} title="tipo" onOpen={item => onOpenProcess(item.id)} /> : null}{tab === 'obligations' ? <DetailList rows={obligations} title="nome" /> : null}</Modal>
}
function DetailList({ rows, title, onOpen }) { return <div className="detail-list">{rows.map(item => <article key={item.id}><div><b>{item[title]}</b><small>{item.status || item.categoria || 'Registro vinculado'}</small></div>{onOpen ? <button type="button" onClick={() => onOpen(item)}>Abrir</button> : null}</article>)}{!rows.length ? <div className="empty">Nenhum registro.</div> : null}</div> }
