import { useEffect, useMemo, useState } from 'react'
import { isDone } from '../lib/storage.js'
import { listWorkspaceMembers } from '../lib/workspaceSync.js'
import {
  WORK_KIND_LABELS,
  applyWorkResponsible,
  eligibleMembersForWork,
  memberCanReceiveWork,
  workAssignmentKey,
} from '../lib/workDistribution.js'
import '../work-distribution.css'

const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const memberName = member => member?.display_name || member?.email || 'Usuário'
const internalMember = member => ['admin', 'collaborator'].includes(String(member?.role || ''))
const dateLabel = value => {
  if (!value) return 'Sem prazo'
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? 'Sem prazo' : date.toLocaleDateString('pt-BR')
}
const dueClass = value => {
  if (!value) return 'neutral'
  const due = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(due.getTime())) return 'neutral'
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return 'overdue'
  if (diff <= 3) return 'soon'
  return 'normal'
}

function buildRows(office = {}, clientNames = new Map()) {
  const rows = []
  ;(office.tasks || []).forEach(task => {
    if (isDone(task.status)) return
    const clientId = String(task.clientId || '')
    rows.push({
      kind: 'task', id: String(task.id), clientId,
      title: task.titulo || task.nome || 'Tarefa',
      client: clientId ? clientNames.get(clientId) || 'Cliente' : 'Interna',
      due: task.prazo || task.vencimento || '',
      responsible: String(task.responsavelUserId || ''),
    })
  })
  ;(office.processes || []).forEach(process => {
    if (isDone(process.status)) return
    const clientId = String(process.clientId || '')
    rows.push({
      kind: 'process', id: String(process.id), clientId,
      title: process.tipo || process.nome || 'Processo',
      client: clientNames.get(clientId) || 'Cliente',
      due: process.prazoFinal || process.prazo || '',
      responsible: String(process.responsavelUserId || ''),
    })
  })
  ;(office.obligations || []).forEach(obligation => (obligation.clientes || []).forEach(link => {
    if (isDone(link.status) || link.status === 'Não se aplica') return
    const clientId = String(link.clienteId || '')
    rows.push({
      kind: 'obligation', id: String(obligation.id), clientId,
      title: obligation.nome || 'Obrigação',
      client: clientNames.get(clientId) || 'Cliente',
      due: link.vencimento || obligation.vencimento || '',
      responsible: String(link.responsavelUserId || ''),
    })
  }))
  return rows.sort((a, b) => {
    const aDue = String(a.due || '9999-12-31')
    const bDue = String(b.due || '9999-12-31')
    return aDue.localeCompare(bDue) || a.client.localeCompare(b.client, 'pt-BR') || a.title.localeCompare(b.title, 'pt-BR')
  })
}

export default function WorkDistribution({ office, update, access, onRefresh }) {
  const workspaceId = access?.workspace?.id || ''
  const ownerUserId = String(access?.workspace?.owner_user_id || '')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [responsibleFilter, setResponsibleFilter] = useState('all')
  const [selectedKeys, setSelectedKeys] = useState(() => new Set())
  const [bulkTarget, setBulkTarget] = useState('__choose__')

  const clients = useMemo(() => (office.clients || []).slice().sort((a, b) => clientName(a).localeCompare(clientName(b), 'pt-BR')), [office.clients])
  const clientNames = useMemo(() => new Map(clients.map(client => [String(client.id), clientName(client)])), [clients])
  const rows = useMemo(() => buildRows(office, clientNames), [clientNames, office.obligations, office.processes, office.tasks])
  const memberByUserId = useMemo(() => new Map(members.filter(member => member.user_id).map(member => [String(member.user_id), member])), [members])
  const assignableMembers = useMemo(() => members.filter(member => member.status === 'active' && member.user_id && internalMember(member)).sort((a, b) => memberName(a).localeCompare(memberName(b), 'pt-BR')), [members])

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter(row => {
      if (needle && !`${row.title} ${row.client}`.toLowerCase().includes(needle)) return false
      if (companyFilter === '__internal__' && row.clientId) return false
      if (companyFilter !== 'all' && companyFilter !== '__internal__' && row.clientId !== companyFilter) return false
      if (kindFilter !== 'all' && row.kind !== kindFilter) return false
      if (responsibleFilter === '__unassigned__' && row.responsible) return false
      if (responsibleFilter !== 'all' && responsibleFilter !== '__unassigned__' && row.responsible !== responsibleFilter) return false
      return true
    })
  }, [companyFilter, kindFilter, query, responsibleFilter, rows])

  const selectedRows = useMemo(() => rows.filter(row => selectedKeys.has(workAssignmentKey(row))), [rows, selectedKeys])
  const targetMember = bulkTarget && !bulkTarget.startsWith('__') ? memberByUserId.get(String(bulkTarget)) : null
  const compatibleSelected = useMemo(() => {
    if (bulkTarget === '__unassigned__') return selectedRows
    if (!targetMember) return []
    return selectedRows.filter(row => memberCanReceiveWork(targetMember, row, ownerUserId))
  }, [bulkTarget, ownerUserId, selectedRows, targetMember])

  const counters = useMemo(() => ({
    total: rows.length,
    unassigned: rows.filter(row => !row.responsible).length,
    tasks: rows.filter(row => row.kind === 'task').length,
    processes: rows.filter(row => row.kind === 'process').length,
    obligations: rows.filter(row => row.kind === 'obligation').length,
  }), [rows])

  async function loadMembers() {
    if (!workspaceId) return
    setLoading(true)
    try {
      const result = await listWorkspaceMembers(workspaceId)
      setMembers(result.members || [])
    } catch (error) {
      setMessage(error?.message || 'Não foi possível carregar os usuários.')
    } finally { setLoading(false) }
  }

  useEffect(() => { loadMembers() }, [workspaceId])
  useEffect(() => {
    const existing = new Set(rows.map(workAssignmentKey))
    setSelectedKeys(current => new Set([...current].filter(key => existing.has(key))))
  }, [rows])

  function setResponsible(row, userId) {
    const target = userId ? memberByUserId.get(String(userId)) : null
    if (target && !memberCanReceiveWork(target, row, ownerUserId)) {
      setMessage(`${memberName(target)} não possui acesso compatível com este trabalho.`)
      return
    }
    update(draft => { applyWorkResponsible(draft, row, userId) })
    setMessage(userId ? `Trabalho atribuído a ${memberName(target)}.` : 'Trabalho deixado como não atribuído.')
  }

  function applyBulk() {
    if (!selectedRows.length || bulkTarget === '__choose__') return
    const targetUserId = bulkTarget === '__unassigned__' ? '' : String(bulkTarget)
    const allowedRows = bulkTarget === '__unassigned__'
      ? selectedRows
      : selectedRows.filter(row => targetMember && memberCanReceiveWork(targetMember, row, ownerUserId))
    if (!allowedRows.length) {
      setMessage('Nenhum dos trabalhos selecionados é compatível com o usuário escolhido.')
      return
    }
    const timestamp = new Date().toISOString()
    update(draft => { allowedRows.forEach(row => applyWorkResponsible(draft, row, targetUserId, timestamp)) })
    const skipped = selectedRows.length - allowedRows.length
    const targetLabel = bulkTarget === '__unassigned__' ? 'Não atribuído' : memberName(targetMember)
    setMessage(`${allowedRows.length} trabalho(s) movido(s) para ${targetLabel}.${skipped ? ` ${skipped} ignorado(s) por falta de acesso compatível.` : ''}`)
    setSelectedKeys(new Set())
    setBulkTarget('__choose__')
  }

  function toggleRow(row) {
    const key = workAssignmentKey(row)
    setSelectedKeys(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  function toggleVisible() {
    const visibleKeys = filteredRows.map(workAssignmentKey)
    const allSelected = visibleKeys.length && visibleKeys.every(key => selectedKeys.has(key))
    setSelectedKeys(current => {
      const next = new Set(current)
      visibleKeys.forEach(key => { if (allSelected) next.delete(key); else next.add(key) })
      return next
    })
  }

  if (loading) return <div className="work-distribution-shell"><div className="work-distribution-loading">Carregando distribuição…</div></div>

  return <div className="work-distribution-shell">
    <header className="work-distribution-hero">
      <div><span>Operação</span><h1>Distribuição</h1><p>Veja tudo que está aberto, encontre trabalhos sem responsável e distribua individualmente ou em lote.</p></div>
      <button type="button" onClick={() => { loadMembers(); onRefresh?.() }}>Atualizar</button>
    </header>

    {message ? <div className="work-distribution-message">{message}</div> : null}

    <section className="work-distribution-kpis" aria-label="Resumo da distribuição">
      <article><span>Em aberto</span><strong>{counters.total}</strong></article>
      <article className={counters.unassigned ? 'attention' : ''}><span>Não atribuídos</span><strong>{counters.unassigned}</strong></article>
      <article><span>Tarefas</span><strong>{counters.tasks}</strong></article>
      <article><span>Processos</span><strong>{counters.processes}</strong></article>
      <article><span>Obrigações</span><strong>{counters.obligations}</strong></article>
    </section>

    <section className="work-distribution-panel">
      <div className="work-distribution-filters">
        <label className="wide"><span>Buscar</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Trabalho ou empresa…" /></label>
        <label><span>Empresa</span><select value={companyFilter} onChange={event => setCompanyFilter(event.target.value)}><option value="all">Todas</option><option value="__internal__">Internas</option>{clients.map(client => <option key={client.id} value={String(client.id)}>{clientName(client)}</option>)}</select></label>
        <label><span>Tipo</span><select value={kindFilter} onChange={event => setKindFilter(event.target.value)}><option value="all">Todos</option><option value="task">Tarefas</option><option value="process">Processos</option><option value="obligation">Obrigações</option></select></label>
        <label><span>Responsável</span><select value={responsibleFilter} onChange={event => setResponsibleFilter(event.target.value)}><option value="all">Todos</option><option value="__unassigned__">Não atribuídos</option>{assignableMembers.map(member => <option key={member.id} value={String(member.user_id)}>{memberName(member)}</option>)}</select></label>
      </div>

      <div className="work-distribution-bulk">
        <div><button type="button" onClick={toggleVisible}>{filteredRows.length && filteredRows.every(row => selectedKeys.has(workAssignmentKey(row))) ? 'Desmarcar visíveis' : 'Selecionar visíveis'}</button><span>{selectedRows.length} selecionado(s)</span></div>
        <div className="work-distribution-bulk-action">
          <select value={bulkTarget} onChange={event => setBulkTarget(event.target.value)}>
            <option value="__choose__">Atribuir selecionados para…</option>
            <option value="__unassigned__">Não atribuído</option>
            {assignableMembers.map(member => <option key={member.id} value={String(member.user_id)}>{memberName(member)}</option>)}
          </select>
          {selectedRows.length && bulkTarget !== '__choose__' ? <small>{compatibleSelected.length}/{selectedRows.length} compatível(is)</small> : null}
          <button type="button" className="primary" disabled={!selectedRows.length || bulkTarget === '__choose__' || !compatibleSelected.length} onClick={applyBulk}>Aplicar</button>
        </div>
      </div>

      <div className="work-distribution-table-wrap">
        <table className="work-distribution-table">
          <thead><tr><th aria-label="Selecionar" /><th>Trabalho</th><th>Empresa</th><th>Prazo</th><th>Responsável</th></tr></thead>
          <tbody>{filteredRows.length ? filteredRows.map(row => {
            const key = workAssignmentKey(row)
            const eligible = eligibleMembersForWork(assignableMembers, row, ownerUserId)
            const currentMember = row.responsible ? memberByUserId.get(row.responsible) : null
            const currentEligible = currentMember ? memberCanReceiveWork(currentMember, row, ownerUserId) : true
            return <tr key={key} className={!row.responsible ? 'unassigned' : ''}>
              <td><input type="checkbox" checked={selectedKeys.has(key)} onChange={() => toggleRow(row)} aria-label={`Selecionar ${row.title}`} /></td>
              <td><div className="work-distribution-work"><span className={`kind ${row.kind}`}>{WORK_KIND_LABELS[row.kind]}</span><strong>{row.title}</strong>{!row.responsible ? <small className="needs-owner">Precisa de responsável</small> : null}</div></td>
              <td><span className="work-distribution-company">{row.client}</span></td>
              <td><span className={`work-distribution-due ${dueClass(row.due)}`}>{dateLabel(row.due)}</span></td>
              <td><div className="work-distribution-owner-cell"><select value={row.responsible} onChange={event => setResponsible(row, event.target.value)}><option value="">Não atribuído</option>{currentMember && !currentEligible ? <option value={row.responsible} disabled>{memberName(currentMember)} · sem acesso atual</option> : null}{eligible.map(member => <option key={member.id} value={String(member.user_id)}>{memberName(member)}</option>)}</select>{!eligible.length ? <small>Nenhum usuário com acesso compatível</small> : null}</div></td>
            </tr>
          }) : <tr><td colSpan="5"><div className="work-distribution-empty">Nenhum trabalho encontrado com estes filtros.</div></td></tr>}</tbody>
        </table>
      </div>
      <footer className="work-distribution-footer"><strong>{filteredRows.length}</strong> de {rows.length} trabalho(s) exibido(s). <span>Parceiros operacionais serão tratados na etapa Parceiros V2.</span></footer>
    </section>
  </div>
}
