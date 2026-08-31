import { useMemo, useState } from 'react'
import { today } from '../lib/storage.js'
import { normalizeSharedCharge, normalizedSharedClientFields, partnerShares, sharedChargeError, sharedReceiver, sharedSplit, SETTLEMENT_DONE, SETTLEMENT_PENDING } from '../lib/sharedWork.js'

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const partnerName = partner => partner?.nome || partner?.razao || 'Parceiro'

export default function SharedFinanceEditor({ charge, client, partners = [], onClose, onSave }) {
  const initial = normalizeSharedCharge(charge, client)
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState('')
  const partnersById = useMemo(() => new Map(partners.map(partner => [String(partner.id), partner])), [partners])
  const shares = partnerShares(draft, client)
  const split = sharedSplit(draft, client)
  const receiver = sharedReceiver(draft, client)

  function setField(name, value) { setDraft(current => ({ ...current, [name]: value })) }
  function setShare(partnerId, value) {
    const id = String(partnerId)
    const next = shares.map(item => item.parceiroId === id ? { ...item, valor: Math.max(0, Number(value) || 0) } : item)
    setDraft(current => ({ ...current, compartilhadoPartesParceiros: next, compartilhadoParceiroParte: next[0]?.valor || 0 }))
  }

  function restoreDefault() {
    const fields = normalizedSharedClientFields(client)
    setDraft(current => ({
      ...current,
      valor: Number(client?.mensalidade) || Number(current.valor) || 0,
      parceiroIds: fields.parceiroIds,
      parceiroId: fields.parceiroId,
      compartilhadoRecebedor: fields.compartilhadoRecebedor,
      compartilhadoMinhaParte: fields.compartilhadoMinhaParte,
      compartilhadoPartesParceiros: fields.compartilhadoPartesParceiros,
      compartilhadoParceiroParte: fields.compartilhadoParceiroParte,
      compartilhadoPersonalizado: false,
    }))
    setError('')
  }

  function submit(event) {
    event.preventDefault()
    const normalized = normalizeSharedCharge(draft, client)
    const validationError = sharedChargeError(normalized, client)
    if (validationError) { setError(validationError); return }
    const settled = normalized.compartilhadoRecebedor === 'CadaUm' ? SETTLEMENT_DONE : (draft.compartilhadoAcertoStatus || SETTLEMENT_PENDING)
    onSave({
      valor: Number(normalized.valor) || 0,
      parceiroIds: normalized.parceiroIds,
      parceiroId: normalized.parceiroId,
      compartilhadoRecebedor: normalized.compartilhadoRecebedor,
      compartilhadoMinhaParte: normalized.compartilhadoMinhaParte,
      compartilhadoPartesParceiros: normalized.compartilhadoPartesParceiros,
      compartilhadoParceiroParte: normalized.compartilhadoParceiroParte,
      compartilhadoAcertoStatus: settled,
      compartilhadoAcertoEm: settled === SETTLEMENT_DONE ? (draft.compartilhadoAcertoEm || today()) : '',
      compartilhadoObservacao: String(draft.compartilhadoObservacao || '').trim(),
      compartilhadoPersonalizado: Boolean(draft.compartilhadoPersonalizado || charge?.origem !== 'recorrente'),
    })
  }

  const settlementText = receiver === 'CadaUm'
    ? 'Cada um recebe diretamente a própria parte; não há repasse entre vocês.'
    : receiver === 'Escritorio'
      ? `Meu escritório recebe e deve repassar ${money(split.partnerTotal)} aos parceiros.`
      : `${partnerName(partnersById.get(receiver.slice(8)))} recebe e deve repassar ${money(split.mine)} ao meu escritório.`

  return <div className="finance-modal" role="dialog" aria-modal="true" aria-label="Ajustar divisão financeira" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="finance-modal-card shared-finance-modal">
      <header><div><h2>Ajustar divisão</h2><p>{charge?.origem === 'recorrente' ? 'Altere somente esta competência; o padrão do cliente permanece igual.' : 'Defina a divisão financeira deste serviço específico.'}</p></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>
      <form className="finance-form" onSubmit={submit}>
        <label className="finance-field"><span>Valor total</span><input type="number" min="0" step="0.01" value={draft.valor} onChange={event => setField('valor', event.target.value)} /></label>
        <label className="finance-field"><span>Quem recebeu</span><select value={receiver} onChange={event => setField('compartilhadoRecebedor', event.target.value)}><option value="Escritorio">Meu escritório</option>{shares.map(item => <option value={`partner:${item.parceiroId}`} key={item.parceiroId}>{partnerName(partnersById.get(item.parceiroId))}</option>)}<option value="CadaUm">Cada um recebe sua parte</option></select></label>
        <label className="finance-field"><span>Minha parte</span><input type="number" min="0" step="0.01" value={draft.compartilhadoMinhaParte ?? 0} onChange={event => setField('compartilhadoMinhaParte', event.target.value)} /></label>
        {shares.map(item => <label className="finance-field" key={item.parceiroId}><span>Parte de {partnerName(partnersById.get(item.parceiroId))}</span><input type="number" min="0" step="0.01" value={item.valor} onChange={event => setShare(item.parceiroId, event.target.value)} /></label>)}
        <div className={`finance-field full shared-finance-check ${Math.abs(split.difference) > 0.009 ? 'invalid' : ''}`}><span>Conferência</span><small>Total {money(split.total)} · divisão {money(split.splitTotal)} · diferença {money(split.difference)}</small></div>
        <div className="finance-field full"><span>Acerto</span><small>{settlementText}</small></div>
        {receiver !== 'CadaUm' ? <><label className="finance-field"><span>Status do repasse/recebimento</span><select value={draft.compartilhadoAcertoStatus || SETTLEMENT_PENDING} onChange={event => setField('compartilhadoAcertoStatus', event.target.value)}><option value={SETTLEMENT_PENDING}>Pendente</option><option value={SETTLEMENT_DONE}>{receiver === 'Escritorio' ? 'Pago' : 'Recebido'}</option></select></label><label className="finance-field"><span>Data do acerto</span><input type="date" value={draft.compartilhadoAcertoEm || ''} onChange={event => setField('compartilhadoAcertoEm', event.target.value)} disabled={(draft.compartilhadoAcertoStatus || SETTLEMENT_PENDING) !== SETTLEMENT_DONE} /></label></> : null}
        <label className="finance-field full"><span>Observação desta competência/serviço</span><textarea value={draft.compartilhadoObservacao || ''} onChange={event => setField('compartilhadoObservacao', event.target.value)} placeholder="Ex.: valor alterado por serviço extra" /></label>
        {error ? <p className="finance-error">{error}</p> : null}
        <footer><button type="button" onClick={onClose}>Cancelar</button>{charge?.origem === 'recorrente' ? <button type="button" onClick={restoreDefault}>Restaurar padrão</button> : null}<button type="submit" className="primary">Salvar</button></footer>
      </form>
    </div>
  </div>
}
