import { useState } from 'react'

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function SharedFinanceEditor({ charge, partner, onClose, onSave }) {
  const [draft, setDraft] = useState({
    valor: Number(charge?.valor) || 0,
    compartilhadoRecebedor: charge?.compartilhadoRecebedor || 'Escritorio',
    compartilhadoMinhaParte: Number(charge?.compartilhadoMinhaParte) || 0,
    compartilhadoParceiroParte: Number(charge?.compartilhadoParceiroParte) || 0,
  })
  const [error, setError] = useState('')

  function setField(name, value) { setDraft(current => ({ ...current, [name]: value })) }

  function submit(event) {
    event.preventDefault()
    const total = Number(draft.valor) || 0
    const mine = Number(draft.compartilhadoMinhaParte) || 0
    const theirs = Number(draft.compartilhadoParceiroParte) || 0
    if (total <= 0) { setError('Informe um valor maior que zero para esta competência.'); return }
    if (Math.abs((mine + theirs) - total) > 0.009) { setError('Sua parte + parte do parceiro deve ser igual ao valor desta competência.'); return }
    onSave({
      valor: total,
      compartilhadoRecebedor: draft.compartilhadoRecebedor,
      compartilhadoMinhaParte: mine,
      compartilhadoParceiroParte: theirs,
      compartilhadoPersonalizado: true,
    })
  }

  return <div className="finance-modal" role="dialog" aria-modal="true" aria-label="Ajustar divisão da competência" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="finance-modal-card">
      <header><div><h2>Ajustar competência</h2><p>Altere somente este mês. O padrão do cliente continuará igual para as próximas competências.</p></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>
      <form className="finance-form" onSubmit={submit}>
        <label className="finance-field full"><span>Parceiro</span><input value={partner?.nome || 'Parceiro não encontrado'} readOnly /></label>
        <label className="finance-field"><span>Valor desta competência</span><input type="number" min="0" step="0.01" value={draft.valor} onChange={event => setField('valor', event.target.value)} /></label>
        <label className="finance-field"><span>Quem recebeu</span><select value={draft.compartilhadoRecebedor} onChange={event => setField('compartilhadoRecebedor', event.target.value)}><option value="Escritorio">Meu escritório</option><option value="Parceiro">Parceiro</option></select></label>
        <label className="finance-field"><span>Minha parte</span><input type="number" min="0" step="0.01" value={draft.compartilhadoMinhaParte} onChange={event => setField('compartilhadoMinhaParte', event.target.value)} /></label>
        <label className="finance-field"><span>Parte do parceiro</span><input type="number" min="0" step="0.01" value={draft.compartilhadoParceiroParte} onChange={event => setField('compartilhadoParceiroParte', event.target.value)} /></label>
        <div className="finance-field full"><span>Resumo</span><small>{draft.compartilhadoRecebedor === 'Parceiro' ? 'Parceiro recebe e deve repassar sua parte.' : 'Meu escritório recebe e deve repassar a parte do parceiro.'} Total: {money(draft.valor)}.</small></div>
        {error ? <p className="finance-error">{error}</p> : null}
        <footer><button type="button" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Salvar só esta competência</button></footer>
      </form>
    </div>
  </div>
}