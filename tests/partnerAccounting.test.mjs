import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProcessFinanceCharges } from '../src/lib/processFinance.js'
import { accountBalances, cashMovements, financeOverview, managerialDre } from '../src/lib/financeComplete.js'
import { missingPartnerSettlements, officeCustomerCash, partnerSettlementCash } from '../src/lib/partnerAccounting.js'

let id = 0
const client = { id: 'cli-ficticio', perfilAtendimento: 'Compartilhado', parceiroIds: ['par-ficticio'] }
const process = {
  id: 'proc-ficticio', clientId: client.id, tipo: 'Serviço de teste', cobradoAParte: true,
  financeiroValor: 800, financeiroParcelas: 2, financeiroVencimento: '2026-09-10',
  financeiroRecebedor: 'partner:par-ficticio', financeiroMinhaParte: 400,
  financeiroPartesParceiros: [{ parceiroId: 'par-ficticio', valor: 400 }],
}
const installments = buildProcessFinanceCharges(process, client, prefix => `${prefix}-${++id}`)
const paid = { ...installments[0], status: 'Recebido', recebidoEm: '2026-09-10', pagamentos: [{ id: 'pay-test', data: '2026-09-10', valorRecebido: 400, contaId: 'conta-teste' }], compartilhadoAcertoStatus: 'Liquidado', compartilhadoAcertoEm: '2026-09-11' }
const account = { id: 'conta-teste', nome: 'Conta fictícia', saldoInicial: 0 }
const office = finance => ({ clients: [client], finance, financeAccounts: [account], financePayables: [], financeMovements: [] })

test('parcelamento do processo preserva a participação econômica de cada parte', () => {
  assert.equal(installments.length, 2)
  assert.deepEqual(installments.map(item => [item.valor, item.compartilhadoMinhaParte, item.compartilhadoPartesParceiros[0].valor]), [[400, 200, 200], [400, 200, 200]])
})

test('baixa recebida pelo parceiro não entra na conta do escritório', () => {
  assert.equal(officeCustomerCash(paid, client, paid.pagamentos[0]), 0)
  assert.equal(cashMovements(office([paid])).length, 0)
  assert.equal(accountBalances(office([paid]))[0].saldoAtual, 0)
  assert.equal(financeOverview(office([paid]), { day: '2026-09-12', competence: '2026-09' }).entriesMonth, 0)
})

test('liquidação legada sem lançamento bancário não inventa uma entrada', () => {
  assert.equal(partnerSettlementCash(paid, client), null)
  assert.equal(missingPartnerSettlements(office([paid])).length, 1)
})

test('repasse efetivamente registrado entra uma única vez e apenas pela parte do escritório', () => {
  const reconciled = { ...paid, compartilhadoAcertoPagamento: { data: '2026-09-11', contaId: account.id, valor: 200 } }
  const rows = cashMovements(office([reconciled]))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].sourceType, 'partner-settlement')
  assert.equal(rows[0].tipo, 'entrada')
  assert.equal(rows[0].valor, 200)
  assert.equal(accountBalances(office([reconciled]))[0].saldoAtual, 200)
  assert.equal(missingPartnerSettlements(office([reconciled])).length, 0)
})

test('quando escritório recebe do cliente, registra o bruto e a saída do parceiro separadamente', () => {
  const charge = { ...paid, compartilhadoRecebedor: 'Escritorio', compartilhadoAcertoPagamento: { data: '2026-09-11', contaId: account.id, valor: 200 } }
  const rows = cashMovements(office([charge]))
  assert.deepEqual(rows.map(row => [row.tipo, row.valor]).sort((a,b) => a[0].localeCompare(b[0])), [['entrada', 400], ['saida', 200]])
  assert.equal(accountBalances(office([charge]))[0].saldoAtual, 200)
})

test('cada um recebe sua parte: somente a cota do escritório integra o caixa', () => {
  const charge = { ...paid, compartilhadoRecebedor: 'CadaUm', compartilhadoAcertoStatus: 'Liquidado' }
  assert.equal(officeCustomerCash(charge, client, charge.pagamentos[0]), 200)
  assert.equal(accountBalances(office([charge]))[0].saldoAtual, 200)
})

test('resultado gerencial discrimina faturamento bruto e participação econômica dos parceiros', () => {
  const statement = managerialDre(office(installments), '2026-09')
  assert.equal(statement.revenue, 400)
  assert.equal(statement.partnerShare, 200)
  assert.equal(statement.officeRevenue, 200)
  assert.equal(statement.result, 200)
})

test('cancelamento após baixa preserva o dinheiro anteriormente recebido', () => {
  const canceled = { ...paid, status: 'Cancelado', compartilhadoRecebedor: 'Escritorio', compartilhadoAcertoStatus: 'Pendente' }
  assert.equal(cashMovements(office([canceled]))[0].valor, 400)
})
