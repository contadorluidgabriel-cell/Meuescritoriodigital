import { readFileSync, writeFileSync } from 'node:fs'

function patchFile(path, marker, replacements) {
  let source = readFileSync(path, 'utf8')
  if (source.includes(marker)) return
  for (const [from, to, label] of replacements) {
    if (!source.includes(from)) throw new Error(`Quantitative/avulso patch failed (${label}) in ${path}`)
    source = source.replace(from, to)
  }
  writeFileSync(path, source)
}

export function applyQuantitativeAndAvulsoPatches(root) {
  patchFile(`${root}src/components/TasksReactBase.jsx`, "taskProgressLabel(task)", [
    [
      "import { formatCnpj, thirdPartyError } from '../lib/thirdPartyWork.js'",
      "import { formatCnpj, thirdPartyError } from '../lib/thirdPartyWork.js'\nimport { quantitativeTaskError, taskCompletionBlocker, taskProgressLabel } from '../lib/taskProgress.js'",
      'task progress import',
    ],
    [
      "status: 'Pendente', recorrencia: '', subtarefas: [], templateId: '', terceirizado: false, terceiroCnpj: '', terceiroNome: '',",
      "status: 'Pendente', recorrencia: '', subtarefas: [], templateId: '', terceirizado: false, terceiroCnpj: '', terceiroNome: '', quantitativo: false, quantidadeTotal: 0, quantidadeConcluida: 0, unidade: 'itens',",
      'task quantitative defaults',
    ],
    [
      "  const [selected, setSelected] = useState(new Set())",
      "  const [selected, setSelected] = useState(new Set())\n  const [includeAvulsos, setIncludeAvulsos] = useState(false)",
      'task avulso state',
    ],
    [
      "  const activeClients = useMemo(() => (office.clients || []).filter(client => client.status !== 'Inativo'), [office.clients])\n  const clientChoices = useMemo(() => {\n    const current = editing?.clientId ? clientsById.get(editing.clientId) : null\n    return current && current.status === 'Inativo' ? [...activeClients, current] : activeClients\n  }, [activeClients, clientsById, editing?.clientId])",
      "  const activeClients = useMemo(() => (office.clients || []).filter(client => client.status !== 'Inativo' && (includeAvulsos || client.relacionamento !== 'Avulso')), [includeAvulsos, office.clients])\n  const clientChoices = useMemo(() => {\n    const current = editing?.clientId ? clientsById.get(editing.clientId) : null\n    return current && !activeClients.some(client => String(client.id) === String(current.id)) ? [...activeClients, current] : activeClients\n  }, [activeClients, clientsById, editing?.clientId])",
      'task recurring client choices',
    ],
    [
      "    const outsourcingError = thirdPartyError(editing)\n    if (outsourcingError) { setError(outsourcingError); return }",
      "    const outsourcingError = thirdPartyError(editing)\n    if (outsourcingError) { setError(outsourcingError); return }\n    const quantityError = quantitativeTaskError(editing)\n    if (quantityError) { setError(quantityError); return }\n    if (isDone(editing.status)) { const blocker = taskCompletionBlocker(editing); if (blocker) { setError(blocker); return } }",
      'task quantitative validation',
    ],
    [
      "      terceirizado: Boolean(editing.terceirizado), terceiroCnpj: editing.terceirizado ? formatCnpj(editing.terceiroCnpj) : '', terceiroNome: editing.terceirizado ? editing.terceiroNome.trim() : '',",
      "      terceirizado: Boolean(editing.terceirizado), terceiroCnpj: editing.terceirizado ? formatCnpj(editing.terceiroCnpj) : '', terceiroNome: editing.terceirizado ? editing.terceiroNome.trim() : '',\n      quantitativo: Boolean(editing.quantitativo), quantidadeTotal: editing.quantitativo ? Math.max(0, Number(editing.quantidadeTotal) || 0) : 0, quantidadeConcluida: editing.quantitativo ? Math.max(0, Number(editing.quantidadeConcluida) || 0) : 0, unidade: editing.quantitativo ? (editing.unidade.trim() || 'itens') : '',",
      'task quantitative save',
    ],
    [
      "    const wasDone = isDone(current.status)\n    const changed = { ...current, status: wasDone ? 'Pendente' : 'Concluída', updatedAt: new Date().toISOString() }",
      "    const wasDone = isDone(current.status)\n    if (!wasDone) { const blocker = taskCompletionBlocker(current); if (blocker) { setNotice(blocker); return } }\n    const changed = { ...current, status: wasDone ? 'Pendente' : 'Concluída', updatedAt: new Date().toISOString() }",
      'single task completion guard',
    ],
    [
      "  function completeSelected() {\n    let nextTasks = structuredClone(office.tasks), changed = 0\n    ;[...selected].forEach(id => {\n      const index = nextTasks.findIndex(item => item.id === id)\n      if (index < 0 || isDone(nextTasks[index].status)) return\n      nextTasks[index] = { ...nextTasks[index], status: 'Concluída', updatedAt: new Date().toISOString() }\n      nextTasks = appendNextRecurringTask(nextTasks, nextTasks[index], office.clients)\n      changed += 1\n    })\n    if (changed) commitTasks(nextTasks)\n    setSelected(new Set())\n    setNotice(changed ? `${changed} tarefa(s) concluída(s).` : 'Nenhuma tarefa pendente selecionada.')\n  }",
      "  function completeSelected() {\n    let nextTasks = structuredClone(office.tasks), changed = 0, blocked = 0\n    ;[...selected].forEach(id => {\n      const index = nextTasks.findIndex(item => item.id === id)\n      if (index < 0 || isDone(nextTasks[index].status)) return\n      if (taskCompletionBlocker(nextTasks[index])) { blocked += 1; return }\n      nextTasks[index] = { ...nextTasks[index], status: 'Concluída', updatedAt: new Date().toISOString() }\n      nextTasks = appendNextRecurringTask(nextTasks, nextTasks[index], office.clients)\n      changed += 1\n    })\n    if (changed) commitTasks(nextTasks)\n    setSelected(new Set())\n    setNotice(blocked ? `${changed} concluída(s). ${blocked} bloqueada(s) por subtarefas ou meta pendente.` : changed ? `${changed} tarefa(s) concluída(s).` : 'Nenhuma tarefa pendente selecionada.')\n  }",
      'bulk task completion guard',
    ],
    [
      "{task.terceirizado ? <small>Terceirizado · {task.terceiroNome || 'Sem nome'} · {formatCnpj(task.terceiroCnpj)}</small> : null}{task.recorrencia ? <small>Recorrente · {recurrenceLabel(task.recorrencia)}</small> : null}{task.subtarefas?.length ?",
      "{task.terceirizado ? <small>Terceirizado · {task.terceiroNome || 'Sem nome'} · {formatCnpj(task.terceiroCnpj)}</small> : null}{task.recorrencia ? <small>Recorrente · {recurrenceLabel(task.recorrencia)}</small> : null}{task.quantitativo ? <small>Quantitativo · {taskProgressLabel(task)}</small> : null}{task.subtarefas?.length ?",
      'task quantitative list progress',
    ],
    [
      "<Field label=\"Título *\" full><input value={editing.titulo} onChange={event => setField('titulo', event.target.value)} /></Field><Field label=\"Cliente\"><select value={editing.clientId} onChange={event => setField('clientId', event.target.value)}><option value=\"\">Tarefa interna</option>{clientChoices.map(client => <option value={client.id} key={client.id}>{clientName(client)}{client.status === 'Inativo' ? ' (inativo)' : ''}</option>)}</select></Field><Field label=\"Departamento\">",
      "<Field label=\"Título *\" full><input value={editing.titulo} onChange={event => setField('titulo', event.target.value)} /></Field><Field label=\"Cliente\"><select value={editing.clientId} onChange={event => setField('clientId', event.target.value)}><option value=\"\">Tarefa interna</option>{clientChoices.map(client => <option value={client.id} key={client.id}>{clientName(client)}{client.status === 'Inativo' ? ' (inativo)' : client.relacionamento === 'Avulso' ? ' (avulso)' : ''}</option>)}</select></Field><Field label=\"Clientes avulsos\" full><div className=\"third-party-toggle\"><label><input type=\"checkbox\" checked={includeAvulsos} onChange={event => setIncludeAvulsos(event.target.checked)} /> Incluir clientes avulsos nesta lista</label></div></Field><Field label=\"Departamento\">",
      'task avulso selector toggle',
    ],
    [
      "<Field label=\"Recorrência\"><select value={editing.recorrencia} onChange={event => setField('recorrencia', event.target.value)}>{recurrenceOptions.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></Field>\n      <Field label=\"Descrição\" full>",
      "<Field label=\"Recorrência\"><select value={editing.recorrencia} onChange={event => setField('recorrencia', event.target.value)}>{recurrenceOptions.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></Field>\n      <Field label=\"Controle quantitativo\" full><div className=\"third-party-toggle\"><label><input type=\"checkbox\" checked={Boolean(editing.quantitativo)} onChange={event => setField('quantitativo', event.target.checked)} /> Acompanhar esta tarefa por quantidade</label></div></Field>{editing.quantitativo ? <><Field label=\"Unidade\"><input value={editing.unidade || ''} onChange={event => setField('unidade', event.target.value)} placeholder=\"Ex.: lançamentos\" /></Field><Field label=\"Meta total *\"><input type=\"number\" min=\"1\" step=\"1\" value={editing.quantidadeTotal ?? 0} onChange={event => setField('quantidadeTotal', event.target.value)} /></Field><Field label=\"Já concluído\"><input type=\"number\" min=\"0\" step=\"1\" max={Math.max(0, Number(editing.quantidadeTotal) || 0)} value={editing.quantidadeConcluida ?? 0} onChange={event => setField('quantidadeConcluida', event.target.value)} /></Field></> : null}\n      <Field label=\"Descrição\" full>",
      'task quantitative form',
    ],
  ])

  patchFile(`${root}src/components/ProcessesReact.jsx`, "Incluir clientes avulsos neste processo", [
    [
      "  const [clientQuery, setClientQuery] = useState(''), [error, setError] = useState('')",
      "  const [clientQuery, setClientQuery] = useState(''), [error, setError] = useState('')\n  const [includeAvulsos, setIncludeAvulsos] = useState(false)",
      'process avulso state',
    ],
    [
      "  const clientChoices = useMemo(() => clients.filter(client => client.status !== 'Inativo' || String(client.id) === draft.clientId), [clients, draft.clientId])\n  const relatedChoices = useMemo(() => clients.filter(client => (client.status !== 'Inativo' || selectedRelated.has(String(client.id))) && String(client.id) !== draft.clientId && (!clientQuery || normalize(`${clientName(client)} ${client.documento}`).includes(normalize(clientQuery)))), [clientQuery, clients, draft.clientId, selectedRelated])",
      "  const clientChoices = useMemo(() => clients.filter(client => String(client.id) === draft.clientId || (client.status !== 'Inativo' && (includeAvulsos || client.relacionamento !== 'Avulso'))), [clients, draft.clientId, includeAvulsos])\n  const relatedChoices = useMemo(() => clients.filter(client => (selectedRelated.has(String(client.id)) || (client.status !== 'Inativo' && (includeAvulsos || client.relacionamento !== 'Avulso'))) && String(client.id) !== draft.clientId && (!clientQuery || normalize(`${clientName(client)} ${client.documento}`).includes(normalize(clientQuery)))), [clientQuery, clients, draft.clientId, includeAvulsos, selectedRelated])",
      'process recurring client choices',
    ],
    [
      "<Field label=\"Cliente principal *\"><select value={draft.clientId} onChange={event => setDraft(current => ({ ...current, clientId: event.target.value, relacionados: current.relacionados.filter(id => id !== event.target.value) }))}><option value=\"\">Selecione</option>{clientChoices.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}{client.status === 'Inativo' ? ' (Inativo)' : ''}</option>)}</select></Field><Field label=\"Modelo\">",
      "<Field label=\"Cliente principal *\"><select value={draft.clientId} onChange={event => setDraft(current => ({ ...current, clientId: event.target.value, relacionados: current.relacionados.filter(id => id !== event.target.value) }))}><option value=\"\">Selecione</option>{clientChoices.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}{client.status === 'Inativo' ? ' (Inativo)' : client.relacionamento === 'Avulso' ? ' (Avulso)' : ''}</option>)}</select></Field><Field label=\"Clientes avulsos\" full><div className=\"third-party-toggle\"><label><input type=\"checkbox\" checked={includeAvulsos} onChange={event => setIncludeAvulsos(event.target.checked)} /> Incluir clientes avulsos neste processo</label></div></Field><Field label=\"Modelo\">",
      'process avulso toggle',
    ],
  ])

  patchFile(`${root}src/components/ObligationsReact.jsx`, "Incluir clientes avulsos nesta obrigação", [
    [
      "  const [editing, setEditing] = useState(null), [selectedClients, setSelectedClients] = useState(new Set()), [clientQuery, setClientQuery] = useState('')",
      "  const [editing, setEditing] = useState(null), [selectedClients, setSelectedClients] = useState(new Set()), [clientQuery, setClientQuery] = useState('')\n  const [includeAvulsos, setIncludeAvulsos] = useState(false)",
      'obligation avulso state',
    ],
    [
      "    const allowed = client.status !== 'Inativo' || selected\n    return allowed && (!clientQuery || normalize(`${clientName(client)} ${client.documento}`).includes(normalize(clientQuery)))\n  }), [clientQuery, office.clients, selectedClients])",
      "    const allowed = client.status !== 'Inativo' || selected\n    const relationshipAllowed = selected || includeAvulsos || client.relacionamento !== 'Avulso'\n    return allowed && relationshipAllowed && (!clientQuery || normalize(`${clientName(client)} ${client.documento}`).includes(normalize(clientQuery)))\n  }), [clientQuery, includeAvulsos, office.clients, selectedClients])",
      'obligation recurring client choices',
    ],
    [
      "    setSelectedClients(new Set())\n    setClientQuery('')",
      "    setSelectedClients(new Set())\n    setClientQuery('')\n    setIncludeAvulsos(false)",
      'obligation reset avulso state',
    ],
    [
      "<div className=\"obligation-picker-tools\"><input value={clientQuery} onChange={event => setClientQuery(event.target.value)} placeholder=\"Buscar cliente\" /><button type=\"button\" onClick={toggleVisibleClients}>{visiblePickerSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'}</button></div>",
      "<div className=\"obligation-picker-tools\"><input value={clientQuery} onChange={event => setClientQuery(event.target.value)} placeholder=\"Buscar cliente\" /><button type=\"button\" onClick={toggleVisibleClients}>{visiblePickerSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'}</button><label className=\"third-party-toggle\"><input type=\"checkbox\" checked={includeAvulsos} onChange={event => setIncludeAvulsos(event.target.checked)} /> Incluir clientes avulsos nesta obrigação</label></div>",
      'obligation avulso toggle',
    ],
    [
      "{clientName(client)}</b>{client.status === 'Inativo' ? <em>Inativo</em> : null}<small>{client.documento || 'Sem documento'}</small>",
      "{clientName(client)}</b>{client.status === 'Inativo' ? <em>Inativo</em> : client.relacionamento === 'Avulso' ? <em>Avulso</em> : null}<small>{client.documento || 'Sem documento'}</small>",
      'obligation avulso badge',
    ],
  ])
}
