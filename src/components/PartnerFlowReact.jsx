import { useMemo, useState } from 'react'
import { buildPartnerFlow } from '../lib/partnerFlow.js'
import './partner-flow.css'

const currency = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateBr = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data'

export default function PartnerFlowReact({ office, partnerBalances = [] }) {
  const [partnerId, setPartnerId] = useState('')
  const [month, setMonth] = useState('')
  const [limit, setLimit] = useState(40)
  const flow = useMemo(() => buildPartnerFlow(office, { partnerId, month }), [office, partnerId, month])
  const partnerNames = useMemo(() => new Map((office.partners || []).map(partner => [String(partner.id), partner.nome || partner.razao || 'Parceiro'])), [office.partners])
  const balances = partnerBalances.filter(partner => !partnerId || String(partner.id) === partnerId)
  const aPagar = balances.reduce((total, partner) => total + Number(partner.aPagar || 0), 0)
  const aReceber = balances.reduce((total, partner) => total + Number(partner.aReceber || 0), 0)
  if (!(office.partners || []).length) return null

  return <div className="partner-flow">
    <div className="partner-flow-heading"><div><span>Histórico financeiro</span><h3>Fluxo por parceiro</h3><p>Acompanhe as cobranças dos processos e serviços, a quitação pelo cliente e cada acerto. O saldo de acertos não representa o saldo bancário do parceiro.</p></div><div className="partner-flow-filters"><label>Parceiro<select value={partnerId} onChange={event => { setPartnerId(event.target.value); setLimit(40) }}><option value="">Todos os parceiros</option>{(office.partners || []).map(partner => <option key={partner.id} value={String(partner.id)}>{partnerNames.get(String(partner.id))}</option>)}</select></label><label>Mês dos eventos<input type="month" value={month} onChange={event => { setMonth(event.target.value); setLimit(40) }} /></label>{month ? <button type="button" onClick={() => { setMonth(''); setLimit(40) }}>Todo o histórico</button> : null}</div></div>
    <div className="partner-flow-metrics"><article><small>Participação dos parceiros</small><strong>{currency(flow.totals.partnerShare)}</strong><span>Em cobranças ativas, todas as competências</span></article><article><small>Parte quitada pelos clientes</small><strong>{currency(flow.totals.customerPaidShare)}</strong><span>Não significa repasse bancário</span></article><article><small>Parte aguardando cliente</small><strong>{currency(flow.totals.customerOpenShare)}</strong><span>Não é acerto exigível antes da quitação</span></article><article><small>Acertos entre escritório e parceiros</small><strong>{currency(aReceber)} <small>a receber</small></strong><span>{currency(aPagar)} a pagar · saldos pendentes atuais</span></article></div>
    <div className="partner-flow-repasses"><span>Repasses documentados no caixa do escritório: <b>{currency(flow.totals.settlementsToOffice)} recebidos</b> · <b>{currency(flow.totals.settlementsToPartner)} pagos</b></span>{flow.totals.unverified ? <span className="partner-flow-alert">{flow.totals.unverified} acerto(s) liquidado(s) sem movimentação bancária conciliada.</span> : null}</div>
    <div className="partner-flow-table"><table><thead><tr><th>Data</th><th>Parceiro / Cliente</th><th>Evento</th><th>Valor do evento</th><th>Referência</th></tr></thead><tbody>{flow.events.slice(0, limit).map(item => <tr key={item.id}><td>{dateBr(item.date)}</td><td><strong>{partnerNames.get(item.partnerId) || 'Parceiro'}</strong><small>{item.client}</small></td><td><span className={`partner-flow-tag partner-flow-${item.kind}`}>{item.status}</span><small>{item.note}</small></td><td><strong className={item.kind === 'settlement' ? 'partner-flow-cash' : ''}>{currency(item.value)}</strong>{item.kind === 'payment' ? <small>Baixa total do cliente: {currency(item.gross)}</small> : null}</td><td><strong>{item.origin}{item.processId ? ` · ${item.processId}` : ''}</strong><small>{item.description}</small>{item.account ? <small>Conta: {item.account}</small> : null}</td></tr>)}{!flow.events.length ? <tr><td colSpan="5" className="partner-flow-empty">Nenhuma movimentação encontrada para este filtro. Use “Todo o histórico” para conferir outros meses.</td></tr> : null}</tbody></table></div>
    {flow.events.length > limit ? <button type="button" className="partner-flow-more" onClick={() => setLimit(current => current + 40)}>Mostrar mais {Math.min(40, flow.events.length - limit)} eventos</button> : null}
    <p className="partner-flow-footnote">Cobrança = valor contratado; baixa = pagamento do cliente; repasse = movimento entre escritório e parceiro. O histórico é calculado a partir dos registros existentes, sem gerar novos lançamentos. Acertos conjuntos com múltiplos parceiros não comprovam individualmente o pagamento a cada um.</p>
  </div>
}
