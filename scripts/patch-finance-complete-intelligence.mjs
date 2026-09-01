import { readFileSync, writeFileSync } from 'node:fs'

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Finance intelligence patch failed (${label})`)
  return source.replace(from, to)
}

export function applyFinanceCompleteIntelligencePatch(root) {
  const libPath = `${root}src/lib/operationalIntelligence.js`
  let lib = readFileSync(libPath, 'utf8')
  if (!lib.includes("payableSummary } from './financeComplete.js'")) {
    lib = replaceOrFail(
      lib,
      "import { paymentSummary } from './financePro.js'",
      "import { payableSummary } from './financeComplete.js'\nimport { paymentSummary } from './financePro.js'",
      'payable import',
    )
    lib = replaceOrFail(
      lib,
      "      view: alert.type === 'finance' || alert.type === 'partner' ? 'honorarios' : alert.type === 'task' ? 'tarefas' : alert.type === 'process' ? 'processos' : 'obrigacoes',",
      "      view: alert.type === 'finance' || alert.type === 'payable' || alert.type === 'partner' ? 'honorarios' : alert.type === 'task' ? 'tarefas' : alert.type === 'process' ? 'processos' : 'obrigacoes',",
      'payable route',
    )
    lib = replaceOrFail(
      lib,
      "  const overdueFinance = openFinance.filter(charge => charge.vencimento && String(charge.vencimento) < day)\n  const billedMonth",
      "  const overdueFinance = openFinance.filter(charge => charge.vencimento && String(charge.vencimento) < day)\n  const openPayables = (office.financePayables || []).filter(payable => String(payable.status || '').toLowerCase() !== 'cancelado' && payableSummary(payable).balance > 0.009)\n  const overduePayables = openPayables.filter(payable => payable.vencimento && String(payable.vencimento) < day)\n  const paidMonth = (office.financePayables || []).reduce((sum, payable) => sum + payableSummary(payable).payments.filter(payment => String(payment.data || '').startsWith(currentMonth)).reduce((inner, payment) => inner + Number(payment.valorPago || 0), 0), 0)\n  const expensesMonth = (office.financePayables || []).filter(payable => String(payable.competencia || payable.vencimento || '').startsWith(currentMonth) && String(payable.status || '').toLowerCase() !== 'cancelado').reduce((sum, payable) => sum + payableSummary(payable).total, 0)\n  const billedMonth",
      'payable metrics',
    )
    lib = replaceOrFail(
      lib,
      "    financeOverdue: overdueFinance.reduce((sum, charge) => sum + paymentSummary(charge).balance, 0),\n    billedMonth,\n    receivedMonth,",
      "    financeOverdue: overdueFinance.reduce((sum, charge) => sum + paymentSummary(charge).balance, 0),\n    payableOpen: openPayables.reduce((sum, payable) => sum + payableSummary(payable).balance, 0),\n    payableOverdue: overduePayables.reduce((sum, payable) => sum + payableSummary(payable).balance, 0),\n    billedMonth,\n    receivedMonth,\n    expensesMonth,\n    paidMonth,",
      'payable metric return',
    )
    writeFileSync(libPath, lib)
  }

  const componentPath = `${root}src/components/OperationalCommandCenter.jsx`
  let component = readFileSync(componentPath, 'utf8')
  if (!component.includes('metrics.financeOverdue + metrics.payableOverdue')) {
    component = replaceOrFail(
      component,
      "    if (pendingFilter === 'finance') return item.type === 'finance' || item.type === 'partner'",
      "    if (pendingFilter === 'finance') return item.type === 'finance' || item.type === 'payable' || item.type === 'partner'",
      'finance filter',
    )
    component = replaceOrFail(
      component,
      "<span>Financeiro vencido</span><strong>{money(metrics.financeOverdue)}</strong><small>saldo em atraso</small>",
      "<span>Financeiro vencido</span><strong>{money(metrics.financeOverdue + metrics.payableOverdue)}</strong><small>receber + pagar em atraso</small>",
      'finance kpi',
    )
    component = replaceOrFail(
      component,
      "<span className={`occ-kind type-${item.type}`}>{item.kindLabel || (item.type === 'finance' ? 'Financeiro' : item.type === 'partner' ? 'Parceiro' : 'Item')}</span>",
      "<span className={`occ-kind type-${item.type}`}>{item.kindLabel || (item.type === 'finance' ? 'Financeiro' : item.type === 'payable' ? 'Conta a pagar' : item.type === 'partner' ? 'Parceiro' : 'Item')}</span>",
      'payable label',
    )
    component = replaceOrFail(
      component,
      "<div><span>Total em aberto</span><strong>{money(metrics.financeOpen)}</strong></div>\n        <div className={metrics.financeOverdue ? 'danger' : ''}><span>Vencido</span><strong>{money(metrics.financeOverdue)}</strong></div>",
      "<div><span>A receber</span><strong>{money(metrics.financeOpen)}</strong><small>{money(metrics.financeOverdue)} vencido</small></div>\n        <div className={metrics.payableOverdue ? 'danger' : ''}><span>A pagar</span><strong>{money(metrics.payableOpen)}</strong><small>{money(metrics.payableOverdue)} vencido</small></div>",
      'financial health cards',
    )
    component = replaceOrFail(
      component,
      "<div><span>Recebido no mês</span><strong>{money(metrics.receivedMonth)}</strong></div>",
      "<div><span>Recebido no mês</span><strong>{money(metrics.receivedMonth)}</strong><small>Pago: {money(metrics.paidMonth)}</small></div>",
      'cash month card',
    )
    component = replaceOrFail(
      component,
      "<div><span>Faturado no mês</span><strong>{money(metrics.billedMonth)}</strong></div>",
      "<div><span>Receitas da competência</span><strong>{money(metrics.billedMonth)}</strong><small>Despesas: {money(metrics.expensesMonth)}</small></div>",
      'competence month card',
    )
    writeFileSync(componentPath, component)
  }
}
