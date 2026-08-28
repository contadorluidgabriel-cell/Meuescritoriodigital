import { useEffect, useMemo, useRef, useState } from 'react'
import { today, uid } from '../lib/storage.js'

const emptyClient = {
  tipo: 'PJ', documento: '', razao: '', fantasia: '', tributacao: 'MEI', atividade: 'Comércio', departamentos: [],
  telefone: '', whatsapp: '', email: '', endereco: '', relacionamento: 'Recorrente', mensalidade: '', vencimento: '',
  status: 'Ativo', drive: '', observacoes: '', dataEntrada: '', dataSaida: '', motivoSaida: '', comunicacoes: [],
}
const emptyLinkedCompany = { cnpj: '', razao: '', fantasia: '', relacao: 'Empresa relacionada', observacoes: '', status: 'Ativo' }
const linkedRelationshipOptions = ['Empresa relacionada', 'Empresa do cliente/sócio', 'Cliente de parceiro', 'Terceiro', 'Outro']
const taxOptions = ['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Outro']
const activityOptions = ['Comércio', 'Serviço', 'Comércio + Serviço', 'Indústria', 'Todas']
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const documentDigits = value => String(value || '').replace(/\D/g, '')
const documentType = (value, type = '') => type === 'PF' || type === 'PJ' ? type : (documentDigits(value).length > 11 ? 'PJ' : 'PF')
const formatDocument = (value, type = '') => {
  const kind = documentType(value, type)
  const digits = documentDigits(value).slice(0, kind === 'PF' ? 11 : 14)
  if (!digits) return ''
  if (kind === 'PF') {
    let formatted = digits.slice(0, 3)
    if (digits.length > 3) formatted += `.${digits.slice(3, 6)}`
    if (digits.length > 6) formatted += `.${digits.slice(6, 9)}`
    if (digits.length > 9) formatted += `-${digits.slice(9, 11)}`
    return formatted
  }
  let formatted = digits.slice(0, 2)
  if (digits.length > 2) formatted += `.${digits.slice(2, 5)}`
  if (digits.length > 5) formatted += `.${digits.slice(5, 8)}`
  if (digits.length > 8) formatted += `/${digits.slice(8, 12)}`
  if (digits.length > 12) formatted += `-${digits.slice(12, 14)}`
  return formatted
}
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const formatDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—'
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const linkedCompanyName = company => company?.razao || company?.fantasia || 'CNPJ vinculado'
const addDays = (date, amount) => { const next = new Date(`${date || today()}T00:00:00`); next.setDate(next.getDate() + Number(amount || 0)); return today(next) }

function Field({ label, full = false, children }) { return <label className={`client-field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label> }
function Modal({ title, subtitle, onClose, children, wide = false, className = '' }) { return <div className={`client-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className={`client-modal-card ${wide ? 'wide' : ''}`}><header><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>{children}</div></div> }

export default function ClientsReact({ office, update, sync, onOpenTasks, onOpenProcesses, onOpenFinance, initialClientId = '', openClientRequest = 0 }) {
  const [query, setQuery] = useState(''), [status, setStatus] = useState(''), [relationship, setRelationship] = useState('')
  const [editing, setEditing] = useState(null), [details, setDetails] = useState(null), [error, setError] = useState('')
  const [selectedTemplates, setSelectedTemplates] = useState(new Set())
  const handledClientOpen = useRef(0)
  const rows = useMemo(() => office.clients.filter(client => {
    const matchesQuery = !query || normalize(`${clientName(client)} ${client.fantasia || ''} ${client.documento || ''} ${documentDigits(client.documento)} ${client.id}`).includes(normalize(query))
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
  function openEdit(client) { setEditing({ ...emptyClient, ...structuredClone(client), documento: formatDocument(client.documento, client.tipo), departamentos: [...(client.departamentos || [])], comunicacoes: [...(client.comunicacoes || [])] }); setSelectedTemplates(new Set()); setError('') }
  function setField(name, value) { setEditing(current => ({ ...current, [name]: value })) }
  function setClientType(type) { setEditing(current => ({ ...current, tipo: type, documento: formatDocument(current.documento, type) })) }
  function toggleDepartment(name) { setEditing(current => ({ ...current, departamentos: current.departamentos.includes(name) ? current.departamentos.filter(item => item !== name) : [...current.departamentos, name] })) }
  function toggleTemplate(id) { setSelectedTemplates(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next }) }

  function saveClient(event) {
    event.preventDefault()
    const normalizedDocument = documentDigits(editing.documento)
    const expectedLength = editing.tipo === 'PF' ? 11 : 14
    const documentLabel = editing.tipo === 'PF' ? 'CPF' : 'CNPJ'
    if (!editing.razao.trim() || !normalizedDocument) { setError('Informe nome e CPF/CNPJ.'); return }
    if (normalizedDocument.length !== expectedLength) { setError(`Informe um ${documentLabel} com ${expectedLength} dígitos.`); return }
    if (office.clients.some(client => client.id !== editing.id && documentDigits(client.documento) === normalizedDocument)) { setError('Este CPF/CNPJ já está cadastrado.'); return }
    if (editing.tipo === 'PJ' && (office.linkedCompanies || []).some(company => company.status !== 'Inativo' && documentDigits(company.cnpj) === normalizedDocument)) { setError('Este CNPJ está cadastrado como CNPJ vinculado. Inative o vínculo antes de cadastrá-lo como cliente.'); return }
    const isNew = !editing.id
    const client = { ...editing, id: editing.id || uid('cli'), documento: formatDocument(normalizedDocument, editing.tipo), razao: editing.razao.trim(), fantasia: editing.fantasia.trim(), atividade: editing.atividade.trim(), telefone: editing.telefone.trim(), whatsapp: editing.whatsapp.trim(), email: editing.email.trim(), endereco: editing.endereco.trim(), mensalidade: Number(editing.mensalidade) || 0, vencimento: Number(editing.vencimento) || null, drive: editing.drive.trim(), observacoes: editing.observacoes.trim(), motivoSaida: editing.motivoSaida.trim(), comunicacoes: editing.comunicacoes || [] }
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
      <div className="client-table"><div className="client-row client-head"><span>Cliente</span><span>CPF/CNPJ</span><span>Tributação</span><span>Departamentos</span><span>Relacionamento</span><span>Status</span><span /></div>{rows.map(client => <div className="client-row" key={client.id}><div><b>{clientName(client)}</b><small>{client.fantasia || client.tipo || ''}</small></div><span>{formatDocument(client.documento, client.tipo) || '—'}</span><span>{client.tributacao || '—'}</span><span>{(client.departamentos || []).join(', ') || '—'}</span><span>{client.relacionamento}</span><span className={`client-status ${client.status === 'Inativo' ? 'inactive' : ''}`}>{client.status}</span><div className="row-actions"><button onClick={() => setDetails(client)}>Abrir</button><button onClick={() => openEdit(client)}>Editar</button></div></div>)}</div>
      {!rows.length ? <div className="empty">Nenhum cliente encontrado.</div> : null}
    </section>

    {editing ? <Modal title={editing.id ? 'Editar cliente' : 'Novo cliente'} subtitle="Cadastro central do sistema." onClose={() => setEditing(null)} wide><form className="client-form" onSubmit={saveClient}>
      <Field label="Tipo"><select value={editing.tipo} onChange={event => setClientType(event.target.value)}><option>PJ</option><option>PF</option></select></Field><Field label="CPF/CNPJ *"><input inputMode="numeric" maxLength={editing.tipo === 'PF' ? 14 : 18} value={formatDocument(editing.documento, editing.tipo)} onChange={event => setField('documento', formatDocument(event.target.value, editing.tipo))} placeholder={editing.tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'} /></Field>
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

    {details ? <ClientDetails client={details} office={office} update={update} onClose={() => setDetails(null)} onEdit={() => { setDetails(null); openEdit(details) }} onOpenTasks={() => onOpenTasks(details.id)} onNewProcess={() => onOpenProcesses(details.id)} onOpenProcess={processId => onOpenProcesses('', processId)} onOpenFinance={create => onOpenFinance?.(details.id, create)} /> : null}
  </div>
}

function ClientDetails({ client, office, update, onClose, onEdit, onOpenTasks, onNewProcess, onOpenProcess, onOpenFinance }) {
  const [tab, setTab] = useState('overview')
  const [linkedEditing, setLinkedEditing] = useState(null)
  const [linkedError, setLinkedError] = useState('')
  const clientId = String(client.id)
  const tasks = office.tasks.filter(item => String(item.clientId) === clientId)
  const processes = office.processes.filter(item => String(item.clientId) === clientId || (item.relacionados || []).some(id => String(id) === clientId))
  const obligations = office.obligations.filter(item => (item.clientes || []).some(link => String(link.clienteId) === clientId))
  const linkedCompanies = (office.linkedCompanies || []).filter(item => String(item.clientId) === clientId).sort((a, b) => Number(a.status === 'Inativo') - Number(b.status === 'Inativo') || linkedCompanyName(a).localeCompare(linkedCompanyName(b), 'pt-BR'))
  const activeLinkedCompanies = linkedCompanies.filter(item => item.status !== 'Inativo')
  const charges = (office.finance || []).filter(item => String(item.clienteId) === clientId).sort((a, b) => String(b.vencimento || b.competencia || '').localeCompare(String(a.vencimento || a.competencia || '')))
  const financeTotals = charges.reduce((result, charge) => {
    const value = Number(charge.valor) || 0
    if (charge.status === 'Recebido') result.received += value
    if (charge.status === 'Pendente') result.pending += value
    if (charge.status === 'Atrasado') result.overdue += value
    return result
  }, { received: 0, pending: 0, overdue: 0 })
  const canCharge = client.status !== 'Inativo'

  function openNewLinkedCompany() {
    setLinkedEditing({ ...emptyLinkedCompany, clientId })
    setLinkedError('')
  }

  function openEditLinkedCompany(company) {
    setLinkedEditing({ ...emptyLinkedCompany, ...structuredClone(company), cnpj: formatDocument(company.cnpj, 'PJ') })
    setLinkedError('')
  }

  function setLinkedField(name, value) {
    setLinkedEditing(current => ({ ...current, [name]: value }))
  }

  function saveLinkedCompany(event) {
    event.preventDefault()
    const cnpj = documentDigits(linkedEditing.cnpj)
    if (cnpj.length !== 14) { setLinkedError('Informe um CNPJ com 14 dígitos.'); return }
    if (!linkedEditing.razao.trim()) { setLinkedError('Informe a razão social do CNPJ vinculado.'); return }
    if ((office.clients || []).some(item => documentDigits(item.documento) === cnpj)) { setLinkedError('Este CNPJ já está cadastrado como cliente do escritório.'); return }
    if ((office.linkedCompanies || []).some(item => item.id !== linkedEditing.id && String(item.clientId) === clientId && documentDigits(item.cnpj) === cnpj)) { setLinkedError('Este CNPJ já está vinculado a este cliente.'); return }

    const record = {
      ...linkedEditing,
      id: linkedEditing.id || uid('cnpjv'),
      clientId,
      cnpj: formatDocument(cnpj, 'PJ'),
      razao: linkedEditing.razao.trim(),
      fantasia: linkedEditing.fantasia.trim(),
      relacao: linkedEditing.relacao || 'Empresa relacionada',
      observacoes: linkedEditing.observacoes.trim(),
      status: linkedEditing.status || 'Ativo',
      createdAt: linkedEditing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    update(draft => {
      const current = draft.linkedCompanies || []
      draft.linkedCompanies = record.id && current.some(item => item.id === record.id)
        ? current.map(item => item.id === record.id ? record : item)
        : [...current, record]
    })
    setLinkedEditing(null)
  }

  function toggleLinkedCompanyStatus(company) {
    const nextStatus = company.status === 'Inativo' ? 'Ativo' : 'Inativo'
    update(draft => {
      draft.linkedCompanies = (draft.linkedCompanies || []).map(item => item.id === company.id ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() } : item)
    })
  }

  return <Modal title={clientName(client)} subtitle={`${formatDocument(client.documento, client.tipo) || ''} · ${client.tributacao || ''}`} onClose={onClose} wide>
    <div className="client-summary"><article><b>Contato</b><p>WhatsApp: {client.whatsapp || '—'}<br />Telefone: {client.telefone || '—'}<br />{client.email || '—'}</p></article><article><b>Relacionamento</b><p>{client.relacionamento}{client.relacionamento === 'Recorrente' ? ` · ${money(client.mensalidade)}` : ''}</p></article><article><b>Documentos</b><p>{client.drive ? <a href={client.drive} target="_blank" rel="noreferrer">Abrir Google Drive</a> : 'Sem link de Drive'}</p></article><article><b>CNPJs vinculados</b><p>{activeLinkedCompanies.length} ativo{activeLinkedCompanies.length === 1 ? '' : 's'} · não entram na carteira</p></article></div>
    <div className="details-actions"><button onClick={onOpenTasks}>+ Tarefa</button><button onClick={onNewProcess}>+ Processo</button><button onClick={() => { setTab('linked'); openNewLinkedCompany() }}>+ Vincular CNPJ</button>{canCharge ? <button onClick={() => onOpenFinance?.(true)}>+ Cobrança</button> : null}<button onClick={onEdit}>Editar cliente</button></div>
    <div className="details-tabs">{[['overview','Visão geral'],['linked','CNPJs vinculados'],['finance','Financeiro'],['obligations','Obrigações'],['processes','Processos'],['tasks','Tarefas']].map(([id,label]) => <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}>{label}</button>)}</div>
    {tab === 'overview' ? <div className="overview-grid"><article><small>Tarefas abertas</small><strong>{tasks.filter(item => !/conclu/i.test(item.status)).length}</strong></article><article><small>Processos ativos</small><strong>{processes.filter(item => !/conclu/i.test(item.status)).length}</strong></article><article><small>Obrigações</small><strong>{obligations.length}</strong></article><article><small>CNPJs vinculados</small><strong>{activeLinkedCompanies.length}</strong></article><p>{client.observacoes || 'Nenhuma observação.'}</p></div> : null}
    {tab === 'linked' ? <div className="linked-companies-panel">
      <div className="linked-companies-head"><div><h3>CNPJs vinculados</h3><p>Empresas relacionadas a este cliente, mas que não fazem parte da carteira do escritório e não geram mensalidades ou obrigações automáticas.</p></div><button type="button" className="primary" onClick={openNewLinkedCompany}>+ Vincular CNPJ</button></div>
      <div className="linked-companies-list">{linkedCompanies.map(company => <article className={company.status === 'Inativo' ? 'inactive' : ''} key={company.id}><div className="linked-company-main"><div><span className="linked-company-badge">Não é cliente</span><b>{linkedCompanyName(company)}</b><small>{formatDocument(company.cnpj, 'PJ')} · {company.relacao || 'Empresa relacionada'}{company.fantasia ? ` · ${company.fantasia}` : ''}</small>{company.observacoes ? <p>{company.observacoes}</p> : null}</div><span className={`client-status ${company.status === 'Inativo' ? 'inactive' : ''}`}>{company.status || 'Ativo'}</span></div><div className="linked-company-actions"><button type="button" onClick={() => openEditLinkedCompany(company)}>Editar</button><button type="button" onClick={() => toggleLinkedCompanyStatus(company)}>{company.status === 'Inativo' ? 'Reativar vínculo' : 'Inativar vínculo'}</button></div></article>)}{!linkedCompanies.length ? <div className="empty">Nenhum CNPJ vinculado a este cliente.</div> : null}</div>
    </div> : null}
    {tab === 'finance' ? <div>
      <div className="overview-grid"><article><small>Mensalidade</small><strong>{money(client.mensalidade)}</strong></article><article><small>Recebido</small><strong>{money(financeTotals.received)}</strong></article><article><small>A receber</small><strong>{money(financeTotals.pending + financeTotals.overdue)}</strong></article></div>
      <div className="details-actions"><button type="button" onClick={() => onOpenFinance?.(false)}>Abrir no Financeiro</button>{canCharge ? <button type="button" onClick={() => onOpenFinance?.(true)}>+ Nova cobrança</button> : null}</div>
      <div className="detail-list">{charges.slice(0, 12).map(charge => <article key={charge.id}><div><b>{charge.descricao || 'Cobrança'}</b><small>{charge.competencia || 'Sem competência'} · {charge.status || 'Pendente'} · {formatDate(charge.vencimento)}</small></div><strong>{money(charge.valor)}</strong></article>)}{!charges.length ? <div className="empty">Nenhuma cobrança vinculada a este cliente.</div> : null}</div>
    </div> : null}
    {tab === 'tasks' ? <DetailList rows={tasks} title="titulo" /> : null}{tab === 'processes' ? <DetailList rows={processes} title="tipo" onOpen={item => onOpenProcess(item.id)} /> : null}{tab === 'obligations' ? <DetailList rows={obligations} title="nome" /> : null}

    {linkedEditing ? <Modal title={linkedEditing.id ? 'Editar CNPJ vinculado' : 'Vincular CNPJ'} subtitle="Este cadastro é apenas relacionado ao cliente e não entra na carteira do escritório." onClose={() => setLinkedEditing(null)} className="linked-company-modal"><form className="linked-company-form" onSubmit={saveLinkedCompany}>
      <Field label="CNPJ *" full><input inputMode="numeric" maxLength={18} value={formatDocument(linkedEditing.cnpj, 'PJ')} onChange={event => setLinkedField('cnpj', formatDocument(event.target.value, 'PJ'))} placeholder="00.000.000/0000-00" /></Field>
      <Field label="Razão Social *" full><input value={linkedEditing.razao} onChange={event => setLinkedField('razao', event.target.value)} /></Field>
      <Field label="Nome Fantasia" full><input value={linkedEditing.fantasia} onChange={event => setLinkedField('fantasia', event.target.value)} /></Field>
      <Field label="Relação"><select value={linkedEditing.relacao} onChange={event => setLinkedField('relacao', event.target.value)}>{linkedRelationshipOptions.map(item => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Status"><select value={linkedEditing.status} onChange={event => setLinkedField('status', event.target.value)}><option>Ativo</option><option>Inativo</option></select></Field>
      <Field label="Observações" full><textarea value={linkedEditing.observacoes} onChange={event => setLinkedField('observacoes', event.target.value)} placeholder="Ex.: empresa atendida por outro contador; este CNPJ aparece somente neste relacionamento." /></Field>
      {linkedError ? <p className="client-error linked-company-error">{linkedError}</p> : null}
      <footer className="linked-company-form-actions"><button type="button" onClick={() => setLinkedEditing(null)}>Cancelar</button><button className="primary">Salvar vínculo</button></footer>
    </form></Modal> : null}
  </Modal>
}
function DetailList({ rows, title, onOpen }) { return <div className="detail-list">{rows.map(item => <article key={item.id}><div><b>{item[title]}</b><small>{item.status || item.categoria || 'Registro vinculado'}</small></div>{onOpen ? <button type="button" onClick={() => onOpen(item)}>Abrir</button> : null}</article>)}{!rows.length ? <div className="empty">Nenhum registro.</div> : null}</div> }
