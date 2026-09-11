import test from 'node:test'
import assert from 'node:assert/strict'
import { buildManagementDashboard } from '../src/lib/managementDashboard.js'

test('painel gerencial consolida carteira, operação, financeiro e atenção', () => {
  const office = {
    clients: [
      { id: 'c1', razao: 'Alpha Ltda', status: 'Ativo', relacionamento: 'Mensal', mensalidade: 1000, tributacao: 'Simples Nacional' },
      { id: 'c2', razao: 'Beta ME', status: 'Ativo', relacionamento: 'Mensal', mensalidade: 500, tributacao: 'MEI' },
      { id: 'c3', razao: 'Avulso SA', status: 'Ativo', relacionamento: 'Avulso', mensalidade: 0, tributacao: 'Lucro Presumido' },
    ],
    linkedCompanies: [],
    tasks: [
      { id: 't1', clientId: 'c1', titulo: 'Fechar fiscal', departamento: 'Fiscal', prazo: '2026-09-01', status: 'Pendente', prioridade: 'Alta' },
      { id: 't2', clientId: 'c2', titulo: 'Solicitar documentos', departamento: 'DP', prazo: '2026-09-20', status: 'Aguardando cliente', prioridade: 'Normal' },
    ],
    processes: [
      { id: 'p1', clientId: 'c1', tipo: 'Alteração contratual', departamento: 'Societário', prazoFinal: '2026-09-09', status: 'Em andamento' },
    ],
    obligations: [
      { id: 'o1', nome: 'DCTFWeb', categoria: 'Fiscal', clientes: [
        { clienteId: 'c1', vencimento: '2026-09-10', status: 'Pendente' },
        { clienteId: 'c2', vencimento: '2026-09-25', status: 'Pendente' },
      ] },
    ],
    finance: [
      { id: 'f1', clienteId: 'c1', valor: 1000, competencia: '2026-09', vencimento: '2026-07-01', status: 'Pendente', pagamentos: [] },
      { id: 'f2', clienteId: 'c2', valor: 500, competencia: '2026-09', vencimento: '2026-09-15', status: 'Parcial', pagamentos: [{ id: 'r1', data: '2026-09-05', valorRecebido: 200 }] },
      { id: 'f0', clienteId: 'c1', valor: 800, competencia: '2026-08', vencimento: '2026-08-10', status: 'Recebido', recebidoEm: '2026-08-12' },
    ],
    financePayables: [
      { id: 'pg1', valor: 300, competencia: '2026-09', vencimento: '2026-09-05', status: 'Pendente', pagamentos: [] },
      { id: 'pg2', valor: 200, competencia: '2026-09', vencimento: '2026-09-08', status: 'Pago', pagamentos: [{ id: 'pp1', data: '2026-09-08', valorPago: 200 }] },
    ],
    history: [
      { id: 'h1', completedAt: '2026-09-03T12:00:00Z' },
      { id: 'h2', completedAt: '2026-08-04T12:00:00Z' },
    ],
  }

  const data = buildManagementDashboard(office, { day: '2026-09-10' })

  assert.equal(data.portfolio.recurring.length, 2)
  assert.equal(data.portfolio.monthlyFees, 1500)
  assert.equal(data.portfolio.averageTicket, 750)
  assert.equal(Math.round(data.portfolio.concentration), 67)

  const fiscal = data.operation.departments.find(row => row.label === 'Fiscal')
  assert.ok(fiscal)
  assert.equal(fiscal.open, 3)
  assert.equal(fiscal.overdue, 1)

  assert.equal(data.finance.receivableOpen, 1300)
  assert.equal(data.finance.receivableOverdue, 1000)
  assert.equal(data.finance.payableOpen, 300)
  assert.equal(data.finance.payableOverdue, 300)
  assert.equal(data.finance.aging.over60, 1000)
  assert.equal(data.finance.current.received, 200)
  assert.equal(data.finance.current.paid, 200)
  assert.equal(data.finance.cashResult, 0)

  assert.equal(data.clientsAttention[0].name, 'Alpha Ltda')
  assert.ok(data.alerts.some(alert => alert.title.includes('mais de 30 dias')))
  assert.equal(data.completionTrend.at(-1).completed, 1)
})
