import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { today, uid } from '../lib/storage.js'
import { nextObligationCompetence, nextObligationDue, obligationProgress, obligationStatuses } from '../lib/obligationUtils.js'

const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const formatDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem vencimento'
const emptyLink = clientId => ({ clienteId: String(clientId), status: 'Pendente', vencimento: '', observacao: '', recibo: '', concluidoEm: '' })

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return <div className="obligation-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className={`obligation-modal-card ${wide ? 'wide' : ''}`}><header><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>{children}</div></div>
}

function Field({ label, full = false, hint, children }) {
  return <label className={`obligation-field ${full ? 'full' : ''}`}><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>
}

function Progress({ value }) {
  return <div className="obligation-progress"><div><i style={{ width: `${value}%` }} /></div><span>{value}%</span></div>
}

function ClientDetailsModal({ obligation, clientsById, focusClientId, onClose, onSave }) {
  const [rows, setRows] = useState(() => structuredClone(obligation.clientes || []))
  const originalByClient = useMemo(() => new Map((obligation.clientes || []).map(link => [String(link.clienteId), link])), [obligation.clientes])

  function changeRow(clientId, patch) {
    setRows(current => current.map(row => String(row.clienteId) === String(clientId) ? { ...row, ...patch } : row))
  }

  function submit(event) {
    event.preventDefault()
    const savedRows = rows.map(row => {
      const previous = originalByClient.get(String(row.clienteId))
      let concluded = row.concluidoEm || ''
      if (row.status === 'Concluída' && previous?.status !== 'Concluída') concluded = today()
      if (row.status !== 'Concluída') concluded = ''
      return { ...row, concluidoEm: concluded }
    })
    onSave(savedRows)
  }

  return <Modal title={obligation.nome} subtitle="Vencimento e situação por cliente." onClose={onClose} wide><form className="obligation-client-form" onSubmit={submit}><div className="obligation-client-list">{rows.map(row => {
    const client = clientsById.get(String(row.clienteId))
    return <article className={String(row.clienteId) === String(focusClientId) ? 'focused' : ''} key={row.clienteId}>
      <header><div><b>{clientName(client)}</b>{client?.status === 'Inativo' ? <em>Inativo</em> : null}<small>{client?.documento || 'Sem documento'}</small></div><span className={`obligation-status status-${normalize(row.status).replaceAll(' ', '-')}`}>{row.status}</span></header>
      <div className="obligation-client-fields">
        <Field label="Vencimento"><input type="date" value={row.vencimento || ''} onInput={event => changeRow(row.clienteId, { vencimento: event.currentTarget.value })} onChange={event => changeRow(row.clienteId, { vencimento: event.target.value })} /></Field>
        <Field label="Status"><select value={row.status || 'Pendente'} onChange={event => changeRow(row.clienteId, { status: event.target.value })}>{obligationStatuses.map(status => <option key={status}>{status}</option>)}</select></Field>
        <Field label="Recibo / protocolo"><input value={row.recibo || ''} onChange={event => changeRow(row.clienteId, { recibo: event.target.value })} placeholder="Número ou referência" /></Field>
        <Field label="Observação"><input value={row.observacao || ''} onChange={event => changeRow(row.clienteId, { observacao: event.target.value })} placeholder="Observação opcional" /></Field>
      </div>
      {row.concluidoEm ? <p>Concluída em {formatDate(row.concluidoEm)}</p> : null}
    </article>
  })}</div><footer className="obligation-form-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="primary">Salvar alterações</button></footer></form></Modal>
}

export default function ObligationsReact({ office, update, sync, initialObligationId = '', initialClientId = '', openObligationRequest = 0 }) {
  const [query, setQuery] = useState(''), [category, setCategory] = useState('')
  const [editing, setEditing] = useState(null), [selectedClients, setSelectedClients] = useState(new Set()), [clientQuery, setClientQuery] = useState('')
  const [details, setDetails] = useState(null), [duplicate, setDuplicate] = useState(null)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const handledOpenRequest = useRef(0)
  const clientsById = useMemo(() => new Map((office.clients || []).map(client => [String(client.id), client])), [office.clients])
  const activeDepartments = useMemo(() => (office.departments || []).filter(department => department.active !== false).map(department => department.name), [office.departments])
  const filterCategories = useMemo(() => [...new Set([...activeDepartments, ...(office.obligations || []).map(obligation => obligation.categoria), 'Outros'].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [activeDepartments, office.obligations])
  const rows = useMemo(() => (office.obligations || []).filter(obligation => {
    const matchesQuery = !query || normalize(`${obligation.nome} ${obligation.tipo} ${obligation.competencia} ${obligation.descricao}`).includes(normalize(query))
    return matchesQuery && (!category || obligation.categoria === category)
  }), [category, office.obligations, query])
  const categoryChoices = useMemo(() => [...new Set([...activeDepartments, editing?.categoria, 'Outros'].filter(Boolean))], [activeDepartments, editing?.categoria])
  const pickerClients = useMemo(() => (office.clients || []).filter(client => {
    const selected = selectedClients.has(String(client.id))
    const allowed = client.status !== 'Inativo' || selected
    return allowed && (!clientQuery || normalize(`${clientName(client)} ${client.documento}`).includes(normalize(clientQuery)))
  }), [clientQuery, office.clients, selectedClients])
  const openDetails = useCallback((obligation, focusClientId = '') => setDetails({ obligation, focusClientId }), [])

  useEffect(() => {
    if (!initialObligationId || !openObligationRequest || handledOpenRequest.current === openObligationRequest) return
    handledOpenRequest.current = openObligationRequest
    const obligation = (office.obligations || []).find(item => String(item.id) === String(initialObligationId))
    if (obligation) openDetails(obligation, initialClientId)
  }, [initialClientId, initialObligationId, office.obligations, openDetails, openObligationRequest])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 2800)
    return () => clearTimeout(timer)
  }, [notice])

  function openNew() {
    setEditing({ id: '', tipo: '', competencia: '', nome: '', descricao: '', categoria: activeDepartments[0] || 'Outros', observacoes: '' })
    setSelectedClients(new Set())
    setClientQuery('')
    setError('')
  }

  function openEdit(obligation) {
    setEditing({
      ...structuredClone(obligation),
      tipo: obligation.tipo || '',
      competencia: obligation.competencia || '',
      nome: obligation.nome || '',
      descricao: obligation.descricao || '',
      categoria: obligation.categoria || 'Outros',
      observacoes: obligation.observacoes || '',
    })
    setSelectedClients(new Set((obligation.clientesIds || obligation.clientes?.map(link => link.clienteId) || []).map(String)))
    setClientQuery('')
    setError('')
  }

  function setField(name, value) { setEditing(current => ({ ...current, [name]: value })) }
  function toggleClient(clientId) { setSelectedClients(current => { const next = new Set(current); next.has(clientId) ? next.delete(clientId) : next.add(clientId); return next }) }
  function toggleVisibleClients() { setSelectedClients(current => { const next = new Set(current); const visibleIds = pickerClients.map(client => String(client.id)); const allSelected = visibleIds.length > 0 && visibleIds.every(id => next.has(id)); visibleIds.forEach(id => allSelected ? next.delete(id) : next.add(id)); return next }) }

  function saveObligation(event) {
    event.preventDefault()
    if (!editing.nome.trim() || !selectedClients.size) { setError('Informe o nome e selecione pelo menos um cliente.'); return }
    const previous = editing.id ? (office.obligations || []).find(item => String(item.id) === String(editing.id)) : null
    const previousLinks = new Map((previous?.clientes || []).map(link => [String(link.clienteId), link]))
    const ids = [...selectedClients]
    const obligation = {
      id: editing.id || uid('obr'), tipo: editing.tipo.trim(), competencia: editing.competencia.trim(), nome: editing.nome.trim(),
      descricao: editing.descricao.trim(), categoria: editing.categoria || 'Outros', clientesIds: ids,
      clientes: ids.map(clientId => structuredClone(previousLinks.get(clientId) || emptyLink(clientId))), observacoes: editing.observacoes.trim(),
    }
    update(draft => { draft.obligations = previous ? draft.obligations.map(item => String(item.id) === String(obligation.id) ? obligation : item) : [...draft.obligations, obligation] })
    setEditing(null)
    setNotice('Obrigação salva.')
  }

  function saveClientDetails(clientRows) {
    const obligationId = details.obligation.id
    update(draft => { draft.obligations = draft.obligations.map(item => String(item.id) === String(obligationId) ? { ...item, clientes: clientRows, clientesIds: clientRows.map(link => String(link.clienteId)) } : item) })
    setDetails(null)
    setNotice('Situações dos clientes atualizadas.')
  }

  function openDuplicate(obligation) {
    setDuplicate({ source: obligation, competence: nextObligationCompetence(obligation.competencia), error: '' })
  }

  function saveDuplicate(event) {
    event.preventDefault()
    const competence = duplicate.competence.trim()
    if (!competence) { setDuplicate(current => ({ ...current, error: 'Informe a nova competência.' })); return }
    const source = duplicate.source
    const identity = normalize(source.tipo || source.nome)
    const exists = (office.obligations || []).some(item => normalize(item.tipo || item.nome) === identity && String(item.competencia || '') === competence)
    if (exists) { setDuplicate(current => ({ ...current, error: 'Já existe esta obrigação nessa competência.' })); return }
    const activeClientIds = new Set((office.clients || []).filter(client => client.status !== 'Inativo').map(client => String(client.id)))
    const sourceIds = source.clientesIds || (source.clientes || []).map(link => link.clienteId)
    const ids = sourceIds.map(String).filter(clientId => activeClientIds.has(clientId))
    let baseName = source.tipo || source.nome || 'Obrigação'
    if (!source.tipo && source.competencia && baseName.endsWith(String(source.competencia))) baseName = baseName.slice(0, -String(source.competencia).length).trim()
    const copy = { id: uid('obr'), tipo: source.tipo || '', competencia: competence, nome: `${baseName} ${competence}`.trim(), descricao: source.descricao || '', categoria: source.categoria || 'Fiscal', clientesIds: ids, clientes: ids.map(emptyLink), observacoes: source.observacoes || '' }
    update(draft => { draft.obligations = [...draft.obligations, copy] })
    setDuplicate(null)
    setNotice('Nova competência criada.')
  }

  const visiblePickerSelected = pickerClients.length > 0 && pickerClients.every(client => selectedClients.has(String(client.id)))

  return <div className="react-module-page obligations-page">
    <div className="react-module-topbar"><div><h1>Obrigações</h1><p>Uma obrigação, vários clientes, vencimentos e status individuais.</p></div><div className="react-module-actions"><span className="sync-indicator">{sync}</span><button type="button" className="primary" onClick={openNew}>+ Nova obrigação</button></div></div>
    <section className="obligations-card"><div className="obligation-filters"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar obrigação" /><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas as categorias</option>{filterCategories.map(name => <option key={name}>{name}</option>)}</select></div>
      <div className="obligation-table"><div className="obligation-row obligation-head"><span>Obrigação</span><span>Categoria</span><span>Clientes</span><span>Concluídos</span><span>Progresso</span><span>Próximo vencimento</span><span /></div>{rows.map(obligation => {
        const progress = obligationProgress(obligation), nextDue = nextObligationDue(obligation, today())
        return <article className="obligation-row" key={obligation.id}><div className="obligation-title"><b>{obligation.nome}</b><small>{[obligation.tipo, obligation.competencia, obligation.descricao].filter(Boolean).join(' · ') || 'Sem detalhes adicionais'}</small></div><span className="obligation-category">{obligation.categoria}</span><strong>{progress.total}</strong><strong>{progress.done}</strong><Progress value={progress.pct} /><time>{formatDate(nextDue)}</time><div className="obligation-row-actions"><button type="button" className="primary" onClick={() => openDetails(obligation)}>Clientes</button><button type="button" onClick={() => openDuplicate(obligation)}>Duplicar</button><button type="button" onClick={() => openEdit(obligation)}>Editar</button></div></article>
      })}{!rows.length ? <div className="obligation-empty">Nenhuma obrigação encontrada.</div> : null}</div>
    </section>

    {editing ? <Modal title={editing.id ? 'Editar obrigação' : 'Nova obrigação'} subtitle="Selecione clientes da base central; vínculos existentes mantêm seu histórico." onClose={() => setEditing(null)} wide><form className="obligation-form" onSubmit={saveObligation}>
      <Field label="Tipo da obrigação"><input value={editing.tipo} onChange={event => setField('tipo', event.target.value)} placeholder="Ex.: DEFIS, DASN-SIMEI" /></Field><Field label="Competência / Ano"><input value={editing.competencia} onChange={event => setField('competencia', event.target.value)} placeholder="Ex.: 2026 ou 2026-08" /></Field><Field label="Nome *" full><input value={editing.nome} onChange={event => setField('nome', event.target.value)} placeholder="Ex.: DEFIS 2026" /></Field><Field label="Categoria"><select value={editing.categoria} onChange={event => setField('categoria', event.target.value)}>{categoryChoices.map(name => <option key={name}>{name}</option>)}</select></Field><Field label="Descrição"><input value={editing.descricao} onChange={event => setField('descricao', event.target.value)} /></Field>
      <Field label={`Clientes * · ${selectedClients.size} selecionado(s)`} full hint="Clientes inativos aparecem somente quando já estavam vinculados."><div className="obligation-picker-tools"><input value={clientQuery} onChange={event => setClientQuery(event.target.value)} placeholder="Buscar cliente" /><button type="button" onClick={toggleVisibleClients}>{visiblePickerSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'}</button></div><div className="obligation-client-picker">{pickerClients.map(client => <label key={client.id}><input type="checkbox" checked={selectedClients.has(String(client.id))} onChange={() => toggleClient(String(client.id))} /><span><b>{clientName(client)}</b>{client.status === 'Inativo' ? <em>Inativo</em> : null}<small>{client.documento || 'Sem documento'}</small></span></label>)}{!pickerClients.length ? <p>Nenhum cliente disponível.</p> : null}</div></Field>
      <Field label="Observações" full><textarea value={editing.observacoes} onChange={event => setField('observacoes', event.target.value)} /></Field>{error ? <p className="obligation-error">{error}</p> : null}<footer className="obligation-form-actions"><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary">Salvar obrigação</button></footer>
    </form></Modal> : null}

    {details ? <ClientDetailsModal obligation={details.obligation} clientsById={clientsById} focusClientId={details.focusClientId} onClose={() => setDetails(null)} onSave={saveClientDetails} key={`${details.obligation.id}-${details.focusClientId}`} /> : null}
    {duplicate ? <Modal title="Criar nova competência" subtitle={`Duplicar ${duplicate.source.nome} sem copiar conclusões, vencimentos ou protocolos.`} onClose={() => setDuplicate(null)}><form className="obligation-form" onSubmit={saveDuplicate}><Field label="Nova competência / ano" full><input value={duplicate.competence} onChange={event => setDuplicate(current => ({ ...current, competence: event.target.value, error: '' }))} autoFocus /></Field><p className="obligation-duplicate-note">Somente clientes ativos serão vinculados à nova competência.</p>{duplicate.error ? <p className="obligation-error">{duplicate.error}</p> : null}<footer className="obligation-form-actions"><button type="button" onClick={() => setDuplicate(null)}>Cancelar</button><button type="submit" className="primary">Criar competência</button></footer></form></Modal> : null}
    {notice ? <div className="obligation-notice" role="status">{notice}</div> : null}
  </div>
}
