import test from 'node:test'
import assert from 'node:assert/strict'
import { collectOfficeNotifications, summarizeNotifications } from '../src/lib/notificationCenter.js'

test('central combina operação, financeiro e acertos com parceiros', () => {
  const office = {
    clients: [
      { id: 'c1', nome: 'Cliente Alfa' },
      { id: 'c2', nome: 'Cliente Beta', perfilAtendimento: 'Compartilhado', parceiroIds: ['p1'] },
    ],
    partners: [{ id: 'p1', nome: 'Parceiro Um' }],
    tasks: [
      { id: 't1', titulo: 'Enviar guia', clientId: 'c1', prazo: '2026-09-02', status: 'Pendente' },
      { id: 't2', titulo: 'Concluída', clientId: 'c1', prazo: '2026-09-01', status: 'Concluído' },
    ],
    processes: [],
    obligations: [],
    finance: [
      {
        id: 'f1', clienteId: 'c1', descricao: 'Honorários setembro', valor: 100,
        vencimento: '2026-08-30', status: 'Parcial',
        pagamentos: [{ id: 'pay1', data: '2026-08-30', valorRecebido: 40 }],
      },
      {
        id: 'f2', clienteId: 'c2', descricao: 'Honorários compartilhados', valor: 100,
        vencimento: '2026-09-01', status: 'Recebido', compartilhado: true,
        pagamentos: [{ id: 'pay2', data: '2026-09-01', valorRecebido: 100 }],
        parceiroIds: ['p1'], compartilhadoRecebedor: 'Escritorio', compartilhadoMinhaParte: 60,
        compartilhadoPartesParceiros: [{ parceiroId: 'p1', valor: 40 }], compartilhadoAcertoStatus: 'Pendente',
      },
      { id: 'f3', clienteId: 'c1', descricao: 'Fora da janela', valor: 200, vencimento: '2026-09-10', status: 'Pendente' },
    ],
  }

  const items = collectOfficeNotifications(office, { day: '2026-09-01', daysBefore: 3 })

  assert.equal(items.some(item => item.key === 'operation:task|t1'), true)
  const finance = items.find(item => item.key === 'finance:f1')
  assert.ok(finance)
  assert.equal(finance.level, 'critical')
  assert.equal(finance.kindLabel, 'Pagamento parcial')
  assert.match(finance.subtitle, /R\$\s*60,00/)

  const partner = items.find(item => item.key === 'partner:f2')
  assert.ok(partner)
  assert.equal(partner.level, 'attention')
  assert.match(partner.subtitle, /R\$\s*40,00/)
  assert.match(partner.subtitle, /Parceiro Um/)

  assert.equal(items.some(item => item.key === 'operation:task|t2'), false)
  assert.equal(items.some(item => item.key === 'finance:f3'), false)

  const summary = summarizeNotifications(items)
  assert.equal(summary.critical, 1)
  assert.equal(summary.attention, 1)
  assert.equal(summary.info, 1)
  assert.equal(summary.finance, 1)
  assert.equal(summary.partner, 1)
  assert.equal(summary.operation, 1)
})

test('acerto liquidado desaparece automaticamente', () => {
  const office = {
    clients: [{ id: 'c1', nome: 'Cliente', perfilAtendimento: 'Compartilhado', parceiroIds: ['p1'] }],
    partners: [{ id: 'p1', nome: 'Parceiro' }],
    tasks: [], processes: [], obligations: [],
    finance: [{
      id: 'f1', clienteId: 'c1', descricao: 'Mensalidade', valor: 100, vencimento: '2026-09-01', status: 'Recebido',
      pagamentos: [{ id: 'p', data: '2026-09-01', valorRecebido: 100 }], compartilhado: true,
      parceiroIds: ['p1'], compartilhadoRecebedor: 'Escritorio', compartilhadoMinhaParte: 70,
      compartilhadoPartesParceiros: [{ parceiroId: 'p1', valor: 30 }], compartilhadoAcertoStatus: 'Liquidado',
    }],
  }

  const items = collectOfficeNotifications(office, { day: '2026-09-01', daysBefore: 3 })
  assert.deepEqual(items, [])
})
