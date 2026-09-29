import test from 'node:test'
import assert from 'node:assert/strict'
import { buildClientsTxt, buildFinanceTxt, buildProcessesTxt, txtExportFilename } from '../src/lib/txtExports.js'

const office = {
  clients: [{
    id: 'cli-1',
    tipo: 'PF',
    razao: 'João Teste',
    documento: '123.456.789-00',
    status: 'Ativo',
    perfilAtendimento: 'Compartilhado',
    parceiroIds: ['par-1'],
    telefone: '91999999999',
    drive: 'https://drive.example/cliente',
    observacoes: 'Cliente de teste',
  }],
  partners: [{ id: 'par-1', nome: 'Parceiro Teste' }],
  processes: [{
    id: 'proc-1',
    clientId: 'cli-1',
    tipo: 'Abertura de CNPJ',
    status: 'Aguardando cliente',
    dataAbertura: '2026-09-29',
    etapas: [
      { nome: 'Documentos', status: 'Aguardando cliente', responsavelTipo: 'cliente', prazoEtapa: '2026-10-02', ordem: 0 },
      { nome: 'Registro', status: 'Pendente', responsavelTipo: 'interno', ordem: 1 },
    ],
    protocolos: [{ numero: 'ABC123', data: '2026-09-29' }],
  }],
  finance: [{
    id: 'fin-1',
    clienteId: 'cli-1',
    descricao: 'Serviço',
    competencia: '2026-09',
    vencimento: '2026-09-30',
    valor: 250,
    status: 'Pendente',
    pagamentos: [],
  }],
  financePayables: [{
    id: 'pay-1',
    descricao: 'Sistema',
    vencimento: '2026-09-30',
    valor: 100,
    status: 'Pendente',
  }],
  financeMovements: [{
    id: 'mov-1',
    descricao: 'Ajuste de caixa',
    data: '2026-09-29',
    tipo: 'Entrada',
    valor: 50,
  }],
  financeAccounts: [{ id: 'acc-1', nome: 'Conta principal', ativo: true }],
  financeCategories: [{ id: 'cat-1', nome: 'Honorários', tipo: 'Receita' }],
}

test('exportação de clientes produz TXT legível com vínculo de parceiro', () => {
  const txt = buildClientsTxt(office)
  assert.match(txt, /EXPORTAÇÃO: CLIENTES/)
  assert.match(txt, /Nome: João Teste/)
  assert.match(txt, /CPF\/CNPJ: 123\.456\.789-00/)
  assert.match(txt, /Forma de atendimento: Compartilhado/)
  assert.match(txt, /Parceiro\(s\): Parceiro Teste/)
  assert.match(txt, /Google Drive: https:\/\/drive\.example\/cliente/)
})

test('exportação de processos inclui cliente, etapas e protocolos', () => {
  const txt = buildProcessesTxt(office)
  assert.match(txt, /EXPORTAÇÃO: PROCESSOS/)
  assert.match(txt, /Cliente: João Teste/)
  assert.match(txt, /Tipo: Abertura de CNPJ/)
  assert.match(txt, /1\. Documentos — Aguardando cliente/)
  assert.match(txt, /2\. Registro — Pendente/)
  assert.match(txt, /ABC123/)
})

test('exportação financeira reúne receber, pagar e movimentações no mesmo TXT', () => {
  const txt = buildFinanceTxt(office)
  assert.match(txt, /EXPORTAÇÃO: FINANCEIRO/)
  assert.match(txt, /=== CONTAS A RECEBER ===/)
  assert.match(txt, /Descrição: Serviço/)
  assert.match(txt, /Valor: R\$\s?250,00/)
  assert.match(txt, /=== CONTAS A PAGAR ===/)
  assert.match(txt, /Descrição: Sistema/)
  assert.match(txt, /=== MOVIMENTAÇÕES ===/)
  assert.match(txt, /Descrição: Ajuste de caixa/)
  assert.match(txt, /=== CONTAS FINANCEIRAS ===/)
  assert.match(txt, /Conta principal/)
})

test('nomes dos arquivos usam extensão TXT e data da exportação', () => {
  const date = new Date('2026-09-29T12:00:00.000Z')
  assert.equal(txtExportFilename('clients', date), 'med-clientes-2026-09-29.txt')
  assert.equal(txtExportFilename('processes', date), 'med-processos-2026-09-29.txt')
  assert.equal(txtExportFilename('finance', date), 'med-financeiro-2026-09-29.txt')
})
