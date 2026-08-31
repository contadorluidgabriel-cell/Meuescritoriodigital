import { useMemo, useState } from 'react'
import { today } from '../lib/storage.js'
import { paymentError, paymentSummary } from '../lib/financePro.js'

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateBr = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—'

export default function PaymentEditor({ charge, onClose, onSave, onRemove }) {
  const current = useMemo(() => paymentSummary(charge), [charge])
  const [draft, setDraft] = useState({ data: today(), valorRecebido: current.balance, desconto: 0, acrescimo: 0, observacao: '' })
  const [error, setError] = useState('')
  const applied = Math.max(0, Number(draft.valorRecebido || 0) + Number(draft.desconto || 0) - Number(draft.acrescimo || 0))
  const remaining = Math.max(0, current.balance - applied)

  function setField(name, value) { setDraft(value => ({ ...value, [name]: value })) }
  function change(name, value) { setDraft(currentDraft => ({ ...currentDraft, [name]: value })) }
  function submit(event) {
    event.preventDefault()
    const validationError = paymentError(charge, draft)
    if (validationError) { setError(validationError); return }
    onSave({
      data: draft.data,
      valorRecebido: Number(draft.valorRecebido) || 0,
      desconto: Number(draft.desconto) || 0,
      acrescimo: Number(draft.acrescimo) || 0,
      observacao: String(draft.observacao || '').trim(),
    })
  }

  return <div className="finance-modal" role="dialog" aria-modal="true" aria-label="Registrar recebimento" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="finance-modal-card payment-modal-card">
      <header><div><h2>Registrar recebimento</h2><p>Baixa total ou parcial sem alterar o valor original da cobrança.</p></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>
      <form className="finance-form" onSubmit={submit}>
        <div className="payment-summary full"><span><small>Valor original</small><b>{money(current.total)}</b></span><span><small>Já recebido</small><b>{money(current.receivedCash)}</b></span><span><small>Saldo atual</small><b>{money(current.balance)}</b></span></div>
        <label className="finance-field"><span>Data do recebimento *</span><input type="date" value={draft.data} onChange={event => change('data', event.target.value)} /></label>
        <label className="finance-field"><span>Valor efetivamente recebido *</span><input type="number" min="0" step="0.01" value={draft.valorRecebido} onChange={event => change('valorRecebido', event.target.value)} /></label>
        <label className="finance-field"><span>Desconto concedido</span><input type="number" min="0" step="0.01" value={draft.desconto} onChange={event => change('desconto', event.target.value)} /></label>
        <label className="finance-field"><span>Acréscimo recebido</span><input type="number" min="0" step="0.01" value={draft.acrescimo} onChange={event => change('acrescimo', event.target.value)} /></label>
        <label className="finance-field full"><span>Observação</span><input value={draft.observacao} onChange={event => change('observacao', event.target.value)} placeholder="Ex.: pagamento parcial via Pix" /></label>
        <div className="payment-preview full"><span>Abatimento desta cobrança: <b>{money(applied)}</b></span><span>Saldo após a baixa: <b>{money(remaining)}</b></span></div>
        {error ? <p className="finance-error">{error}</p> : null}
        <footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary" type="submit">Registrar baixa</button></footer>
      </form>

      {current.payments.length ? <section className="payment-history"><h3>Baixas registradas</h3>{current.payments.map(payment => <article key={payment.id}><div><b>{dateBr(payment.data)} · {money(payment.valorRecebido)}</b><small>{payment.desconto ? `Desconto ${money(payment.desconto)} · ` : ''}{payment.acrescimo ? `Acréscimo ${money(payment.acrescimo)} · ` : ''}{payment.observacao || (payment.legacy ? 'Recebimento legado' : 'Sem observação')}</small></div>{!payment.legacy ? <button type="button" className="danger" onClick={() => onRemove(payment.id)}>Estornar</button> : null}</article>)}</section> : null}
    </div>
  </div>
}
