import { useMemo, useState } from 'react'
import { uid } from '../lib/storage.js'
import { allPartnerBalances, clientPartnerIds } from '../lib/sharedWork.js'

const partnerName = partner => partner?.nome || partner?.razao || 'Parceiro'
const digits = value => String(value || '').replace(/\D/g, '')
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function formatDocument(value) {
  const number = digits(value).slice(0, 14)
  if (!number) return ''
  if (number.length <= 11) {
    let formatted = number.slice(0, 3)
    if (number.length > 3) formatted += `.${number.slice(3, 6)}`
    if (number.length > 6) formatted += `.${number.slice(6, 9)}`
    if (number.length > 9) formatted += `-${number.slice(9, 11)}`
    return formatted
  }
  let formatted = number.slice(0, 2)
  if (number.length > 2) formatted += `.${number.slice(2, 5)}`
  if (number.length > 5) formatted += `.${number.slice(5, 8)}`
  if (number.length > 8) formatted += `/${number.slice(8, 12)}`
  if (number.length > 12) formatted += `-${number.slice(12, 14)}`
  return formatted
}

export default function PartnersPanel({ office, update }) {
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const balances = useMemo(() => new Map(allPartnerBalances(office.finance || [], office.clients || [], office.partners || []).map(item => [String(item.id), item])), [office.clients, office.finance, office.partners])
  const partners = useMemo(() => (office.partners || [])
    .slice()
    .sort((a, b) => partnerName(a).localeCompare(partnerName(b), 'pt-BR')), [office.partners])
  const linkedCount = useMemo(() => {
    const counts = new Map()
    ;(office.clients || []).forEach(client => clientPartnerIds(client).forEach(id => counts.set(id, (counts.get(id) || 0) + 1)))
    return counts
  }, [office.clients])

  function openNew() {
    setEditing({ id: '', nome: '', tipo: 'Contador', documento: '', telefone: '', email: '', observacoes: '', status: 'Ativo' })
    setError('')
  }

  function openEdit(partner) {
    setEditing({
      id: partner.id,
      nome: partner.nome || '',
      tipo: partner.tipo || 'Contador',
      documento: formatDocument(partner.documento || ''),
      telefone: partner.telefone || '',
      email: partner.email || '',
      observacoes: partner.observacoes || '',
      status: partner.status || 'Ativo',
    })
    setError('')
  }

  function save(event) {
    event.preventDefault()
    const nome = String(editing.nome || '').trim()
    const documentDigits = digits(editing.documento)
    if (!nome) { setError('Informe o nome do parceiro.'); return }
    if (documentDigits && ![11, 14].includes(documentDigits.length)) { setError('CPF/CNPJ deve ter 11 ou 14 dígitos.'); return }
    if (documentDigits && (office.partners || []).some(item => item.id !== editing.id && digits(item.documento) === documentDigits)) { setError('Este CPF/CNPJ já está cadastrado em outro parceiro.'); return }

    const existing = (office.partners || []).find(item => item.id === editing.id)
    const record = {
      ...(existing || {}),
      id: editing.id || uid('par'),
      nome,
      tipo: editing.tipo || 'Contador',
      documento: formatDocument(documentDigits),
      telefone: String(editing.telefone || '').trim(),
      email: String(editing.email || '').trim(),
      observacoes: String(editing.observacoes || '').trim(),
      status: editing.status || 'Ativo',
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    }

    update(draft => {
      const current = draft.partners || []
      draft.partners = current.some(item => item.id === record.id)
        ? current.map(item => item.id === record.id ? record : item)
        : [...current, record]
    })
    setEditing(null)
  }

  return <>
    <section className="react-module-card outsourced-section partner-section">
      <div className="outsourced-section-head">
        <div>
          <span className="outsourced-eyebrow">PARCERIAS</span>
          <h2>Parceiros de trabalho</h2>
          <p>Pessoas ou escritórios com quem você divide clientes, responsabilidades e repasses.</p>
        </div>
        <button className="primary" type="button" onClick={openNew}>+ Parceiro</button>
      </div>

      {partners.length ? <div className="outsourced-grid partner-grid">
        {partners.map(partner => {
          const balance = balances.get(String(partner.id)) || { aPagar: 0, aReceber: 0, saldo: 0 }
          const count = linkedCount.get(String(partner.id)) || 0
          return <article className={`outsourced-company-card partner-card ${partner.status === 'Inativo' ? 'partner-inactive' : ''}`} key={partner.id}>
            <div className="outsourced-company-field"><small>Parceiro</small><strong>{partnerName(partner)}</strong><span>{partner.tipo || '—'}{partner.status === 'Inativo' ? ' · Inativo' : ''}</span></div>
            <div className="outsourced-company-field"><small>Clientes compartilhados</small><strong>{count}</strong></div>
            <div className="outsourced-company-field"><small>A pagar</small><strong>{money(balance.aPagar)}</strong></div>
            <div className="outsourced-company-field"><small>A receber</small><strong>{money(balance.aReceber)}</strong></div>
            <div className="outsourced-company-field"><small>Saldo</small><strong>{money(balance.saldo)}</strong></div>
            <div className="outsourced-company-field"><small>Contato</small><strong>{partner.telefone || partner.email || '—'}</strong></div>
            <button className="outsourced-edit" type="button" onClick={() => openEdit(partner)}>Editar</button>
          </article>
        })}
      </div> : <div className="outsourced-empty">Nenhum parceiro de trabalho cadastrado.</div>}
    </section>

    {editing ? <div className="outsourced-modal" role="dialog" aria-modal="true" aria-label={editing.id ? 'Editar parceiro' : 'Novo parceiro'} onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null) }}>
      <div className="outsourced-modal-card">
        <header>
          <div><h2>{editing.id ? 'Editar parceiro' : 'Novo parceiro'}</h2><p>Parceiros inativos permanecem no histórico, mas não aparecem em novos vínculos.</p></div>
          <button type="button" onClick={() => setEditing(null)} aria-label="Fechar">×</button>
        </header>
        <form onSubmit={save}>
          <label><span>Nome *</span><input value={editing.nome} onChange={event => setEditing(current => ({ ...current, nome: event.target.value }))} /></label>
          <label><span>Tipo</span><select value={editing.tipo} onChange={event => setEditing(current => ({ ...current, tipo: event.target.value }))}><option>Contador</option><option>Escritório</option><option>Outro</option></select></label>
          <label><span>CPF/CNPJ</span><input inputMode="numeric" maxLength={18} value={formatDocument(editing.documento)} onChange={event => setEditing(current => ({ ...current, documento: formatDocument(event.target.value) }))} /></label>
          <label><span>Telefone / WhatsApp</span><input value={editing.telefone} onChange={event => setEditing(current => ({ ...current, telefone: event.target.value }))} /></label>
          <label><span>E-mail</span><input type="email" value={editing.email} onChange={event => setEditing(current => ({ ...current, email: event.target.value }))} /></label>
          <label><span>Status</span><select value={editing.status} onChange={event => setEditing(current => ({ ...current, status: event.target.value }))}><option>Ativo</option><option>Inativo</option></select></label>
          <label className="full"><span>Observações</span><textarea value={editing.observacoes} onChange={event => setEditing(current => ({ ...current, observacoes: event.target.value }))} /></label>
          {error ? <p className="outsourced-error">{error}</p> : null}
          <footer><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary">Salvar</button></footer>
        </form>
      </div>
    </div> : null}
  </>
}
