import { useMemo } from 'react'
import { paymentSummary } from '../lib/financePro.js'
import { collectOperationalWork } from '../lib/operationalIntelligence.js'
import { normalizeText } from '../lib/textUtils.js'
import '../management-insights-v12-3.css'

const pct = value => `${Math.max(0, Math.round(Number(value) || 0))}%`

function monthOffset(day, offset) {
  const [year, month] = String(day || '').split('-').map(Number)
  const date = new Date(year, (month || 1) - 1 + offset, 1, 12)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function financeForMonth(office, month) {
  const billed = (office.finance || [])
    .filter(charge => String(charge.competencia || charge.vencimento || '').startsWith(month) && normalizeText(charge.status) !== 'cancelado')
    .reduce((sum, charge) => sum + paymentSummary(charge).total, 0)
  const received = (office.finance || []).reduce((sum, charge) => sum + paymentSummary(charge).payments
    .filter(payment => String(payment.data || '').startsWith(month))
    .reduce((inner, payment) => inner + Number(payment.valorRecebido || 0), 0), 0)
  return { billed, received, rate: billed > 0 ? received * 100 / billed : received > 0 ? 100 : 0 }
}

function deltaLabel(current, previous) {
  const delta = Math.round((Number(current) || 0) - (Number(previous) || 0))
  if (!delta) return 'estável vs. mês anterior'
  return `${delta > 0 ? '+' : ''}${delta} p.p. vs. mês anterior`
}

export default function ManagementInsights({ office, metrics, day }) {
  const insights = useMemo(() => {
    const currentMonth = monthOffset(day, 0)
    const previousMonth = monthOffset(day, -1)
    const currentFinance = financeForMonth(office, currentMonth)
    const previousFinance = financeForMonth(office, previousMonth)
    const work = collectOperationalWork(office, { day })
    const uniqueCritical = new Set(work.filter(item => item.level === 'critical').map(item => item.type === 'obligation' ? `obligation:${item.id}` : item.key)).size
    const overdueRatio = metrics.financeOpen > 0 ? metrics.financeOverdue * 100 / metrics.financeOpen : 0
    return {
      collectionRate: currentFinance.rate,
      previousCollectionRate: previousFinance.rate,
      overdueRatio,
      critical: uniqueCritical,
      onTime: metrics.pendingOnTimePercent,
    }
  }, [office, metrics, day])

  return <section className="mgmt-insights" aria-label="Indicadores-chave do escritório">
    <header><div><span>Leitura executiva</span><h2>Indicadores-chave</h2></div><small>Comparação e risco, sem duplicar a fila operacional.</small></header>
    <div className="mgmt-insights-grid">
      <article><span>Taxa de recebimento</span><strong>{pct(insights.collectionRate)}</strong><small>{deltaLabel(insights.collectionRate, insights.previousCollectionRate)}</small></article>
      <article className={insights.overdueRatio >= 20 ? 'danger' : insights.overdueRatio > 0 ? 'warning' : 'ok'}><span>Aberto já vencido</span><strong>{pct(insights.overdueRatio)}</strong><small>percentual do saldo em aberto</small></article>
      <article className={insights.critical ? 'warning' : 'ok'}><span>Operação crítica</span><strong>{insights.critical}</strong><small>{metrics.clientsAtRisk} cliente(s) com risco concentrado</small></article>
      <article className={insights.onTime < 85 ? 'warning' : 'ok'}><span>Trabalho no prazo</span><strong>{pct(insights.onTime)}</strong><small>itens abertos com vencimento preservado</small></article>
    </div>
  </section>
}
