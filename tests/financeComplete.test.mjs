import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_FINANCE_CATEGORIES,
  accountBalances,
  addPaymentToPayable,
  buildPayableInstallments,
  buildRecurringEntries,
  cashMovements,
  financeOverview,
  forecastCash,
  managerialDre,
  payableSummary,
  removePaymentFromPayable,
} from '../src/lib/financeComplete.js'

test('conta a pagar suporta baixa parcial, desconto e estorno', () => {
  const payable = { id: 'p1', descricao: 'Sistema', valor: 500, vencimento: '2026-09-10', competencia: '2026-09', pagamentos: [] }
  const partial = addPaymentToPayable(payable, { data: '2026-09-05', valorPago: 200, desconto: 20, acrescimo: 0, contaId: 'bank' }, () => 'pay1')
  assert.equal(payableSummary(partial).balance, 280)
  assert.equal(partial.status, 'Parcial')
  assert.equal(partial.pagamentos[0].contaId, 'bank')
  const reversed = removePaymentFromPayable(partial, 'pay1', '2026-09-06')
  assert.equal(payableSummary(reversed).balance, 500)
  assert.equal(reversed.status, 'Pendente')
})

test('parcelamento de despesa conserva o total em centavos', () => {
  let index = 0
  const rows = buildPayableInstallments({ id: 'p', descricao: 'Equipamento', valor: 100, vencimento: '2026-09-30', competencia: '2026-09', pagamentos: [], status: 'Pendente' }, 3, prefix => `${prefix}-${++index}`)
  assert.equal(rows.length, 3)
  assert.equal(rows.reduce((sum, item) => sum + item.valor, 0), 100)
  assert.deepEqual(rows.map(item => item.vencimento), ['2026-09-30', '2026-10-30', '2026-11-30'])
})

test('saldo por conta usa entradas, saídas e transferência sem alterar consolidado', () => {
  const office = {
    financeAccounts: [
      { id: 'a', nome: 'Banco A', saldoInicial: 1000, ativo: true },
      { id: 'b', nome: 'Banco B', saldoInicial: 0, ativo: true },
    ],
    finance: [], financePayables: [],
    financeMovements: [
      { id: 'm1', tipo: 'entrada', data: '2026-09-01', valor: 500, contaId: 'a', realizado: true },
      { id: 'm2', tipo: 'saida', data: '2026-09-01', valor: 200, contaId: 'a', realizado: true },
      { id: 'm3', tipo: 'transferencia', data: '2026-09-01', valor: 300, contaId: 'a', contaDestinoId: 'b', realizado: true },
    ],
  }
  const balances = accountBalances(office, '2026-09-01')
  assert.equal(balances.find(item => item.id === 'a').saldoAtual, 1000)
  assert.equal(balances.find(item => item.id === 'b').saldoAtual, 300)
  assert.equal(balances.reduce((sum, item) => sum + item.saldoAtual, 0), 1300)
  assert.equal(cashMovements(office).filter(item => item.transfer).length, 2)
})

test('previsão soma contas a receber e subtrai contas a pagar abertas', () => {
  const office = {
    financeAccounts: [{ id: 'a', nome: 'Banco', saldoInicial: 1000, ativo: true }], financeMovements: [],
    finance: [{ id: 'r1', valor: 800, vencimento: '2026-09-10', competencia: '2026-09', status: 'Pendente', pagamentos: [] }],
    financePayables: [{ id: 'p1', valor: 300, vencimento: '2026-09-12', competencia: '2026-09', status: 'Pendente', pagamentos: [] }],
  }
  const result = forecastCash(office, { day: '2026-09-01', days: 30 })
  assert.equal(result.startBalance, 1000)
  assert.equal(result.incoming, 800)
  assert.equal(result.outgoing, 300)
  assert.equal(result.projectedBalance, 1500)
})

test('recorrências geram apenas competências ausentes', () => {
  const office = {
    financeRecurrences: [
      { id: 'rec-r', tipo: 'receita', descricao: 'Receita fixa', valor: 400, diaVencimento: 5, inicioCompetencia: '2026-09', ativo: true },
      { id: 'rec-p', tipo: 'despesa', descricao: 'Software', valor: 90, diaVencimento: 10, inicioCompetencia: '2026-09', ativo: true },
    ],
    finance: [{ id: 'existing', recorrenciaId: 'rec-r', competencia: '2026-09', valor: 400, status: 'Pendente', pagamentos: [] }],
    financePayables: [],
  }
  let index = 0
  const generated = buildRecurringEntries(office, '2026-09', prefix => `${prefix}-${++index}`)
  assert.equal(generated.receivables.length, 0)
  assert.equal(generated.payables.length, 1)
  assert.equal(generated.payables[0].vencimento, '2026-09-10')
})

test('DRE gerencial usa competência e separa receitas de despesas', () => {
  const office = {
    financeCategories: DEFAULT_FINANCE_CATEGORIES,
    finance: [
      { id: 'r1', valor: 1000, competencia: '2026-09', categoriaId: 'rec-honorarios', status: 'Pendente' },
      { id: 'r2', valor: 250, competencia: '2026-10', categoriaId: 'rec-servicos', status: 'Pendente' },
    ],
    financePayables: [
      { id: 'p1', valor: 300, competencia: '2026-09', categoriaId: 'desp-sistemas', status: 'Pendente' },
      { id: 'p2', valor: 100, competencia: '2026-09', categoriaId: 'desp-marketing', status: 'Pendente' },
    ],
  }
  const dre = managerialDre(office, '2026-09')
  assert.equal(dre.revenue, 1000)
  assert.equal(dre.expense, 400)
  assert.equal(dre.result, 600)
})

test('visão geral diferencia caixa realizado de competência', () => {
  const office = {
    financeAccounts: [{ id: 'a', nome: 'Banco', saldoInicial: 0, ativo: true }],
    financeCategories: DEFAULT_FINANCE_CATEGORIES,
    financeMovements: [{ id: 'm1', tipo: 'entrada', data: '2026-09-02', competencia: '2026-09', descricao: 'Aporte', valor: 200, contaId: 'a', realizado: true }],
    finance: [{ id: 'r1', valor: 1000, competencia: '2026-09', vencimento: '2026-09-10', status: 'Pendente', pagamentos: [] }],
    financePayables: [{ id: 'p1', valor: 300, competencia: '2026-09', vencimento: '2026-09-15', status: 'Pendente', pagamentos: [] }],
  }
  const result = financeOverview(office, { day: '2026-09-05', competence: '2026-09' })
  assert.equal(result.entriesMonth, 200)
  assert.equal(result.cashResultMonth, 200)
  assert.equal(result.projectedOperationalResult, 700)
})
