import { useMemo } from 'react'
import { paymentSummary } from '../lib/financePro.js'

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—'

export default function PartnerFinanceView({ office, access }) {
  const partnerId = String(access?.membership?.partner_id || '')
  const clients = useMemo(() => new Map((office.clients || []).map(client => [String(client.id), client])), [office.clients])
  const partner = (office.partners || []).find(item => String(item.id) === partnerId)
  const rows = useMemo(() => (office.finance || []).map(charge => {
    const summary = paymentSummary(charge)
    const share = (charge.compartilhadoPartesParceiros || []).find(item => String(item.parceiroId) === partnerId)?.valor ?? charge.compartilhadoParceiroParte ?? 0
    return { charge, summary, share: Number(share || 0), client: clients.get(String(charge.clienteId || '')) }
  }).sort((a, b) => String(b.charge.competencia || b.charge.vencimento || '').localeCompare(String(a.charge.competencia || a.charge.vencimento || ''))), [clients, office.finance, partnerId])

  const totals = rows.reduce((result, row) => {
    result.charged += row.share
    if (String(row.charge.status || '').toLowerCase() === 'recebido') result.received += row.share
    if (row.charge.compartilhadoAcertoStatus === 'Liquidado') result.settled += row.share
    else if (String(row.charge.status || '').toLowerCase() === 'recebido') result.toSettle += row.share
    return result
  }, { charged: 0, received: 0, settled: 0, toSettle: 0 })

  return <div className="partner-finance-shell">
    <header className="partner-finance-hero"><div><span>Portal do parceiro</span><h1>Financeiro compartilhado</h1><p>{partner?.nome || partner?.razao || access?.membership?.display_name || 'Parceiro'} · somente informações vinculadas à sua parceria.</p></div><b>{rows.length} cobrança(s)</b></header>
    <section className="partner-finance-kpis"><div><span>Sua parte lançada</span><strong>{money(totals.charged)}</strong></div><div><span>Em cobranças recebidas</span><strong>{money(totals.received)}</strong></div><div><span>Acertos liquidados</span><strong>{money(totals.settled)}</strong></div><div className={totals.toSettle ? 'warning' : ''}><span>Aguardando acerto</span><strong>{money(totals.toSettle)}</strong></div></section>
    <section className="partner-finance-panel"><header><div><span>Conferência</span><h2>Cobranças da parceria</h2><p>Esta área é somente leitura. O faturamento geral do escritório não é disponibilizado ao parceiro.</p></div></header><div className="partner-finance-table"><div className="partner-finance-head"><span>Cliente / cobrança</span><span>Competência</span><span>Total</span><span>Sua parte</span><span>Recebimento</span><span>Acerto</span></div>{rows.length ? rows.map(({ charge, share, client }) => <div className="partner-finance-row" key={charge.id}><div><strong>{clientName(client)}</strong><small>{charge.descricao || 'Cobrança compartilhada'}</small></div><span>{charge.competencia || dateLabel(charge.vencimento)}</span><span>{money(charge.valor)}</span><strong>{money(share)}</strong><span>{charge.status || 'Pendente'}{charge.recebidoEm ? <small>{dateLabel(charge.recebidoEm)}</small> : null}</span><span className={charge.compartilhadoAcertoStatus === 'Liquidado' ? 'ok' : 'pending'}>{charge.compartilhadoAcertoStatus || 'Pendente'}{charge.compartilhadoAcertoEm ? <small>{dateLabel(charge.compartilhadoAcertoEm)}</small> : null}</span></div>) : <div className="partner-finance-empty">Nenhuma cobrança compartilhada disponível para este parceiro.</div>}</div></section>
  </div>
}
