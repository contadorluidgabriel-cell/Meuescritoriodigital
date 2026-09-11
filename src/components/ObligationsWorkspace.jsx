import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { today, uid } from '../lib/storage.js'
import { obligationProgress, obligationStatuses } from '../lib/obligationUtils.js'
import { formatCnpj } from '../lib/thirdPartyWork.js'
import { clientPartnerIds } from '../lib/sharedWork.js'
import { workResponsibilityFields } from '../lib/sharedResponsibility.js'
import ObligationDeadlinesBoard from './ObligationDeadlinesBoard.jsx'

const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Empresa'
const entityDocument = entity => entity?.documento || entity?.cnpj || ''
const formatDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem vencimento'
const linkType = link => link?.entityType === 'linkedCompany' || link?.entidadeTipo === 'terceirizado' ? 'linkedCompany' : 'client'
const entityKey = (entityType, id) => `${entityType === 'linkedCompany' ? 'linkedCompany' : 'client'}|${String(id || '')}`
const splitEntityKey = key => { const [entityType, ...parts] = String(key || '').split('|'); return { entityType: entityType === 'linkedCompany' ? 'linkedCompany' : 'client', entityId: parts.join('|') } }
const settledStatus = status => status === 'Concluída' || status === 'Não se aplica'
const controlsReceipt = obligation => obligation?.controlaRecibo == null ? true : Boolean(obligation.controlaRecibo)
const usesCompetence = obligation => obligation?.usaCompetencia == null ? Boolean(obligation?.competencia) : Boolean(obligation.usaCompetencia)
const buildName = (base, competence, hasCompetence) => [String(base || '').trim(), hasCompetence ? String(competence || '').trim() : ''].filter(Boolean).join(' ')
const emptyLink = (entityId, entityType = 'client') => ({ clienteId: String(entityId), entityType, status: 'Pendente', vencimento: '', observacao: '', recibo: '', concluidoEm: '', compartilhadoResponsavel: '', compartilhadoParceiroId: '' })

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return <div className="obligation-modal obligation-v2-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className={`obligation-modal-card ${wide ? 'wide' : ''}`}><header><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>{children}</div></div>
}

function Field({ label, full = false, hint, children }) {
  return <label className={`obligation-field ${full ? 'full' : ''}`}><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>
}

function Progress({ value }) {
  return <div className="obligation-progress"><div><i style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} /></div><span>{value || 0}%</span></div>
}

function inferLinkType(link, clientsById, linkedCompaniesById) {
  const id = String(link?.clienteId || '')
  if (linkType(link) === 'linkedCompany' || (!clientsById.has(id) && linkedCompaniesById.has(id))) return 'linkedCompany'
  return 'client'
}

function obligationIsComplete(obligation) {
  const links = obligation?.clientes || []
  return links.length > 0 && links.every(link => settledStatus(link.status))
}

function dueInfo(obligation) {
  if (obligation?.vencimento) return { value: obligation.vencimento, mixed: false }
  const dates = [...new Set((obligation?.clientes || []).map(link => link.vencimento).filter(Boolean))]
  if (dates.length === 1) return { value: dates[0], mixed: false }
  return { value: '', mixed: dates.length > 1 }
}

function obligationSituation(obligation, currentDay = today()) {
  if (obligationIsComplete(obligation)) return 'Concluída'
  const due = dueInfo(obligation).value
  if (due && due < currentDay) return 'Atrasada'
  const statuses = (obligation.clientes || []).map(link => link.status || 'Pendente')
  if (statuses.includes('Em andamento') || statuses.some(settledStatus)) return 'Em andamento'
  if (statuses.includes('Aguardando cliente') && !statuses.includes('Pendente')) return 'Aguardando cliente'
  return 'Pendente'
}

function baseNameFromObligation(obligation) {
  if (obligation?.baseNome) return obligation.baseNome
  if (obligation?.tipo) return obligation.tipo
  const name = String(obligation?.nome || '').trim()
  const competence = String(obligation?.competencia || '').trim()
  if (competence && name.endsWith(competence)) return name.slice(0, -competence.length).trim()
  return name
}

function EntityPicker({ office, clientsById, selected, setSelected, query, setQuery, includeAvulsos, setIncludeAvulsos, hint = '' }) {
  const entities = useMemo(() => {
    const clients = (office.clients || []).map(entity => ({ ...entity, _entityType: 'client' }))
    const linked = (office.linkedCompanies || []).map(entity => ({ ...entity, _entityType: 'linkedCompany' }))
    return [...clients, ...linked].filter(entity => {
      const key = entityKey(entity._entityType, entity.id)
      const chosen = selected.has(key)
      if (entity.status === 'Inativo' && !chosen) return false
      if (entity._entityType === 'client' && entity.relacionamento === 'Avulso' && !includeAvulsos && !chosen) return false
      if (!query) return true
      const responsible = entity._entityType === 'linkedCompany' ? clientsById.get(String(entity.clientId || '')) : null
      return normalize(`${clientName(entity)} ${entityDocument(entity)} ${responsible ? clientName(responsible) : ''}`).includes(normalize(query))
    }).sort((a, b) => {
      if (a._entityType !== b._entityType) return a._entityType === 'client' ? -1 : 1
      return clientName(a).localeCompare(clientName(b), 'pt-BR')
    })
  }, [clientsById, includeAvulsos, office.clients, office.linkedCompanies, query, selected])

  const allVisibleSelected = entities.length > 0 && entities.every(entity => selected.has(entityKey(entity._entityType, entity.id)))
  function toggle(key) { setSelected(current => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next }) }
  function toggleVisible() { setSelected(current => { const next = new Set(current); entities.forEach(entity => { const key = entityKey(entity._entityType, entity.id); allVisibleSelected ? next.delete(key) : next.add(key) }); return next }) }

  return <div className="obligation-v2-picker-wrap">
    <div className="obligation-v2-picker-head"><label><input type="checkbox" checked={includeAvulsos} onChange={event => setIncludeAvulsos(event.target.checked)} /> Mostrar clientes avulsos</label><strong>{selected.size} selecionada(s)</strong></div>
    {hint ? <p className="obligation-v2-picker-hint">{hint}</p> : null}
    <div className="obligation-picker-tools"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar empresa, CNPJ ou cliente terceirizador" /><button type="button" onClick={toggleVisible}>{allVisibleSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'}</button></div>
    <div className="obligation-client-picker obligation-v2-picker">{entities.map(entity => {
      const linked = entity._entityType === 'linkedCompany'
      const key = entityKey(entity._entityType, entity.id)
      const responsible = linked ? clientsById.get(String(entity.clientId || '')) : null
      return <label key={key}><input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} /><span><b>{clientName(entity)}</b>{linked ? <em>Terceirizado</em> : entity.relacionamento === 'Avulso' ? <em>Avulso</em> : entity.status === 'Inativo' ? <em>Inativo</em> : <em className="client-badge">Cliente</em>}<small>{entityDocument(entity) || 'Sem documento'}{linked && responsible ? ` · via ${clientName(responsible)}` : ''}</small></span></label>
    })}{!entities.length ? <p>Nenhuma empresa encontrada.</p> : null}</div>
  </div>
}

function ClientDetailsModal({ obligation, clientsById, linkedCompaniesById, partners, focusClientId, onClose, onSave }) {
  const [rows, setRows] = useState(() => structuredClone(obligation.clientes || []))
  const originalByKey = useMemo(() => new Map((obligation.clientes || []).map(link => [entityKey(inferLinkType(link, clientsById, linkedCompaniesById), link.clienteId), link])), [clientsById, linkedCompaniesById, obligation.clientes])
  const receiptEnabled = controlsReceipt(obligation)
  const due = dueInfo(obligation)

  function changeRow(row, patch) {
    const rowKey = entityKey(inferLinkType(row, clientsById, linkedCompaniesById), row.clienteId)
    setRows(current => current.map(item => entityKey(inferLinkType(item, clientsById, linkedCompaniesById), item.clienteId) === rowKey ? { ...item, ...patch } : item))
  }

  function submit(event) {
    event.preventDefault()
    const savedRows = rows.map(row => {
      const key = entityKey(inferLinkType(row, clientsById, linkedCompaniesById), row.clienteId)
      const previous = originalByKey.get(key)
      let concluded = row.concluidoEm || ''
      if (row.status === 'Concluída' && previous?.status !== 'Concluída') concluded = today()
      if (row.status !== 'Concluída') concluded = ''
      return { ...row, concluidoEm: concluded }
    })
    onSave(savedRows)
  }

  return <Modal title={obligation.nome} subtitle={`${due.mixed ? 'Vencimentos diferentes no registro antigo' : `Vencimento: ${formatDate(due.value)}`} · atualize a situação de cada CNPJ.`} onClose={onClose} wide><form className="obligation-client-form obligation-v2-details" onSubmit={submit}><div className="obligation-client-list">{rows.map(row => {
    const entityType = inferLinkType(row, clientsById, linkedCompaniesById)
    const linked = entityType === 'linkedCompany'
    const entity = linked ? linkedCompaniesById.get(String(row.clienteId)) : clientsById.get(String(row.clienteId))
    const responsible = linked ? clientsById.get(String(entity?.clientId || '')) : null
    const sharedResponsibility = !linked ? workResponsibilityFields(row, entity, obligation.categoria) : { compartilhadoResponsavel: '', compartilhadoParceiroId: '' }
    const sharedPartnerIds = !linked ? clientPartnerIds(entity) : []
    const sharedPartners = sharedPartnerIds.map(id => (partners || []).find(partner => String(partner.id) === id)).filter(Boolean)
    return <article className={String(row.clienteId) === String(focusClientId) ? 'focused' : ''} key={entityKey(entityType, row.clienteId)}>
      <header><div><b>{clientName(entity)}</b>{linked ? <em>Terceirizado</em> : entity?.relacionamento === 'Avulso' ? <em>Avulso</em> : <em className="client-badge">Cliente</em>}<small>{entityDocument(entity) || 'Sem documento'}{linked && responsible ? ` · via ${clientName(responsible)}` : ''}</small></div><span className={`obligation-status status-${normalize(row.status).replaceAll(' ', '-')}`}>{row.status || 'Pendente'}</span></header>
      <div className="obligation-client-fields obligation-v2-client-fields">
        <Field label="Status"><select value={row.status || 'Pendente'} onChange={event => changeRow(row, { status: event.target.value })}>{obligationStatuses.map(status => <option key={status}>{status}</option>)}</select></Field>
        {receiptEnabled ? <Field label="Recibo / protocolo"><input value={row.recibo || ''} onChange={event => changeRow(row, { recibo: event.target.value })} placeholder="Número ou referência" /></Field> : null}
        {!linked && entity?.perfilAtendimento === 'Compartilhado' ? <><Field label="Responsabilidade"><select value={sharedResponsibility.compartilhadoResponsavel || 'Escritorio'} onChange={event => { const responsavel = event.target.value; changeRow(row, { compartilhadoResponsavel: responsavel, compartilhadoParceiroId: responsavel === 'Escritorio' ? '' : (sharedResponsibility.compartilhadoParceiroId || sharedPartnerIds[0] || '') }) }}><option value="Escritorio">Meu escritório</option><option value="Parceiro">Parceiro</option><option value="Ambos">Ambos</option></select></Field>{sharedResponsibility.compartilhadoResponsavel !== 'Escritorio' ? <Field label="Parceiro"><select value={sharedResponsibility.compartilhadoParceiroId || sharedPartnerIds[0] || ''} onChange={event => changeRow(row, { compartilhadoParceiroId: event.target.value })}>{sharedPartners.map(partner => <option value={partner.id} key={partner.id}>{partner.nome || partner.razao || 'Parceiro'}{partner.status === 'Inativo' ? ' (inativo)' : ''}</option>)}</select></Field> : null}</> : null}
      </div>
      {row.concluidoEm ? <p>Concluída em {formatDate(row.concluidoEm)}</p> : null}
    </article>
  })}</div><footer className="obligation-form-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="primary">Salvar alterações</button></footer></form></Modal>
}

export default function ObligationsWorkspace({ office, update, sync, onNavigate, initialObligationId = '', initialClientId = '', openObligationRequest = 0, access }) {
  const [tab, setTab] = useState('open')
  const [query, setQuery] = useState(''), [category, setCategory] = useState('')
  const [editing, setEditing] = useState(null), [selected, setSelected] = useState(new Set()), [entityQuery, setEntityQuery] = useState(''), [includeAvulsos, setIncludeAvulsos] = useState(false)
  const [details, setDetails] = useState(null)
  const [modelsOpen, setModelsOpen] = useState(false), [modelEditing, setModelEditing] = useState(null), [modelSelected, setModelSelected] = useState(new Set()), [modelQuery, setModelQuery] = useState(''), [modelIncludeAvulsos, setModelIncludeAvulsos] = useState(false)
  const [error, setError] = useState(''), [modelError, setModelError] = useState(''), [notice, setNotice] = useState('')
  const handledOpenRequest = useRef(0)

  const clientsById = useMemo(() => new Map((office.clients || []).map(client => [String(client.id), client])), [office.clients])
  const linkedCompaniesById = useMemo(() => new Map((office.linkedCompanies || []).map(company => [String(company.id), company])), [office.linkedCompanies])
  const departments = useMemo(() => (office.departments || []).filter(department => department.active !== false).map(department => department.name), [office.departments])
  const models = office.obligationModels || []
  const canManageModels = access?.membership?.role !== 'partner' && access?.membership?.permissions?.obligations !== false

  const filterCategories = useMemo(() => [...new Set([...departments, ...(office.obligations || []).map(item => item.categoria), 'Outros'].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [departments, office.obligations])
  const categoryChoices = useMemo(() => [...new Set([...departments, editing?.categoria, modelEditing?.categoria, 'Outros'].filter(Boolean))], [departments, editing?.categoria, modelEditing?.categoria])

  const matchesSearch = useCallback(obligation => {
    const linkedText = (obligation.clientes || []).map(link => {
      const id = String(link.clienteId || '')
      const type = inferLinkType(link, clientsById, linkedCompaniesById)
      const entity = type === 'linkedCompany' ? linkedCompaniesById.get(id) : clientsById.get(id)
      const responsible = type === 'linkedCompany' ? clientsById.get(String(entity?.clientId || '')) : null
      return `${clientName(entity)} ${entityDocument(entity)} ${responsible ? clientName(responsible) : ''}`
    }).join(' ')
    return (!query || normalize(`${obligation.nome} ${obligation.tipo} ${obligation.baseNome} ${obligation.competencia} ${linkedText}`).includes(normalize(query))) && (!category || obligation.categoria === category)
  }, [category, clientsById, linkedCompaniesById, query])

  const openRows = useMemo(() => (office.obligations || []).filter(item => !obligationIsComplete(item) && matchesSearch(item)), [matchesSearch, office.obligations])
  const historyRows = useMemo(() => (office.obligations || []).filter(item => obligationIsComplete(item) && matchesSearch(item)), [matchesSearch, office.obligations])
  const rows = tab === 'history' ? historyRows : openRows

  const summary = useMemo(() => {
    const day = today()
    const month = day.slice(0, 7)
    const obligations = office.obligations || []
    const open = obligations.filter(item => !obligationIsComplete(item))
    const dueToday = open.filter(item => dueInfo(item).value === day).length
    const overdue = open.filter(item => { const due = dueInfo(item).value; return Boolean(due && due < day) }).length
    const completedMonth = obligations.filter(item => obligationIsComplete(item) && (item.clientes || []).some(link => String(link.concluidoEm || '').startsWith(month))).length
    return { open: open.length, dueToday, overdue, completedMonth }
  }, [office.obligations])

  const openDetails = useCallback((obligation, focusClientId = '') => setDetails({ obligation, focusClientId }), [])

  useEffect(() => {
    if (!initialObligationId || !openObligationRequest || handledOpenRequest.current === openObligationRequest) return
    handledOpenRequest.current = openObligationRequest
    const obligation = (office.obligations || []).find(item => String(item.id) === String(initialObligationId))
    if (obligation) { if (obligationIsComplete(obligation)) setTab('history'); openDetails(obligation, initialClientId) }
  }, [initialClientId, initialObligationId, office.obligations, openDetails, openObligationRequest])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 2800)
    return () => clearTimeout(timer)
  }, [notice])

  function selectionFromLinks(links = []) {
    return new Set(links.map(link => entityKey(inferLinkType(link, clientsById, linkedCompaniesById), link.clienteId)))
  }

  function selectionFromModel(model) {
    const saved = Array.isArray(model?.vinculos) ? model.vinculos : []
    if (saved.length) return new Set(saved.map(item => entityKey(item.entityType, item.entityId ?? item.clienteId)))
    return new Set((model?.clientesIds || []).map(id => entityKey(linkedCompaniesById.has(String(id)) ? 'linkedCompany' : 'client', id)))
  }

  function emptyDraft() {
    return { id: '', modelId: '', baseNome: '', categoria: departments[0] || 'Fiscal', usaCompetencia: true, competencia: '', vencimento: '', vencimentoMixed: false, vencimentoTouched: false, controlaRecibo: false, descricao: '', observacoes: '', terceirizado: false, terceiroCnpj: '', terceiroNome: '' }
  }

  function openNew(model = null) {
    const draft = emptyDraft()
    if (model) Object.assign(draft, { modelId: model.id, baseNome: model.nome || '', categoria: model.categoria || draft.categoria, usaCompetencia: Boolean(model.usaCompetencia), controlaRecibo: Boolean(model.controlaRecibo) })
    setEditing(draft)
    setSelected(model ? selectionFromModel(model) : new Set())
    setEntityQuery('')
    setIncludeAvulsos(model ? [...selectionFromModel(model)].some(key => { const { entityType, entityId } = splitEntityKey(key); return entityType === 'client' && clientsById.get(entityId)?.relacionamento === 'Avulso' }) : false)
    setError('')
    setModelsOpen(false)
  }

  function openEdit(obligation) {
    const due = dueInfo(obligation)
    setEditing({ ...structuredClone(obligation), baseNome: baseNameFromObligation(obligation), usaCompetencia: usesCompetence(obligation), controlaRecibo: controlsReceipt(obligation), vencimento: due.value, vencimentoMixed: due.mixed, vencimentoTouched: false, modelId: obligation.modelId || '' })
    const current = selectionFromLinks(obligation.clientes || [])
    setSelected(current)
    setEntityQuery('')
    setIncludeAvulsos([...current].some(key => { const { entityType, entityId } = splitEntityKey(key); return entityType === 'client' && clientsById.get(entityId)?.relacionamento === 'Avulso' }))
    setError('')
  }

  function applyModelToDraft(modelId) {
    const model = models.find(item => String(item.id) === String(modelId))
    if (!model) { setEditing(current => ({ ...current, modelId: '' })); return }
    setEditing(current => ({ ...current, modelId: model.id, baseNome: model.nome || '', categoria: model.categoria || current.categoria, usaCompetencia: Boolean(model.usaCompetencia), competencia: model.usaCompetencia ? current.competencia : '', controlaRecibo: Boolean(model.controlaRecibo) }))
    const next = selectionFromModel(model)
    setSelected(next)
    setIncludeAvulsos([...next].some(key => { const { entityType, entityId } = splitEntityKey(key); return entityType === 'client' && clientsById.get(entityId)?.relacionamento === 'Avulso' }))
  }

  function setField(name, value) { setEditing(current => ({ ...current, [name]: value })) }

  function saveObligation(event) {
    event.preventDefault()
    const base = String(editing.baseNome || '').trim()
    const competence = editing.usaCompetencia ? String(editing.competencia || '').trim() : ''
    if (!base) { setError('Informe o nome da obrigação.'); return }
    if (editing.usaCompetencia && !competence) { setError('Informe a competência / referência.'); return }
    if (!selected.size) { setError('Selecione pelo menos uma empresa.'); return }

    const previous = editing.id ? (office.obligations || []).find(item => String(item.id) === String(editing.id)) : null
    const previousLinks = new Map((previous?.clientes || []).map(link => [entityKey(inferLinkType(link, clientsById, linkedCompaniesById), link.clienteId), link]))
    const links = [...selected].map(key => {
      const { entityType, entityId } = splitEntityKey(key)
      const old = previousLinks.get(key)
      const link = { ...structuredClone(old || emptyLink(entityId, entityType)), clienteId: entityId, entityType }
      if (!previous || editing.vencimentoTouched || !old) link.vencimento = editing.vencimento || ''
      return entityType === 'client' ? { ...link, ...workResponsibilityFields(link, clientsById.get(entityId), editing.categoria) } : link
    })
    const ids = links.map(link => String(link.clienteId))
    const legacy = previous ? { terceirizado: Boolean(previous.terceirizado), terceiroCnpj: previous.terceiroCnpj || '', terceiroNome: previous.terceiroNome || '' } : { terceirizado: false, terceiroCnpj: '', terceiroNome: '' }
    const obligation = {
      ...(previous || {}), id: editing.id || uid('obr'), modelId: editing.modelId || '', baseNome: base, tipo: base,
      usaCompetencia: Boolean(editing.usaCompetencia), competencia: competence, nome: buildName(base, competence, Boolean(editing.usaCompetencia)),
      categoria: editing.categoria || 'Outros', vencimento: editing.vencimentoMixed && !editing.vencimentoTouched ? (previous?.vencimento || '') : (editing.vencimento || ''),
      controlaRecibo: Boolean(editing.controlaRecibo), descricao: String(editing.descricao || '').trim(), observacoes: String(editing.observacoes || '').trim(),
      clientesIds: ids, clientes: links, ...legacy,
    }
    update(draft => { draft.obligations = previous ? (draft.obligations || []).map(item => String(item.id) === String(obligation.id) ? obligation : item) : [...(draft.obligations || []), obligation] })
    setEditing(null)
    setNotice(previous ? 'Obrigação atualizada.' : 'Obrigação criada.')
  }

  function saveClientDetails(clientRows) {
    const obligationId = details.obligation.id
    update(draft => { draft.obligations = (draft.obligations || []).map(item => String(item.id) === String(obligationId) ? { ...item, clientes: clientRows, clientesIds: clientRows.map(link => String(link.clienteId)) } : item) })
    setDetails(null)
    setNotice('Situações atualizadas.')
  }

  function openNewModel() {
    setModelEditing({ id: '', nome: '', categoria: departments[0] || 'Fiscal', usaCompetencia: true, controlaRecibo: false })
    setModelSelected(new Set())
    setModelQuery('')
    setModelIncludeAvulsos(false)
    setModelError('')
  }

  function openEditModel(model) {
    const chosen = selectionFromModel(model)
    setModelEditing({ ...structuredClone(model), nome: model.nome || '', categoria: model.categoria || departments[0] || 'Fiscal', usaCompetencia: Boolean(model.usaCompetencia), controlaRecibo: Boolean(model.controlaRecibo) })
    setModelSelected(chosen)
    setModelQuery('')
    setModelIncludeAvulsos([...chosen].some(key => { const { entityType, entityId } = splitEntityKey(key); return entityType === 'client' && clientsById.get(entityId)?.relacionamento === 'Avulso' }))
    setModelError('')
  }

  function saveModel(event) {
    event.preventDefault()
    const name = String(modelEditing.nome || '').trim()
    if (!name) { setModelError('Informe o nome do modelo.'); return }
    const model = { ...modelEditing, id: modelEditing.id || uid('obm'), nome: name, categoria: modelEditing.categoria || 'Outros', usaCompetencia: Boolean(modelEditing.usaCompetencia), controlaRecibo: Boolean(modelEditing.controlaRecibo), vinculos: [...modelSelected].map(key => { const { entityType, entityId } = splitEntityKey(key); return { entityId, entityType } }) }
    update(draft => { draft.obligationModels = modelEditing.id ? (draft.obligationModels || []).map(item => String(item.id) === String(model.id) ? model : item) : [...(draft.obligationModels || []), model] })
    setModelEditing(null)
    setNotice('Modelo salvo.')
  }

  function deleteModel(model) {
    if (!window.confirm(`Excluir o modelo “${model.nome}”? As obrigações já criadas não serão alteradas.`)) return
    update(draft => { draft.obligationModels = (draft.obligationModels || []).filter(item => String(item.id) !== String(model.id)) })
    setNotice('Modelo excluído.')
  }

  return <div className="react-module-page obligations-page obligations-v2-page">
    <div className="react-module-topbar"><div><h1>Obrigações</h1><p>Acompanhe o que vence, o que está pendente e o que já foi entregue.</p></div><div className="react-module-actions"><span className="sync-indicator">{sync}</span>{canManageModels ? <button type="button" onClick={() => setModelsOpen(true)}>Modelos</button> : null}<button type="button" className="primary" onClick={() => openNew()}>+ Nova obrigação</button></div></div>

    <section className="obligation-v2-summary" aria-label="Resumo das obrigações">
      <button type="button" className={tab === 'open' ? 'active' : ''} onClick={() => setTab('open')}><small>Em aberto</small><strong>{summary.open}</strong><span>Exigem acompanhamento</span></button>
      <div><small>Vencem hoje</small><strong>{summary.dueToday}</strong><span>Prazo no dia</span></div>
      <div className={summary.overdue ? 'danger' : ''}><small>Atrasadas</small><strong>{summary.overdue}</strong><span>Prazo ultrapassado</span></div>
      <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><small>Concluídas no mês</small><strong>{summary.completedMonth}</strong><span>Abrir histórico</span></button>
    </section>

    {tab === 'open' ? <ObligationDeadlinesBoard office={office} onNavigate={onNavigate} onOpenObligation={(obligationId, clientId) => { const obligation = (office.obligations || []).find(item => String(item.id) === String(obligationId)); if (obligation) openDetails(obligation, clientId) }} /> : null}

    <section className="obligations-card obligation-v2-card">
      <div className="obligation-v2-toolbar"><div className="obligation-v2-tabs"><button type="button" className={tab === 'open' ? 'active' : ''} onClick={() => setTab('open')}>Em aberto <span>{(office.obligations || []).filter(item => !obligationIsComplete(item)).length}</span></button><button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Histórico <span>{(office.obligations || []).filter(obligationIsComplete).length}</span></button></div><div className="obligation-filters"><input value={query} onChange={event => setQuery(event.target.value)} placeholder={tab === 'history' ? 'Buscar por obrigação, competência, cliente ou CNPJ' : 'Buscar obrigação, cliente ou CNPJ'} /><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todos os departamentos</option>{filterCategories.map(name => <option key={name}>{name}</option>)}</select></div></div>
      <div className="obligation-table obligation-v2-table"><div className="obligation-row obligation-head"><span>Obrigação</span><span>Departamento</span><span>Empresas</span><span>Progresso</span><span>Vencimento</span><span>Situação</span><span /></div>{rows.map(obligation => {
        const progress = obligationProgress(obligation)
        const complete = obligationIsComplete(obligation)
        const pct = complete ? 100 : progress.pct
        const due = dueInfo(obligation)
        const situation = obligationSituation(obligation)
        return <article className="obligation-row" key={obligation.id}><div className="obligation-title"><b>{obligation.nome}</b><small>{[obligation.competencia && `Referência ${obligation.competencia}`, controlsReceipt(obligation) && 'Com recibo/protocolo'].filter(Boolean).join(' · ') || 'Sem referência adicional'}</small></div><span className="obligation-category">{obligation.categoria || 'Outros'}</span><strong>{progress.total}</strong><div className="obligation-v2-progress-cell"><b>{progress.done} de {progress.applicable}</b><Progress value={pct} /></div><time>{due.mixed ? 'Datas diferentes' : formatDate(due.value)}</time><span className={`obligation-v2-situation situation-${normalize(situation).replaceAll(' ', '-')}`}>{situation}</span><div className="obligation-row-actions"><button type="button" className="primary" onClick={() => openDetails(obligation)}>{tab === 'history' ? 'Consultar' : 'Acompanhar'}</button><button type="button" onClick={() => openEdit(obligation)}>Editar</button></div></article>
      })}{!rows.length ? <div className="obligation-empty">{tab === 'history' ? 'Nenhuma obrigação concluída encontrada.' : 'Nenhuma obrigação em aberto encontrada.'}</div> : null}</div>
    </section>

    {editing ? <Modal title={editing.id ? 'Editar obrigação' : 'Nova obrigação'} subtitle={editing.id ? 'Atualize os dados gerais sem perder o acompanhamento dos CNPJs.' : 'Use um modelo ou monte uma obrigação em poucos passos.'} onClose={() => setEditing(null)} wide><form className="obligation-form obligation-v2-form" onSubmit={saveObligation}>
      {!editing.id && models.length ? <Field label="Começar por um modelo" full><select value={editing.modelId || ''} onChange={event => applyModelToDraft(event.target.value)}><option value="">Criar sem modelo</option>{models.map(model => <option value={model.id} key={model.id}>{model.nome}</option>)}</select></Field> : null}
      <Field label="Obrigação *"><input value={editing.baseNome || ''} onChange={event => setField('baseNome', event.target.value)} placeholder="Ex.: PGDAS-D" /></Field><Field label="Departamento"><select value={editing.categoria || ''} onChange={event => setField('categoria', event.target.value)}>{categoryChoices.map(name => <option key={name}>{name}</option>)}</select></Field>
      <Field label="Competência / referência" full><div className="obligation-v2-check"><label><input type="checkbox" checked={Boolean(editing.usaCompetencia)} onChange={event => setEditing(current => ({ ...current, usaCompetencia: event.target.checked, competencia: event.target.checked ? current.competencia : '' }))} /> Esta obrigação usa competência ou referência</label></div></Field>
      {editing.usaCompetencia ? <Field label="Competência / referência *"><input value={editing.competencia || ''} onChange={event => setField('competencia', event.target.value)} placeholder="Ex.: 09/2026 ou 2026" /></Field> : null}
      <Field label="Vencimento" hint={editing.vencimentoMixed && !editing.vencimentoTouched ? 'Este registro antigo possui datas diferentes por CNPJ. Escolha uma data apenas se quiser unificar.' : 'Opcional. Pode ser alterado depois.'}><input type="date" value={editing.vencimento || ''} onChange={event => setEditing(current => ({ ...current, vencimento: event.target.value, vencimentoTouched: true, vencimentoMixed: false }))} /></Field>
      <Field label="Recibo / protocolo" full><div className="obligation-v2-check"><label><input type="checkbox" checked={Boolean(editing.controlaRecibo)} onChange={event => setField('controlaRecibo', event.target.checked)} /> Esta obrigação possui controle de recibo ou protocolo por CNPJ</label></div></Field>
      <div className="obligation-v2-name-preview"><small>Nome que será criado</small><strong>{buildName(editing.baseNome, editing.competencia, editing.usaCompetencia) || 'Informe a obrigação'}</strong></div>
      {editing.terceirizado ? <div className="obligation-v2-legacy"><b>Referência terceirizada antiga</b><span>{editing.terceiroNome || 'Sem nome'} · {formatCnpj(editing.terceiroCnpj)}</span><small>O registro foi preservado. Novos terceirizados são escolhidos diretamente na lista de empresas.</small></div> : null}
      <Field label="Empresas *" full><EntityPicker office={office} clientsById={clientsById} selected={selected} setSelected={setSelected} query={entityQuery} setQuery={setEntityQuery} includeAvulsos={includeAvulsos} setIncludeAvulsos={setIncludeAvulsos} hint="A obrigação é criada uma vez. O status será acompanhado separadamente para cada CNPJ." /></Field>
      <Field label="Observações" full><textarea value={editing.observacoes || ''} onChange={event => setField('observacoes', event.target.value)} placeholder="Observação geral opcional" /></Field>
      {error ? <p className="obligation-error">{error}</p> : null}<footer className="obligation-form-actions"><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary">{editing.id ? 'Salvar alterações' : 'Criar obrigação'}</button></footer>
    </form></Modal> : null}

    {modelsOpen ? <Modal title="Modelos de obrigação" subtitle="Guarde a configuração que se repete. Vencimento e competência são informados ao criar cada obrigação." onClose={() => setModelsOpen(false)} wide><div className="obligation-v2-models"><div className="obligation-v2-model-actions"><p>{models.length ? `${models.length} modelo(s) salvo(s)` : 'Você ainda não criou modelos.'}</p><button type="button" className="primary" onClick={openNewModel}>+ Novo modelo</button></div><div className="obligation-v2-model-grid">{models.map(model => <article key={model.id}><div><strong>{model.nome}</strong><small>{model.categoria || 'Outros'} · {model.usaCompetencia ? 'Usa competência' : 'Sem competência'}{model.controlaRecibo ? ' · Controla recibo/protocolo' : ''}</small><span>{(model.vinculos || model.clientesIds || []).length} empresa(s) padrão</span></div><footer><button type="button" className="primary" onClick={() => openNew(model)}>Usar</button><button type="button" onClick={() => openEditModel(model)}>Editar</button><button type="button" className="danger-text" onClick={() => deleteModel(model)}>Excluir</button></footer></article>)}{!models.length ? <div className="obligation-empty">Crie um modelo para não selecionar as mesmas empresas toda vez.</div> : null}</div></div></Modal> : null}

    {modelEditing ? <Modal title={modelEditing.id ? 'Editar modelo' : 'Novo modelo'} subtitle="O modelo guarda somente o que normalmente se repete. Ele não cria recorrências automáticas." onClose={() => setModelEditing(null)} wide><form className="obligation-form obligation-v2-form" onSubmit={saveModel}>
      <Field label="Nome do modelo *"><input value={modelEditing.nome || ''} onChange={event => setModelEditing(current => ({ ...current, nome: event.target.value }))} placeholder="Ex.: PGDAS-D" /></Field><Field label="Departamento"><select value={modelEditing.categoria || ''} onChange={event => setModelEditing(current => ({ ...current, categoria: event.target.value }))}>{categoryChoices.map(name => <option key={name}>{name}</option>)}</select></Field>
      <Field label="Competência / referência" full><div className="obligation-v2-check"><label><input type="checkbox" checked={Boolean(modelEditing.usaCompetencia)} onChange={event => setModelEditing(current => ({ ...current, usaCompetencia: event.target.checked }))} /> Ao usar este modelo, pedir competência ou referência</label></div></Field>
      <Field label="Recibo / protocolo" full><div className="obligation-v2-check"><label><input type="checkbox" checked={Boolean(modelEditing.controlaRecibo)} onChange={event => setModelEditing(current => ({ ...current, controlaRecibo: event.target.checked }))} /> Controlar recibo ou protocolo individual por CNPJ</label></div></Field>
      <Field label="Empresas padrão" full><EntityPicker office={office} clientsById={clientsById} selected={modelSelected} setSelected={setModelSelected} query={modelQuery} setQuery={setModelQuery} includeAvulsos={modelIncludeAvulsos} setIncludeAvulsos={setModelIncludeAvulsos} hint="Você poderá adicionar ou retirar empresas toda vez que usar o modelo, sem alterar esta lista padrão." /></Field>
      {modelError ? <p className="obligation-error">{modelError}</p> : null}<footer className="obligation-form-actions"><button type="button" onClick={() => setModelEditing(null)}>Cancelar</button><button className="primary">Salvar modelo</button></footer>
    </form></Modal> : null}

    {details ? <ClientDetailsModal obligation={details.obligation} clientsById={clientsById} linkedCompaniesById={linkedCompaniesById} partners={office.partners || []} focusClientId={details.focusClientId} onClose={() => setDetails(null)} onSave={saveClientDetails} key={`${details.obligation.id}-${details.focusClientId}`} /> : null}
    {notice ? <div className="obligation-notice" role="status">{notice}</div> : null}
  </div>
}
