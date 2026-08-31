import { useMemo, useState } from 'react'
import { uid } from '../lib/storage.js'

const partnerName = partner => partner?.nome || partner?.razao || 'Parceiro'

export default function PartnersPanel({ office, update }) {
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  const partners = useMemo(() => (office.partners || [])
    .slice()
    .sort((a, b) => partnerName(a).localeCompare(partnerName(b), 'pt-BR')), [office.partners])

  function openNew() {
    setEditing({ id: '', nome: '', tipo: 'Contador', telefone: '', email: '', observacoes: '', status: 'Ativo' })
    setError('')
  }

  function openEdit(partner) {
    setEditing({
      id: partner.id,
      nome: partner.nome || '',
      tipo: partner.tipo || 'Contador',
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
    if (!nome) { setError('Informe o nome do parceiro.'); return }

    const existing = (office.partners || []).find(item => item.id === editing.id)
    const record = {
      ...(existing || {}),
      id: editing.id || uid('par'),
      nome,
      tipo: editing.tipo || 'Contador',
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
    <section className="react-module-card outsourced-section">
      <div className="outsourced-section-head">
        <div>
          <span className="outsourced-eyebrow">PARCERIAS</span>
          <h2>Parceiros de trabalho</h2>
          <p>Pessoas ou escritórios com quem você divide o atendimento de clientes compartilhados.</p>
        </div>
        <button className="primary" type="button" onClick={openNew}>+ Parceiro</button>
      </div>

      {partners.length ? <div className="outsourced-grid">
        {partners.map(partner => <article className="outsourced-company-card" key={partner.id}>
          <div className="outsourced-company-field"><small>Parceiro</small><strong>{partnerName(partner)}</strong></div>
          <div className="outsourced-company-field"><small>Tipo</small><strong>{partner.tipo || '—'}</strong></div>
          <div className="outsourced-company-field"><small>Contato</small><strong>{partner.telefone || partner.email || '—'}</strong></div>
          <div className="outsourced-company-field"><small>Status</small><strong>{partner.status || 'Ativo'}</strong></div>
          <button className="outsourced-edit" type="button" onClick={() => openEdit(partner)}>Editar</button>
        </article>)}
      </div> : <div className="outsourced-empty">Nenhum parceiro de trabalho cadastrado.</div>}
    </section>

    {editing ? <div className="outsourced-modal" role="dialog" aria-modal="true" aria-label={editing.id ? 'Editar parceiro' : 'Novo parceiro'} onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null) }}>
      <div className="outsourced-modal-card">
        <header>
          <div><h2>{editing.id ? 'Editar parceiro' : 'Novo parceiro'}</h2><p>Cadastre quem poderá ser vinculado aos clientes compartilhados.</p></div>
          <button type="button" onClick={() => setEditing(null)} aria-label="Fechar">×</button>
        </header>
        <form onSubmit={save}>
          <label><span>Nome *</span><input value={editing.nome} onChange={event => setEditing(current => ({ ...current, nome: event.target.value }))} /></label>
          <label><span>Tipo</span><select value={editing.tipo} onChange={event => setEditing(current => ({ ...current, tipo: event.target.value }))}><option>Contador</option><option>Escritório</option><option>Outro</option></select></label>
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