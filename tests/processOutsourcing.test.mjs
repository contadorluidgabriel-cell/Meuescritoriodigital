import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizedOutsourcingBatch, outsourcingBatchError, outsourcingBatchSummary } from '../src/lib/processOutsourcing.js'

const office = {
  clients: [
    { id: 'cli-1', perfilAtendimento: 'Terceirizador', status: 'Ativo' },
    { id: 'cli-2', perfilAtendimento: 'Direto', status: 'Ativo' },
  ],
  linkedCompanies: [
    { id: 'ter-1', clientId: 'cli-1', status: 'Ativo', razao: 'Empresa A' },
    { id: 'ter-2', clientId: 'cli-1', status: 'Ativo', razao: 'Empresa B' },
    { id: 'ter-3', clientId: 'cli-2', status: 'Ativo', razao: 'Empresa C' },
  ],
}

test('validates outsourced process against selected outsourcing client and companies', () => {
  const process = {
    terceirizacaoLote: true,
    clientId: 'cli-1',
    quantitativo: true,
    unidadeQuantidade: 'Pessoas',
    empresasTerceirizadas: [
      { companyId: 'ter-1', quantidadePessoas: 120, fechado: true },
      { companyId: 'ter-2', quantidadePessoas: 80, fechado: false },
    ],
  }
  assert.equal(outsourcingBatchError(process, office), '')
  assert.deepEqual(outsourcingBatchSummary(process), {
    empresas: 2,
    totalPessoas: 200,
    fechadas: 1,
    pendentes: 1,
    percentualFechamento: 50,
  })
})

test('requires quantities when process model uses quantitative control', () => {
  const process = {
    terceirizacaoLote: true,
    clientId: 'cli-1',
    quantitativo: true,
    empresasTerceirizadas: [{ companyId: 'ter-1', quantidadePessoas: 0, fechado: false }],
  }
  assert.equal(outsourcingBatchError(process, office), 'Informe a quantidade de pessoas de cada empresa selecionada.')
})

test('blocks companies that do not belong to selected outsourcing client', () => {
  const process = {
    terceirizacaoLote: true,
    clientId: 'cli-1',
    quantitativo: false,
    empresasTerceirizadas: [{ companyId: 'ter-3', fechado: false }],
  }
  assert.equal(outsourcingBatchError(process, office), 'Uma das empresas selecionadas não pertence ao cliente terceirizador informado.')
})

test('normalization preserves closing and converts quantities to integers', () => {
  const normalized = normalizedOutsourcingBatch({
    terceirizacaoLote: true,
    clientId: 'cli-1',
    quantitativo: true,
    unidadeQuantidade: 'Pessoas',
    empresasTerceirizadas: [{ companyId: 'ter-1', quantidadePessoas: '120.8', fechado: true }],
  })
  assert.deepEqual(normalized, {
    terceirizacaoLote: true,
    terceirizadorClientId: 'cli-1',
    empresasTerceirizadas: [{ companyId: 'ter-1', quantidadePessoas: 120, fechado: true }],
    quantitativo: true,
    unidadeQuantidade: 'Pessoas',
  })
})
