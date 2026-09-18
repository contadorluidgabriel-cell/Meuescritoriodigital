import test from 'node:test'
import assert from 'node:assert/strict'
import { forecastCash } from '../src/lib/financeComplete.js'
import { partnerForecast30Days, projectedPartnerAmounts } from '../src/lib/partnerAccounting.js'

const client = { id: 'cliente-teste', perfilAtendimento: 'Compartilhado', parceiroIds: ['parceiro-teste'] }
const base = { id: 'cobranca-teste', clienteId: client.id, compartilhado: true, valor: 400, vencimento: '2026-09-20', competencia: '2026-09', status: 'Pendente', pagamentos: [], compartilhadoMinhaParte: 200, compartilhadoPartesParceiros: [{ parceiroId: 'parceiro-teste', valor: 200 }] }
const office = charge => ({ clients: [client], finance: [charge], financePayables: [], financeMovements: [], financeAccounts: [{ id: 'conta', saldoInicial: 0 }] })

test('previsão de cobrança paga ao parceiro não reconhece R$ 400 como receita bancária do escritório', () => {
  const charge = { ...base, compartilhadoRecebedor: 'partner:parceiro-teste' }
  assert.deepEqual(projectedPartnerAmounts(charge, client), { incoming: 200, outgoing: 0 })
  assert.equal(forecastCash(office(charge), { day: '2026-09-18', days: 30 }).projectedBalance, 200)
  assert.equal(partnerForecast30Days([charge], [client], '2026-09-18'), 200)
})

test('previsão quando escritório recebe contabiliza o bruto e prevê o repasse como saída', () => {
  const charge = { ...base, compartilhadoRecebedor: 'Escritorio' }
  assert.deepEqual(projectedPartnerAmounts(charge, client), { incoming: 400, outgoing: 200 })
  const forecast = forecastCash(office(charge), { day: '2026-09-18', days: 30 })
  assert.equal(forecast.incoming, 400)
  assert.equal(forecast.outgoing, 200)
  assert.equal(forecast.projectedBalance, 200)
})

test('previsão de pagamentos diretos para cada parte considera apenas a cota do escritório', () => {
  const charge = { ...base, compartilhadoRecebedor: 'CadaUm' }
  assert.deepEqual(projectedPartnerAmounts(charge, client), { incoming: 200, outgoing: 0 })
  assert.equal(partnerForecast30Days([charge], [client], '2026-09-18'), 200)
})
