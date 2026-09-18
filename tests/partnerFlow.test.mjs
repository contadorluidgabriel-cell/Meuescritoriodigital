import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProcessFinanceCharges } from '../src/lib/processFinance.js'
import { buildPartnerFlow } from '../src/lib/partnerFlow.js'

const client = { id: 'cliente-ficticio', razao: 'Empresa de teste', perfilAtendimento: 'Compartilhado', parceiroIds: ['parceiro-ficticio'] }
const partner = { id: 'parceiro-ficticio', nome: 'Parceiro de teste' }
const account = { id: 'conta-ficticia', nome: 'Conta do escritório' }
let sequence = 0
const installments = buildProcessFinanceCharges({
  id: 'processo-ficticio', clientId: client.id, tipo: 'Regularização de teste', cobradoAParte: true,
  financeiroValor: 800, financeiroParcelas: 2, financeiroVencimento: '2026-09-10',
  financeiroRecebedor: 'partner:parceiro-ficticio', financeiroMinhaParte: 400,
  financeiroPartesParceiros: [{ parceiroId: partner.id, valor: 400 }],
}, client, prefix => `${prefix}-ficticio-${++sequence}`)
const paid = {
  ...installments[0], status: 'Recebido', pagamentos: [{ id: 'pay-ficticio', data: '2026-09-10', valorRecebido: 400 }],
  compartilhadoAcertoStatus: 'Liquidado', compartilhadoAcertoEm: '2026-09-11',
  compartilhadoAcertoPagamento: { data: '2026-09-11', contaId: account.id, valor: 200 },
}
const workspace = finance => ({ clients: [client], partners: [partner], financeAccounts: [account], finance })

test('extrato do processo mostra as duas parcelas, quitação e repasse sem duplicar a parte do parceiro', () => {
  const result = buildPartnerFlow(workspace([paid, installments[1]]), { partnerId: partner.id })
  assert.equal(result.totals.gross, 800)
  assert.equal(result.totals.partnerShare, 400)
  assert.equal(result.totals.customerPaidShare, 200)
  assert.equal(result.totals.customerOpenShare, 200)
  assert.equal(result.totals.settlementsToOffice, 200)
  assert.equal(result.totals.settlementsToPartner, 0)
  assert.equal(result.totals.unverified, 0)
  assert.equal(result.events.filter(row => row.kind === 'billing').length, 2)
  assert.equal(result.events.filter(row => row.kind === 'payment').length, 1)
  const settlement = result.events.find(row => row.kind === 'settlement')
  assert.equal(settlement.value, 200)
  assert.equal(settlement.account, 'Conta do escritório')
  assert.equal(settlement.processId, 'processo-ficticio')
})

test('mês filtra eventos pela data própria, preservando os totais históricos', () => {
  const result = buildPartnerFlow(workspace([paid, installments[1]]), { month: '2026-09' })
  assert.equal(result.events.length, 3)
  assert.equal(result.totals.partnerShare, 400)
  assert.ok(result.events.every(row => row.date.startsWith('2026-09')))
})

test('acerto liquidado sem documento bancário é exibido como pendência de conciliação, não como repasse', () => {
  const { compartilhadoAcertoPagamento, ...legacy } = paid
  const result = buildPartnerFlow(workspace([legacy]))
  assert.equal(result.totals.unverified, 1)
  assert.equal(result.totals.settlementsToOffice, 0)
  assert.equal(result.events.filter(row => row.kind === 'unverified').length, 1)
  assert.equal(result.events.filter(row => row.kind === 'settlement').length, 0)
})

test('quando o escritório recebe, o extrato identifica a saída paga ao parceiro', () => {
  const charge = { ...paid, compartilhadoRecebedor: 'Escritorio', compartilhadoAcertoPagamento: { data: '2026-09-11', contaId: account.id, valor: 200 } }
  const result = buildPartnerFlow(workspace([charge]))
  assert.equal(result.totals.settlementsToOffice, 0)
  assert.equal(result.totals.settlementsToPartner, 200)
  assert.equal(result.events.find(row => row.kind === 'settlement').status, 'Repasse pago pelo escritório')
})

test('cobrança parcial não gera repasse antecipado e mostra somente a parte quitada', () => {
  const partial = { ...installments[0], status: 'Parcial', pagamentos: [{ id: 'parcial', data: '2026-09-10', valorRecebido: 100 }] }
  const result = buildPartnerFlow(workspace([partial]))
  assert.equal(result.totals.customerPaidShare, 50)
  assert.equal(result.totals.customerOpenShare, 150)
  assert.equal(result.events.filter(row => row.kind === 'settlement' || row.kind === 'pending').length, 0)
})

test('acerto pendente é mostrado e não é confundido com caixa liquidado', () => {
  const open = { ...paid, compartilhadoAcertoStatus: 'Pendente', compartilhadoAcertoPagamento: null }
  const result = buildPartnerFlow(workspace([open]))
  assert.equal(result.events.find(row => row.kind === 'pending').value, 200)
  assert.equal(result.totals.settlementsToOffice, 0)
})

test('filtro de parceiro não contabiliza valores de outros parceiros nem replica faturamento bruto', () => {
  const another = { id: 'outro', nome: 'Outro parceiro' }
  const office = workspace([paid])
  office.partners.push(another)
  const all = buildPartnerFlow(office)
  const other = buildPartnerFlow(office, { partnerId: another.id })
  assert.equal(all.totals.gross, 400)
  assert.equal(other.totals.gross, 0)
  assert.equal(other.events.length, 0)
})
