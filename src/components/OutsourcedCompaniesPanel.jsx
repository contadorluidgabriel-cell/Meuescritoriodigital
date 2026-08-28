import { useMemo, useState } from 'react'
import { uid } from '../lib/storage.js'

const digits = value => String(value || '').replace(/\D/g, '')

function formatCnpj(value) {
  const number = digits(value).slice(0, 14)
  if (!number) return ''
  let formatted = number.slice(0, 2)
  if (number.length > 2) formatted += `.${number.slice(2, 5)}`
  if (number.length > 5) formatted += `.${number.slice(5, 8)}`
  if (number.length > 8) formatted += `/${number.slice(8, 12)}`
  if (number.length > 12) formatted += `-${number.slice(12, 14)}`
  return formatted
}

const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'

export default function OutsourcedCompaniesPanel({ office, update }) {
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const clientsById = useMemo(() => new Map((office.clients || []).map(client => [String(client.id), client])), [office.clients])
  const outsourcingClients = useMemo(() => (office.clients || [])
    .filter(client => client.status !== 'Inativo' && client.perfilAtendimento === 'Terceirizador')
    .sort((a, b) => clientName(a).localeCompare(clientName(b), 'pt-BR')), [office.clients])

  const companies = useMemo(() => (office.linkedCompanies || [])
    .filter(company => company.status !== 'Inativo')
    .sort((a, b) => String(a.razao || '').localeCompare(String(b.razao || ''), 'pt-BR')), [office.linkedCompanies])

  const responsibleChoices = useMemo(() => {
    if (!editing?.clientId) return outsourcingClients
    const current = clientsById.get(String(editing.clientId))
    if (!current || outsourcingClients.some(client => String(client.id) === String(current.id))) return outsourcingClients
    return [...outsourcingClients, current].sort((a, b) => clientName(a).localeCompare(clientName(b), 'pt-BR'))
  }, [clientsById, editing?.clientId, outsourcingClients])

  function openNew() {
    setEditing({ id: '', cnpj: '', razao: '', clientId: outsourcingClients[0]?.id || '' })
    setError('')
  }

  function openEdit(company) {
    setEditing({ id: company.id, cnpj: formatCnpj(company.cnpj), razao: company.razao || '', clientId: company.clientId || '' })
    setError('')
  }

  function save(event) {
    event.preventDefault()
    const cnpj = digits(editing.cnpj)
    const razao = String(editing.razao || '').trim()
    const clientId = String(editing.clientId || '')

    if (cnpj.length !== 14) { setError('Informe um CNPJ com 14 dígitos.'); return }
    if (!razao) { setError('Informe a razão social.'); return }
    if (!clientId) { setError('Selecione o cliente terceirizador responsável.'); return }
    if ((office.clients || []).some(client => digits(client.documento) === cnpj)) { setError('Este CNPJ já está cadastrado como cliente do escritório.'); return }
    if ((office.linkedCompanies || []).some(company => company.id !== editing.id && company.status !== 'Inativo' && digits(company.cnpj) === cnpj)) { setError('Este CNPJ terceirizado já está cadastrado.'); return }

    const existing = (office.linkedCompanies || []).find(company => company.id === editing.id)
    const record = {
      ...(existing || {}),
      id: editing.id || uid('ter'),
      cnpj: formatCnpj(cnpj),
      razao,
      clientId,
      status: 'Ativo',
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    }

    update(draft => {
      const current = draft.linkedCompanies || []
      draft.linkedCompanies = current.some(company => company.id === record.id)
        ? current.map(company => company.id === record.id ? record : company)
        : [...current, record]
    })
    setEditing(null)
  }

  return <>
    <section className="react-module-card outsourced-section">
      <div className="outsourced-section-head">
        <div>
          <span className="outsourced-eyebrow">TERCEIRIZAÇÃO</span>
          <h2>Empresas terceirizadas</h2>
          <p>CNPJs atendidos por você em nome de um cliente terceirizador. Eles não entram na sua carteira de clientes.</p>
        </div>
        <button className="primary" type="button" onClick={openNew}>+ CNPJ terceirizado</button>
      </div>

      {companies.length ? <div className="outsourced-grid">
        {companies.map(company => {
          const responsible = clientsById.get(String(company.clientId))
          return <article className="outsourced-company-card" key={company.id}>
            <div className="outsourced-company-field">
              <small>CNPJ</small>
              <strong>{formatCnpj(company.cnpj) || '—'}</strong>
            </div>
            <div className="outsourced-company-field">
              <small>Razão social</small>
              <strong>{company.razao || '—'}</strong>
            </div>
            <div className="outsourced-company-field">
              <small>Cliente terceirizador responsável</small>
              <strong>{responsible ? clientName(responsible) : 'Cliente não encontrado'}</strong>
            </div>
            <button className="outsourced-edit" type="button" onClick={() => openEdit(company)}>Editar</button>
          </article>
        })}
      </div> : <div className="outsourced-empty">Nenhum CNPJ terceirizado cadastrado.</div>}
    </section>

    {editing ? <div className="outsourced-modal" role="dialog" aria-modal="true" aria-label={editing.id ? 'Editar CNPJ terceirizado' : 'Novo CNPJ terceirizado'} onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null) }}>
      <div className="outsourced-modal-card">
        <header>
          <div><h2>{editing.id ? 'Editar CNPJ terceirizado' : 'Novo CNPJ terceirizado'}</h2><p>Somente os dados necessários para identificar o serviço terceirizado.</p></div>
          <button type="button" onClick={() => setEditing(null)} aria-label="Fechar">×</button>
        </header>
        <form onSubmit={save}>
          <label><span>CNPJ *</span><input inputMode="numeric" maxLength={18} value={formatCnpj(editing.cnpj)} onChange={event => setEditing(current => ({ ...current, cnpj: formatCnpj(event.target.value) }))} placeholder="00.000.000/0000-00" /></label>
          <label><span>Razão social *</span><input value={editing.razao} onChange={event => setEditing(current => ({ ...current, razao: event.target.value }))} /></label>
          <label className="full"><span>Cliente terceirizador responsável *</span><select value={editing.clientId} onChange={event => setEditing(current => ({ ...current, clientId: event.target.value }))}><option value="">Selecione</option>{responsibleChoices.map(client => <option key={client.id} value={client.id}>{clientName(client)}</option>)}</select>{!responsibleChoices.length ? <small className="outsourced-helper">Primeiro marque um cliente como “Cliente terceirizador” no cadastro dele.</small> : null}</label>
          {error ? <p className="outsourced-error">{error}</p> : null}
          <footer><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary">Salvar</button></footer>
        </form>
      </div>
    </div> : null}
  </>
}
