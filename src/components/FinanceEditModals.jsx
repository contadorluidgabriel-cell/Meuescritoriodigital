import { useMemo, useState } from 'react'
import { paymentSummary } from '../lib/financePro.js'
import { applyAdjustmentToGeneratedCharge, applyFeeAdjustment, editChargeCollection, monthlyFeeForCompetence, settledPrincipal } from '../lib/financeEditing.js'

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function Modal({ title, subtitle, onClose, children }) {
  return <div className="finance-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="finance-modal-card"><header><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>{children}</div></div>
}
function Field({ label, full = false, children }) { return <label className={`finance-field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label> }

export function ChargeEditModal({ charge, finance, day, onClose, onSave }) {
  const [draft, setDraft] = useState({ descricao: charge.descricao || '', valor: String(charge.valor ?? ''), vencimento: charge.vencimento || '', competencia: charge.competencia || '' })
  const [scope, setScope] = useState('single')
  const [error, setError] = useState('')
  const groupFuture = useMemo(() => charge.grupoParcelamentoId ? (finance || []).filter(item => String(item.grupoParcelamentoId || '') === String(charge.grupoParcelamentoId) && Number(item.parcelaNumero || 1) >= Number(charge.parcelaNumero || 1)).length : 1, [charge, finance])
  const summary = paymentSummary(charge)
  const minimum = settledPrincipal(charge)
  const recurring = charge.origem === 'recorrente'
  function submit(event) {
    event.preventDefault(); setError('')
    try {
      const result = editChargeCollection(finance, charge.id, { ...draft, valor: Number(draft.valor) }, scope, day)
      onSave(result)
    } catch (err) { setError(err.message || 'Não foi possível editar a cobrança.') }
  }
  return <Modal title="Editar cobrança" subtitle="Corrija o lançamento sem perder baixas ou histórico." onClose={onClose}><form className="finance-form" onSubmit={submit}>
    <Field label="Descrição *" full><input value={draft.descricao} onChange={e => setDraft(v => ({ ...v, descricao: e.target.value }))} /></Field>
    <Field label="Valor *"><input type="number" min="0.01" step="0.01" value={draft.valor} onChange={e => setDraft(v => ({ ...v, valor: e.target.value }))} /></Field>
    <Field label="Vencimento"><input type="date" value={draft.vencimento} onChange={e => setDraft(v => ({ ...v, vencimento: e.target.value }))} /></Field>
    <Field label="Competência"><input type="month" value={draft.competencia} onChange={e => setDraft(v => ({ ...v, competencia: e.target.value }))} /></Field>
    {minimum > 0.009 ? <div className="finance-field full installment-note"><span>Valor já liquidado</span><small>{money(minimum)} já foi aplicado nesta cobrança. Para reduzir abaixo disso, primeiro estorne a baixa.</small></div> : null}
    {groupFuture > 1 ? <Field label="Aplicar alteração" full><select value={scope} onChange={e => setScope(e.target.value)}><option value="single">Somente esta parcela</option><option value="future">Esta parcela e as futuras ({groupFuture})</option></select></Field> : null}
    {recurring ? <div className="finance-field full installment-note"><span>Honorário recorrente</span><small>Esta edição corrige apenas a cobrança. Para alterar a mensalidade do cliente, use “Reajustar honorário”.</small></div> : null}
    {summary.receivedCash > 0.009 ? <div className="finance-field full installment-note"><span>Baixas preservadas</span><small>Recebido até agora: {money(summary.receivedCash)}. O saldo e o status serão recalculados.</small></div> : null}
    {error ? <p className="finance-error">{error}</p> : null}<footer><button type="button" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Salvar correção</button></footer>
  </form></Modal>
}

export function FeeAdjustmentModal({ client, finance, day, competence, onClose, onSave }) {
  const current = monthlyFeeForCompetence(client, competence)
  const [draft, setDraft] = useState({ valor: String(current || client.mensalidade || ''), competenciaInicio: competence, observacao: '', atualizarGerada: true })
  const [error, setError] = useState('')
  function submit(event) {
    event.preventDefault(); setError('')
    try {
      const nextClient = applyFeeAdjustment(client, { valor: Number(draft.valor), competenciaInicio: draft.competenciaInicio, observacao: draft.observacao })
      let result = { finance, updated: false, blocked: false }
      if (draft.atualizarGerada) result = applyAdjustmentToGeneratedCharge(finance, client.id, draft.competenciaInicio, Number(draft.valor), day)
      onSave({ client: nextClient, finance: result.finance, updated: result.updated, blocked: result.blocked, competence: draft.competenciaInicio })
    } catch (err) { setError(err.message || 'Não foi possível registrar o reajuste.') }
  }
  return <Modal title="Reajustar honorário" subtitle="Altere a mensalidade a partir de uma competência sem reescrever o histórico." onClose={onClose}><form className="finance-form" onSubmit={submit}>
    <div className="finance-field full installment-note"><span>Honorário vigente nesta competência</span><small>{money(current)}</small></div>
    <Field label="Novo honorário *"><input type="number" min="0.01" step="0.01" value={draft.valor} onChange={e => setDraft(v => ({ ...v, valor: e.target.value }))} /></Field>
    <Field label="Válido a partir de *"><input type="month" value={draft.competenciaInicio} onChange={e => setDraft(v => ({ ...v, competenciaInicio: e.target.value }))} /></Field>
    <Field label="Observação" full><input value={draft.observacao} onChange={e => setDraft(v => ({ ...v, observacao: e.target.value }))} placeholder="Ex.: reajuste anual" /></Field>
    <div className="finance-field full"><label className="third-party-toggle"><input type="checkbox" checked={draft.atualizarGerada} onChange={e => setDraft(v => ({ ...v, atualizarGerada: e.target.checked }))} /> Atualizar a cobrança já gerada dessa competência, se ainda não tiver baixa</label></div>
    <div className="finance-field full installment-note"><span>Histórico protegido</span><small>Competências anteriores permanecem com os valores antigos. Se o cliente for compartilhado, a divisão financeira é ajustada proporcionalmente ao novo honorário.</small></div>
    {error ? <p className="finance-error">{error}</p> : null}<footer><button type="button" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Registrar reajuste</button></footer>
  </form></Modal>
}
