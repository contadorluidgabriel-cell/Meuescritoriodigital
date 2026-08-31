import { readFileSync, writeFileSync } from 'node:fs'

function patchFile(path, marker, replacements) {
  let source = readFileSync(path, 'utf8')
  if (source.includes(marker)) return
  for (const [from, to, label] of replacements) {
    if (!source.includes(from)) throw new Error(`Shared responsibility patch failed (${label}) in ${path}`)
    source = source.replace(from, to)
  }
  writeFileSync(path, source)
}

export function applySharedResponsibilityPatches(root) {
  patchFile(`${root}src/components/TasksReactBase.jsx`, "SharedResponsibilityField record={editing}", [
    [
      "import { quantitativeTaskError, taskCompletionBlocker, taskProgressLabel } from '../lib/taskProgress.js'",
      "import { quantitativeTaskError, taskCompletionBlocker, taskProgressLabel } from '../lib/taskProgress.js'\nimport SharedResponsibilityField, { SharedResponsibilityBadge } from './SharedResponsibilityField.jsx'\nimport { workResponsibilityFields } from '../lib/sharedResponsibility.js'",
      'task imports',
    ],
    [
      "status: 'Pendente', recorrencia: '', subtarefas: [], templateId: '', terceirizado: false, terceiroCnpj: '', terceiroNome: '', quantitativo: false, quantidadeTotal: 0, quantidadeConcluida: 0, unidade: 'itens',",
      "status: 'Pendente', recorrencia: '', subtarefas: [], templateId: '', terceirizado: false, terceiroCnpj: '', terceiroNome: '', quantitativo: false, quantidadeTotal: 0, quantidadeConcluida: 0, unidade: 'itens', compartilhadoResponsavel: '', compartilhadoParceiroId: '',",
      'task defaults',
    ],
    [
      "quantitativo: Boolean(editing.quantitativo), quantidadeTotal: editing.quantitativo ? Math.max(0, Number(editing.quantidadeTotal) || 0) : 0, quantidadeConcluida: editing.quantitativo ? Math.max(0, Number(editing.quantidadeConcluida) || 0) : 0, unidade: editing.quantitativo ? (editing.unidade.trim() || 'itens') : '',",
      "quantitativo: Boolean(editing.quantitativo), quantidadeTotal: editing.quantitativo ? Math.max(0, Number(editing.quantidadeTotal) || 0) : 0, quantidadeConcluida: editing.quantitativo ? Math.max(0, Number(editing.quantidadeConcluida) || 0) : 0, unidade: editing.quantitativo ? (editing.unidade.trim() || 'itens') : '',\n      ...workResponsibilityFields(editing, clientsById.get(String(editing.clientId)) || clientsById.get(editing.clientId), editing.departamento),",
      'task save responsibility',
    ],
    [
      "<Field label=\"Cliente\"><select value={editing.clientId} onChange={event => setField('clientId', event.target.value)}><option value=\"\">Tarefa interna</option>{clientChoices.map(client => <option value={client.id} key={client.id}>{clientName(client)}{client.status === 'Inativo' ? ' (inativo)' : client.relacionamento === 'Avulso' ? ' (avulso)' : ''}</option>)}</select></Field><Field label=\"Departamento\">",
      "<Field label=\"Cliente\"><select value={editing.clientId} onChange={event => setField('clientId', event.target.value)}><option value=\"\">Tarefa interna</option>{clientChoices.map(client => <option value={client.id} key={client.id}>{clientName(client)}{client.status === 'Inativo' ? ' (inativo)' : client.relacionamento === 'Avulso' ? ' (avulso)' : ''}</option>)}</select></Field><SharedResponsibilityField record={editing} setRecord={setEditing} client={clientsById.get(String(editing.clientId)) || clientsById.get(editing.clientId)} office={office} department={editing.departamento} /><Field label=\"Departamento\">",
      'task responsibility field',
    ],
    [
      "{task.quantitativo ? <small>Quantitativo · {taskProgressLabel(task)}</small> : null}{task.subtarefas?.length ?",
      "{task.quantitativo ? <small>Quantitativo · {taskProgressLabel(task)}</small> : null}<SharedResponsibilityBadge record={task} client={client} office={office} department={task.departamento} />{task.subtarefas?.length ?",
      'task responsibility badge',
    ],
  ])

  patchFile(`${root}src/components/ProcessesReact.jsx`, "SharedResponsibilityField record={draft}", [
    [
      "import { formatCnpj, thirdPartyError } from '../lib/thirdPartyWork.js'",
      "import { formatCnpj, thirdPartyError } from '../lib/thirdPartyWork.js'\nimport SharedResponsibilityField, { SharedResponsibilityBadge } from './SharedResponsibilityField.jsx'\nimport { workResponsibilityFields } from '../lib/sharedResponsibility.js'",
      'process imports',
    ],
    [
      "status: process?.status || 'Novo', drive: process?.drive || '', observacoes: process?.observacoes || '', terceirizado: Boolean(process?.terceirizado), terceiroCnpj: process?.terceiroCnpj || '', terceiroNome: process?.terceiroNome || '', etapas:",
      "status: process?.status || 'Novo', drive: process?.drive || '', observacoes: process?.observacoes || '', terceirizado: Boolean(process?.terceirizado), terceiroCnpj: process?.terceiroCnpj || '', terceiroNome: process?.terceiroNome || '', compartilhadoResponsavel: process?.compartilhadoResponsavel || '', compartilhadoParceiroId: process?.compartilhadoParceiroId || '', etapas:",
      'process defaults',
    ],
    [
      "onSave({ ...draft, tipo: type, origem: draft.origem.trim(), drive: draft.drive.trim(), observacoes: draft.observacoes.trim(), terceirizado: Boolean(draft.terceirizado), terceiroCnpj: draft.terceirizado ? formatCnpj(draft.terceiroCnpj) : '', terceiroNome: draft.terceirizado ? draft.terceiroNome.trim() : '', relacionados:",
      "onSave({ ...draft, ...workResponsibilityFields(draft, clients.find(client => String(client.id) === String(draft.clientId))), tipo: type, origem: draft.origem.trim(), drive: draft.drive.trim(), observacoes: draft.observacoes.trim(), terceirizado: Boolean(draft.terceirizado), terceiroCnpj: draft.terceirizado ? formatCnpj(draft.terceiroCnpj) : '', terceiroNome: draft.terceirizado ? draft.terceiroNome.trim() : '', relacionados:",
      'process save responsibility',
    ],
    [
      "<Field label=\"Cliente principal *\"><select value={draft.clientId} onChange={event => setDraft(current => ({ ...current, clientId: event.target.value, relacionados: current.relacionados.filter(id => id !== event.target.value) }))}><option value=\"\">Selecione</option>{clientChoices.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}{client.status === 'Inativo' ? ' (Inativo)' : client.relacionamento === 'Avulso' ? ' (Avulso)' : ''}</option>)}</select></Field><Field label=\"Modelo\">",
      "<Field label=\"Cliente principal *\"><select value={draft.clientId} onChange={event => setDraft(current => ({ ...current, clientId: event.target.value, relacionados: current.relacionados.filter(id => id !== event.target.value) }))}><option value=\"\">Selecione</option>{clientChoices.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}{client.status === 'Inativo' ? ' (Inativo)' : client.relacionamento === 'Avulso' ? ' (Avulso)' : ''}</option>)}</select></Field><SharedResponsibilityField record={draft} setRecord={setDraft} client={clients.find(client => String(client.id) === String(draft.clientId))} office={office} /><Field label=\"Modelo\">",
      'process responsibility field',
    ],
    [
      "<small>{clientName(clientsById.get(String(process.clientId)))} · {process.status || 'Novo'} · prazo {formatDate(process.prazoFinal)}{process.terceirizado ? ` · Terceirizado: ${process.terceiroNome || 'Sem nome'} · ${formatCnpj(process.terceiroCnpj)}` : ''}</small>",
      "<small>{clientName(clientsById.get(String(process.clientId)))} · {process.status || 'Novo'} · prazo {formatDate(process.prazoFinal)}{process.terceirizado ? ` · Terceirizado: ${process.terceiroNome || 'Sem nome'} · ${formatCnpj(process.terceiroCnpj)}` : ''}</small><SharedResponsibilityBadge record={process} client={clientsById.get(String(process.clientId))} office={office} />",
      'process responsibility badge',
    ],
  ])

  patchFile(`${root}src/components/ObligationsReact.jsx`, "partners={office.partners || []}", [
    [
      "import { formatCnpj, thirdPartyError } from '../lib/thirdPartyWork.js'",
      "import { formatCnpj, thirdPartyError } from '../lib/thirdPartyWork.js'\nimport { clientPartnerIds } from '../lib/sharedWork.js'\nimport { workResponsibilityFields } from '../lib/sharedResponsibility.js'",
      'obligation imports',
    ],
    [
      "const emptyLink = clientId => ({ clienteId: String(clientId), status: 'Pendente', vencimento: '', observacao: '', recibo: '', concluidoEm: '' })",
      "const emptyLink = clientId => ({ clienteId: String(clientId), status: 'Pendente', vencimento: '', observacao: '', recibo: '', concluidoEm: '', compartilhadoResponsavel: '', compartilhadoParceiroId: '' })",
      'obligation link defaults',
    ],
    [
      "function ClientDetailsModal({ obligation, clientsById, focusClientId, onClose, onSave }) {",
      "function ClientDetailsModal({ obligation, clientsById, partners, focusClientId, onClose, onSave }) {",
      'obligation details partners prop',
    ],
    [
      "    const client = clientsById.get(String(row.clienteId))\n    return <article",
      "    const client = clientsById.get(String(row.clienteId))\n    const sharedResponsibility = workResponsibilityFields(row, client, obligation.categoria)\n    const sharedPartnerIds = clientPartnerIds(client)\n    const sharedPartners = sharedPartnerIds.map(id => (partners || []).find(partner => String(partner.id) === id)).filter(Boolean)\n    return <article",
      'obligation client responsibility context',
    ],
    [
      "<Field label=\"Observação\"><input value={row.observacao || ''} onChange={event => changeRow(row.clienteId, { observacao: event.target.value })} placeholder=\"Observação opcional\" /></Field>",
      "<Field label=\"Observação\"><input value={row.observacao || ''} onChange={event => changeRow(row.clienteId, { observacao: event.target.value })} placeholder=\"Observação opcional\" /></Field>{client?.perfilAtendimento === 'Compartilhado' ? <><Field label=\"Responsabilidade\"><select value={sharedResponsibility.compartilhadoResponsavel || 'Escritorio'} onChange={event => { const responsavel = event.target.value; changeRow(row.clienteId, { compartilhadoResponsavel: responsavel, compartilhadoParceiroId: responsavel === 'Escritorio' ? '' : (sharedResponsibility.compartilhadoParceiroId || sharedPartnerIds[0] || '') }) }}><option value=\"Escritorio\">Meu escritório</option><option value=\"Parceiro\">Parceiro</option><option value=\"Ambos\">Ambos</option></select></Field>{sharedResponsibility.compartilhadoResponsavel !== 'Escritorio' ? <Field label=\"Parceiro\"><select value={sharedResponsibility.compartilhadoParceiroId || sharedPartnerIds[0] || ''} onChange={event => changeRow(row.clienteId, { compartilhadoParceiroId: event.target.value })}>{sharedPartners.map(partner => <option value={partner.id} key={partner.id}>{partner.nome || partner.razao || 'Parceiro'}{partner.status === 'Inativo' ? ' (inativo)' : ''}</option>)}</select></Field> : null}</> : null}",
      'obligation client responsibility fields',
    ],
    [
      "clientes: ids.map(clientId => structuredClone(previousLinks.get(clientId) || emptyLink(clientId))), observacoes: editing.observacoes.trim(),",
      "clientes: ids.map(clientId => { const client = clientsById.get(String(clientId)); const previousLink = previousLinks.get(clientId) || emptyLink(clientId); return { ...structuredClone(previousLink), ...workResponsibilityFields(previousLink, client, editing.categoria) } }), observacoes: editing.observacoes.trim(),",
      'obligation save responsibility defaults',
    ],
    [
      "clientesIds: ids, clientes: ids.map(emptyLink), observacoes: source.observacoes || '',",
      "clientesIds: ids, clientes: ids.map(clientId => { const client = clientsById.get(String(clientId)); const link = emptyLink(clientId); return { ...link, ...workResponsibilityFields(link, client, source.categoria) } }), observacoes: source.observacoes || '',",
      'obligation duplicate responsibility defaults',
    ],
    [
      "{details ? <ClientDetailsModal obligation={details.obligation} clientsById={clientsById} focusClientId={details.focusClientId}",
      "{details ? <ClientDetailsModal obligation={details.obligation} clientsById={clientsById} partners={office.partners || []} focusClientId={details.focusClientId}",
      'obligation details partners',
    ],
  ])
}
