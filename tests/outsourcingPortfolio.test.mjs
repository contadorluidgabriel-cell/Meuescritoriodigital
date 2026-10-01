import test from 'node:test'
import assert from 'node:assert/strict'
import { outsourcingPortfolio } from '../src/lib/outsourcingPortfolio.js'

test('outsourcing portfolio aggregates linked companies and obligations for one outsourcer', () => {
  const office = {
    linkedCompanies: [
      { id: 'lc1', clientId: 'c1', razao: 'Empresa A', status: 'Ativo' },
      { id: 'lc2', clientId: 'c1', razao: 'Empresa B', status: 'Ativo' },
      { id: 'lc3', clientId: 'c2', razao: 'Empresa C', status: 'Ativo' },
    ],
    obligations: [
      { id: 'o1', nome: 'REINF 09/2026', categoria: 'Fiscal', quantitativo: true, clientes: [
        { clienteId: 'lc1', quantidadePessoas: 300, quantidadeConcluida: 180, status: 'Em andamento' },
        { clienteId: 'lc2', quantidadePessoas: 200, quantidadeConcluida: 200, status: 'Concluída', fechado: true },
      ] },
      { id: 'o2', nome: 'DCTFWeb', categoria: 'Fiscal', clientes: [
        { clienteId: 'lc1', status: 'Pendente' },
      ] },
      { id: 'o3', nome: 'Outra', categoria: 'Fiscal', clientes: [
        { clienteId: 'lc3', status: 'Pendente' },
      ] },
    ],
  }
  const result = outsourcingPortfolio(office, 'c1')
  assert.equal(result.companyCount, 2)
  assert.equal(result.obligationCount, 2)
  assert.equal(result.openObligationCount, 2)
  assert.equal(result.openLinkCount, 2)
  assert.equal(result.totalPeople, 500)
  assert.equal(result.completedPeople, 380)
  assert.equal(result.pendingPeople, 120)
  assert.equal(result.peoplePercent, 76)
  assert.equal(result.obligations.length, 3)
  assert.ok(result.obligations.every(row => ['lc1','lc2'].includes(row.companyId)))
})

test('outsourcing portfolio ignores inactive linked companies', () => {
  const result = outsourcingPortfolio({
    linkedCompanies: [{ id: 'lc1', clientId: 'c1', razao: 'Inativa', status: 'Inativo' }],
    obligations: [{ id: 'o1', clientes: [{ clienteId: 'lc1', status: 'Pendente' }] }],
  }, 'c1')
  assert.equal(result.companyCount, 0)
  assert.equal(result.obligationCount, 0)
})
