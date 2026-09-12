import test from 'node:test'
import assert from 'node:assert/strict'
import { applyOfficePatch } from '../supabase/functions/office-workspace/access.js'

const basePayload = {
  med_clientes: [{ id: 'c1', razao: 'Um' }, { id: 'c2', razao: 'Dois' }],
  med_tarefas: [
    { id: 'mine', clientId: 'c1', status: 'Pendente', responsavelUserId: 'admin2' },
    { id: 'other', clientId: 'c1', status: 'Pendente', responsavelUserId: 'u2' },
  ],
  med_processos: [],
  med_obrigacoes: [],
  med_financeiro: [
    { id: 'f1', clienteId: 'c1', valor: 100 },
    { id: 'f2', clienteId: 'c2', valor: 200 },
  ],
  med_financeiro_cobrancas_eventos: [
    { id: 'e1', cobrancaId: 'f1', nota: 'permitido' },
    { id: 'e2', cobrancaId: 'f2', nota: 'bloqueado' },
  ],
}

const adminMine = {
  role: 'admin',
  user_id: 'admin2',
  office_workspaces: { owner_user_id: 'owner' },
  permissions: {
    access_v2: true,
    client_ids: ['c1'],
    clients: true,
    tasks: true,
    processes: false,
    obligations: false,
    work_visibility: 'mine_and_unassigned',
    finance_receivables: true,
  },
}

test('administrador V2 com visibilidade restrita não altera nem exclui trabalho de terceiro', () => {
  const result = applyOfficePatch(basePayload, {
    tasks: {
      upserts: [
        { ...basePayload.med_tarefas[0], status: 'Concluída' },
        { ...basePayload.med_tarefas[1], status: 'Concluída' },
      ],
      deletes: ['other'],
    },
  }, adminMine)

  assert.equal(result.payload.med_tarefas.find(item => item.id === 'mine').status, 'Concluída')
  assert.equal(result.payload.med_tarefas.find(item => item.id === 'other').status, 'Pendente')
  assert.equal(result.payload.med_tarefas.some(item => item.id === 'other'), true)
})

test('evento de cobrança só pode ser alterado quando a cobrança pertence à carteira autorizada', () => {
  const result = applyOfficePatch(basePayload, {
    financeCollectionEvents: {
      upserts: [
        { ...basePayload.med_financeiro_cobrancas_eventos[0], nota: 'alterado' },
        { ...basePayload.med_financeiro_cobrancas_eventos[1], nota: 'tentativa indevida' },
      ],
      deletes: [],
    },
  }, adminMine)

  assert.equal(result.payload.med_financeiro_cobrancas_eventos.find(item => item.id === 'e1').nota, 'alterado')
  assert.equal(result.payload.med_financeiro_cobrancas_eventos.find(item => item.id === 'e2').nota, 'bloqueado')
})
