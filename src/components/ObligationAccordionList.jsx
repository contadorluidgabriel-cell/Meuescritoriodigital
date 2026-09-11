import { useEffect, useMemo, useState } from 'react'
import { obligationProgress } from '../lib/obligationUtils.js'
import { today } from '../lib/storage.js'
import './obligation-accordion-list.css'

const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Empresa'
const entityDocument = entity => entity?.documento || entity?.cnpj || ''
const settledStatus = status => status === 'Concluída' || status === 'Não se aplica'
const formatDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem vencimento'

function inferLinkType(link, clientsById, linkedCompaniesById) {
  const id = String(link?.clienteId || '')
  if (link?.entityType === 'linkedCompany' || link?.entidadeTipo === 'terceirizado') return 'linkedCompany'
  if (!clientsById.has(id) && linkedCompaniesById.has(id)) return 'linkedCompany'
  return 'client'
}

function controlsReceipt(obligation = {}) {
  return obligation.controlaRecibo == null ? true : Boolean(obligation.controlaRecibo)
}

function dueInfo(obligation = {}) {
  if (obligation.vencimento) return { value: obligation.vencimento, mixed: false }
  const dates = [...new Set((obligation.clientes || []).map(link => link.vencimento).filter(Boolean))]
  if (dates.length === 1) return { value: dates[0], mixed: false }
  return { value: '', mixed: dates.length > 1 }
}

function obligationComplete(obligation = {}) {
  const links = obligation.clientes || []
  return links.length > 0 && links.every(link => settledStatus(link.status))
}

function situationFor(obligation = {}) {
  if (obligationComplete(obligation)) return 'Concluída'
  const due = dueInfo(obligation).value
  if (due && due < today()) return 'Atrasada'
  const statuses = (obligation.clientes || []).map(link => link.status || 'Pendente')
  if (statuses.includes('Em andamento') || statuses.some(settledStatus)) return 'Em andamento'
  if (statuses.includes('Aguardando cliente') && !statuses.includes('Pendente')) return 'Aguardando cliente'
  return 'Pendente'
}

function ProgressBar({ value = 0 }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return <div className="obligation-accordion-progress" aria-label={`${pct}% concluído`}><span><i style={{ width: `${pct}%` }} /></span><b>{pct}%</b></div>
}

export default function ObligationAccordionList({ rows = [], office = {}, tab = 'open', onOpenDetails, onEdit }) {
  const [expanded, setExpanded] = useState(() => new Set())
  const clientsById = useMemo(() => new Map((office.clients || []).map(client => [String(client.id), client])), [office.clients])
  const linkedCompaniesById = useMemo(() => new Map((office.linkedCompanies || []).map(company => [String(company.id), company])), [office.linkedCompanies])

  useEffect(() => {
    const valid = new Set(rows.map(item => String(item.id)))
    setExpanded(current => {
      const next = new Set([...current].filter(id => valid.has(id)))
      return next.size === current.size ? current : next
    })
  }, [rows])

  function toggle(id) {
    setExpanded(current => {
      const next = new Set(current)
      const key = String(id)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (!rows.length) return <div className="obligation-accordion-empty">{tab === 'history' ? 'Nenhuma obrigação concluída encontrada.' : 'Nenhuma obrigação em aberto encontrada.'}</div>

  return <div className="obligation-accordion-list">
    <div className="obligation-accordion-list-tools">
      <span>{rows.length} obrigação{rows.length === 1 ? '' : 'ões'}</span>
      <div>
        <button type="button" onClick={() => setExpanded(new Set(rows.map(item => String(item.id))))}>Expandir todos</button>
        <button type="button" onClick={() => setExpanded(new Set())}>Recolher todos</button>
      </div>
    </div>

    {rows.map(obligation => {
      const id = String(obligation.id)
      const isExpanded = expanded.has(id)
      const progress = obligationProgress(obligation)
      const complete = obligationComplete(obligation)
      const pct = complete ? 100 : progress.pct
      const due = dueInfo(obligation)
      const situation = situationFor(obligation)
      const receiptEnabled = controlsReceipt(obligation)
      const pending = Math.max(0, Number(progress.applicable || 0) - Number(progress.done || 0))

      return <article className={`obligation-accordion-card ${isExpanded ? 'is-expanded' : ''}`} key={id}>
        <div className="obligation-accordion-card-summary">
          <button type="button" className="obligation-accordion-main" onClick={() => toggle(id)} aria-expanded={isExpanded}>
            <div className="obligation-accordion-title">
              <strong>{obligation.nome || 'Obrigação'}</strong>
              <small>{[obligation.categoria || 'Outros', `${progress.total || 0} CNPJ${Number(progress.total || 0) === 1 ? '' : 's'}`].join(' · ')}</small>
            </div>
            <div className="obligation-accordion-progress-wrap">
              <span>{progress.done || 0} de {progress.applicable || 0} concluído(s)</span>
              <ProgressBar value={pct} />
            </div>
            <div className="obligation-accordion-due"><span>Vencimento</span><strong>{due.mixed ? 'Datas diferentes' : formatDate(due.value)}</strong></div>
            <span className={`obligation-accordion-situation situation-${normalize(situation).replaceAll(' ', '-')}`}>{situation}</span>
            <span className="obligation-accordion-chevron" aria-hidden="true">{isExpanded ? '⌃' : '⌄'}</span>
          </button>
          <button type="button" className="obligation-accordion-edit" onClick={() => onEdit?.(obligation)}>Editar</button>
        </div>

        {isExpanded ? <div className={`obligation-accordion-companies ${receiptEnabled ? 'has-receipt' : ''}`}>
          <div className="obligation-accordion-company-head"><span>Empresa</span><span>Vínculo</span><span>Status</span>{receiptEnabled ? <span>Recibo / protocolo</span> : null}<span /></div>
          {(obligation.clientes || []).map(link => {
            const entityType = inferLinkType(link, clientsById, linkedCompaniesById)
            const linked = entityType === 'linkedCompany'
            const entity = linked ? linkedCompaniesById.get(String(link.clienteId)) : clientsById.get(String(link.clienteId))
            const responsible = linked ? clientsById.get(String(entity?.clientId || '')) : null
            const relationship = linked ? 'Terceirizado' : entity?.relacionamento === 'Avulso' ? 'Avulso' : 'Cliente'
            const status = link.status || 'Pendente'
            return <div className="obligation-accordion-company-row" key={`${entityType}-${link.clienteId}`}>
              <div className="obligation-accordion-company-name"><strong>{clientName(entity)}</strong><small>{entityDocument(entity) || 'Sem documento'}{linked && responsible ? ` · via ${clientName(responsible)}` : ''}</small></div>
              <span className={`obligation-accordion-link link-${linked ? 'outsourced' : entity?.relacionamento === 'Avulso' ? 'avulso' : 'client'}`}>{relationship}</span>
              <span className={`obligation-status status-${normalize(status).replaceAll(' ', '-')}`}>{status}</span>
              {receiptEnabled ? <span className={`obligation-accordion-receipt ${link.recibo ? 'has-value' : ''}`}>{link.recibo || '—'}</span> : null}
              <button type="button" onClick={() => onOpenDetails?.(obligation, link.clienteId)}>{tab === 'history' ? 'Consultar' : 'Abrir'}</button>
            </div>
          })}
          <footer><span>{progress.total || 0} CNPJ{Number(progress.total || 0) === 1 ? '' : 's'}</span><strong>{progress.done || 0} concluído(s) · {pending} pendente(s)</strong></footer>
        </div> : null}
      </article>
    })}
  </div>
}
