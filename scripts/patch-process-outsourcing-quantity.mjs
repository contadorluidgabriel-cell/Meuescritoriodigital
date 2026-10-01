import { readFileSync, writeFileSync } from 'node:fs'

const marker = 'MED_PROCESS_OUTSOURCING_QUANTITY_V1'

function replaceRequired(source, before, after, label, path) {
  if (source.includes(after)) return source
  if (!source.includes(before)) throw new Error(`Process outsourcing patch: missing ${label} in ${path}`)
  return source.replace(before, after)
}

function patchModels(root) {
  const path = root + 'src/components/ModelsReact.jsx'
  let source = readFileSync(path, 'utf8')
  if (source.includes('MED_PROCESS_MODEL_QUANTITY_V1')) return

  source = replaceRequired(
    source,
    "const processEmpty = { id: '', nome: '', departamento: '', descricao: '', etapas: [] }",
    "const processEmpty = { id: '', nome: '', departamento: '', descricao: '', quantitativo: false, unidadeQuantidade: 'Pessoas', etapas: [] }",
    'process model defaults',
    path,
  )

  source = replaceRequired(
    source,
    "      descricao: String(processEditing.descricao || '').trim(),\n      etapas: steps,",
    "      descricao: String(processEditing.descricao || '').trim(),\n      quantitativo: Boolean(processEditing.quantitativo),\n      unidadeQuantidade: processEditing.quantitativo ? (String(processEditing.unidadeQuantidade || 'Pessoas').trim() || 'Pessoas') : '',\n      etapas: steps,",
    'process model quantity save',
    path,
  )

  source = replaceRequired(
    source,
    "<div className=\"model-meta\"><span>{model.departamento || 'Sem área'}</span></div><ol>",
    "<div className=\"model-meta\"><span>{model.departamento || 'Sem área'}</span>{model.quantitativo ? <span>Quantidade · {model.unidadeQuantidade || 'Pessoas'}</span> : null}</div><ol>",
    'process model quantity summary',
    path,
  )

  source = replaceRequired(
    source,
    "<Field label=\"Descrição\" full><textarea value={processEditing.descricao} onChange={event => setProcessEditing(current => ({ ...current, descricao: event.target.value }))} /></Field>\n      <div className=\"models-field full process-model-steps\">",
    "<Field label=\"Descrição\" full><textarea value={processEditing.descricao} onChange={event => setProcessEditing(current => ({ ...current, descricao: event.target.value }))} /></Field>\n      <Field label=\"Controle de quantidade\" full><div className=\"models-choice-list stacked\"><label><input type=\"checkbox\" checked={Boolean(processEditing.quantitativo)} onChange={event => setProcessEditing(current => ({ ...current, quantitativo: event.target.checked, unidadeQuantidade: event.target.checked ? (current.unidadeQuantidade || 'Pessoas') : current.unidadeQuantidade }))} /> Este modelo usa quantidade por empresa</label></div></Field>{processEditing.quantitativo ? <Field label=\"Unidade\"><input value={processEditing.unidadeQuantidade || 'Pessoas'} onChange={event => setProcessEditing(current => ({ ...current, unidadeQuantidade: event.target.value }))} placeholder=\"Pessoas\" /></Field> : null}\n      <div className=\"models-field full process-model-steps\">",
    'process model quantity fields',
    path,
  )

  source = '// MED_PROCESS_MODEL_QUANTITY_V1\n' + source
  writeFileSync(path, source)
}

function patchProcesses(root) {
  const path = root + 'src/components/ProcessesReact.jsx'
  let source = readFileSync(path, 'utf8')
  if (source.includes(marker)) return

  source = replaceRequired(
    source,
    "import { buildProcessFinanceCharges, normalizedProcessFinance, processFinanceError, processHasFinanceCharge } from '../lib/processFinance.js'",
    "import { buildProcessFinanceCharges, normalizedProcessFinance, processFinanceError, processHasFinanceCharge } from '../lib/processFinance.js'\nimport { normalizedOutsourcingBatch, outsourcingBatchError, outsourcingBatchSummary } from '../lib/processOutsourcing.js'",
    'process outsourcing import',
    path,
  )

  source = replaceRequired(
    source,
    "terceiroNome: process?.terceiroNome || '', compartilhadoResponsavel:",
    "terceiroNome: process?.terceiroNome || '', terceirizacaoLote: Boolean(process?.terceirizacaoLote), terceirizadorClientId: process?.terceirizadorClientId || '', empresasTerceirizadas: Array.isArray(process?.empresasTerceirizadas) ? process.empresasTerceirizadas : [], quantitativo: Boolean(process?.quantitativo), unidadeQuantidade: process?.unidadeQuantidade || 'Pessoas', compartilhadoResponsavel:",
    'process outsourcing defaults',
    path,
  )

  source = replaceRequired(
    source,
    "  const clientChoices = useMemo(() => clients.filter(client => String(client.id) === draft.clientId || (client.status !== 'Inativo' && (includeAvulsos || client.relacionamento !== 'Avulso'))), [clients, draft.clientId, includeAvulsos])",
    "  const clientChoices = useMemo(() => clients.filter(client => { if (String(client.id) === String(draft.clientId)) return true; if (client.status === 'Inativo') return false; if (draft.terceirizacaoLote) return client.perfilAtendimento === 'Terceirizador'; return includeAvulsos || client.relacionamento !== 'Avulso' }), [clients, draft.clientId, draft.terceirizacaoLote, includeAvulsos])\n  const outsourcingCompanyChoices = useMemo(() => (office.linkedCompanies || []).filter(company => company.status !== 'Inativo' && String(company.clientId) === String(draft.clientId)).sort((a, b) => String(a.razao || '').localeCompare(String(b.razao || ''), 'pt-BR')), [office.linkedCompanies, draft.clientId])",
    'process outsourcing client choices',
    path,
  )

  source = replaceRequired(
    source,
    "etapas: orderedSteps(model.etapas).map(step => ({ ...step, id: uid('et'), status: 'Pendente', ativa: true, included: !step.opcional, responsavelTipo: step.responsavelTipo || 'interno', prazoDias: Math.max(0, Number(step.prazoDias) || 0), followupDias: Math.max(1, Number(step.followupDias) || 3), prazoEtapa: '', proximaRevisao: '', aguardandoDesde: '', concluidoEm: '' }))",
    "quantitativo: Boolean(model.quantitativo), unidadeQuantidade: model.quantitativo ? (model.unidadeQuantidade || 'Pessoas') : '', etapas: orderedSteps(model.etapas).map(step => ({ ...step, id: uid('et'), status: 'Pendente', ativa: true, included: !step.opcional, responsavelTipo: step.responsavelTipo || 'interno', prazoDias: Math.max(0, Number(step.prazoDias) || 0), followupDias: Math.max(1, Number(step.followupDias) || 3), prazoEtapa: '', proximaRevisao: '', aguardandoDesde: '', concluidoEm: '' }))",
    'apply process model quantity',
    path,
  )

  source = replaceRequired(
    source,
    "    const outsourcingError = thirdPartyError(draft)\n    if (outsourcingError) { setError(outsourcingError); return }",
    "    const batchError = outsourcingBatchError(draft, office)\n    if (batchError) { setError(batchError); return }\n    const outsourcingError = draft.terceirizacaoLote ? '' : thirdPartyError(draft)\n    if (outsourcingError) { setError(outsourcingError); return }",
    'process outsourcing validation',
    path,
  )

  source = replaceRequired(
    source,
    "terceirizado: Boolean(draft.terceirizado), terceiroCnpj: draft.terceirizado ? formatCnpj(draft.terceiroCnpj) : '', terceiroNome: draft.terceirizado ? draft.terceiroNome.trim() : '', cobrancaGeradaEm:",
    "...normalizedOutsourcingBatch(draft), terceirizado: !draft.terceirizacaoLote && Boolean(draft.terceirizado), terceiroCnpj: !draft.terceirizacaoLote && draft.terceirizado ? formatCnpj(draft.terceiroCnpj) : '', terceiroNome: !draft.terceirizacaoLote && draft.terceirizado ? draft.terceiroNome.trim() : '', cobrancaGeradaEm:",
    'process outsourcing save',
    path,
  )

  const oldSelector = "<Field label=\"Clientes avulsos\" full><div className=\"third-party-toggle\"><label><input type=\"checkbox\" checked={includeAvulsos} onChange={event => setIncludeAvulsos(event.target.checked)} /> Mostrar clientes avulsos</label></div></Field><Field label=\"Cliente principal *\"><select value={draft.clientId} onChange={event => setDraft(current => ({ ...current, clientId: event.target.value, relacionados: current.relacionados.filter(id => id !== event.target.value) }))}><option value=\"\">Selecione</option>{clientChoices.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}{client.status === 'Inativo' ? ' (Inativo)' : client.relacionamento === 'Avulso' ? ' (Avulso)' : ''}</option>)}</select></Field><SharedResponsibilityField record={draft} setRecord={setDraft} client={clients.find(client => String(client.id) === String(draft.clientId))} office={office} /><Field label=\"Modelo\">"
  const newSelector = "<Field label=\"Tipo de cliente\"><select value={draft.terceirizacaoLote ? 'Terceirizado' : 'Direto'} onChange={event => setDraft(current => ({ ...current, terceirizacaoLote: event.target.value === 'Terceirizado', clientId: '', terceirizadorClientId: '', empresasTerceirizadas: [], terceirizado: event.target.value === 'Terceirizado' ? false : current.terceirizado, terceiroCnpj: event.target.value === 'Terceirizado' ? '' : current.terceiroCnpj, terceiroNome: event.target.value === 'Terceirizado' ? '' : current.terceiroNome }))}><option value=\"Direto\">Cliente direto</option><option value=\"Terceirizado\">Cliente terceirizado</option></select></Field>{!draft.terceirizacaoLote ? <Field label=\"Clientes avulsos\" full><div className=\"third-party-toggle\"><label><input type=\"checkbox\" checked={includeAvulsos} onChange={event => setIncludeAvulsos(event.target.checked)} /> Mostrar clientes avulsos</label></div></Field> : null}<Field label={draft.terceirizacaoLote ? 'Cliente terceirizador *' : 'Cliente principal *'}><select value={draft.clientId} onChange={event => setDraft(current => ({ ...current, clientId: event.target.value, terceirizadorClientId: current.terceirizacaoLote ? event.target.value : '', empresasTerceirizadas: current.terceirizacaoLote ? [] : current.empresasTerceirizadas, relacionados: current.relacionados.filter(id => id !== event.target.value) }))}><option value=\"\">Selecione</option>{clientChoices.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}{client.status === 'Inativo' ? ' (Inativo)' : client.relacionamento === 'Avulso' ? ' (Avulso)' : ''}</option>)}</select></Field>{!draft.terceirizacaoLote ? <SharedResponsibilityField record={draft} setRecord={setDraft} client={clients.find(client => String(client.id) === String(draft.clientId))} office={office} /> : null}{draft.terceirizacaoLote ? <Field label=\"Empresas terceirizadas\" full hint=\"Marque as empresas deste terceirizador que fazem parte do processo.\"><div className=\"process-outsourcing-picker\">{outsourcingCompanyChoices.map(company => { const selected = (draft.empresasTerceirizadas || []).find(item => String(item.companyId) === String(company.id)); return <article className={selected ? 'selected' : ''} key={company.id}><label className=\"process-outsourcing-company\"><input type=\"checkbox\" checked={Boolean(selected)} onChange={event => setDraft(current => ({ ...current, empresasTerceirizadas: event.target.checked ? [...(current.empresasTerceirizadas || []), { companyId: String(company.id), quantidadePessoas: 0, fechado: false }] : (current.empresasTerceirizadas || []).filter(item => String(item.companyId) !== String(company.id)) }))} /><span><b>{company.razao || 'Empresa terceirizada'}</b><small>{formatCnpj(company.cnpj)}</small></span></label>{selected ? <div className=\"process-outsourcing-controls\">{draft.quantitativo ? <label><span>{draft.unidadeQuantidade || 'Pessoas'}</span><input type=\"number\" min=\"1\" step=\"1\" value={selected.quantidadePessoas || ''} onChange={event => setDraft(current => ({ ...current, empresasTerceirizadas: (current.empresasTerceirizadas || []).map(item => String(item.companyId) === String(company.id) ? { ...item, quantidadePessoas: event.target.value } : item) }))} /></label> : null}<label className=\"process-outsourcing-close\"><input type=\"checkbox\" checked={Boolean(selected.fechado)} onChange={event => setDraft(current => ({ ...current, empresasTerceirizadas: (current.empresasTerceirizadas || []).map(item => String(item.companyId) === String(company.id) ? { ...item, fechado: event.target.checked } : item) }))} /> Fechamento</label></div> : null}</article> })}{!draft.clientId ? <p>Selecione primeiro o cliente terceirizador.</p> : !outsourcingCompanyChoices.length ? <p>Nenhuma empresa terceirizada vinculada a este cliente.</p> : null}</div></Field> : null}<Field label=\"Modelo\">"
  source = replaceRequired(source, oldSelector, newSelector, 'process outsourcing selector', path)

  const oldThirdParty = "<Field label=\"Terceirização\" full><div className=\"third-party-toggle\"><label><input type=\"checkbox\" checked={Boolean(draft.terceirizado)} onChange={event => setDraft(current => ({ ...current, terceirizado: event.target.checked, terceiroCnpj: event.target.checked ? current.terceiroCnpj : '', terceiroNome: event.target.checked ? current.terceiroNome : '' }))} /> Processo ligado a um CNPJ que não é cliente do escritório</label></div></Field>{draft.terceirizado ? <><Field label=\"CNPJ terceirizado *\"><input inputMode=\"numeric\" maxLength={18} value={formatCnpj(draft.terceiroCnpj)} onChange={event => setField('terceiroCnpj', formatCnpj(event.target.value))} placeholder=\"00.000.000/0000-00\" /></Field><Field label=\"Nome / Razão Social *\"><input value={draft.terceiroNome} onChange={event => setField('terceiroNome', event.target.value)} /></Field></> : null}"
  const newThirdParty = "{!draft.terceirizacaoLote ? <><Field label=\"Terceirização avulsa\" full><div className=\"third-party-toggle\"><label><input type=\"checkbox\" checked={Boolean(draft.terceirizado)} onChange={event => setDraft(current => ({ ...current, terceirizado: event.target.checked, terceiroCnpj: event.target.checked ? current.terceiroCnpj : '', terceiroNome: event.target.checked ? current.terceiroNome : '' }))} /> Processo ligado a um CNPJ que não está cadastrado entre as empresas terceirizadas</label></div></Field>{draft.terceirizado ? <><Field label=\"CNPJ terceirizado *\"><input inputMode=\"numeric\" maxLength={18} value={formatCnpj(draft.terceiroCnpj)} onChange={event => setField('terceiroCnpj', formatCnpj(event.target.value))} placeholder=\"00.000.000/0000-00\" /></Field><Field label=\"Nome / Razão Social *\"><input value={draft.terceiroNome} onChange={event => setField('terceiroNome', event.target.value)} /></Field></> : null}</> : null}"
  source = replaceRequired(source, oldThirdParty, newThirdParty, 'legacy third party conditional', path)

  source = replaceRequired(
    source,
    "<small className={`process-action-summary level-${planning.level}`}>{planning.actionLabel}{process.previsaoConclusao ? ` · conclusão interna ${formatDate(process.previsaoConclusao)}` : ''}</small><SharedResponsibilityBadge",
    "<small className={`process-action-summary level-${planning.level}`}>{planning.actionLabel}{process.previsaoConclusao ? ` · conclusão interna ${formatDate(process.previsaoConclusao)}` : ''}</small>{process.terceirizacaoLote ? <small className=\"process-outsourcing-summary\">{(() => { const summary = outsourcingBatchSummary(process); return `Terceirização · ${summary.empresas} empresa(s) · ${summary.totalPessoas} pessoa(s) · ${summary.fechadas}/${summary.empresas} fechamento(s)` })()}</small> : null}<SharedResponsibilityBadge",
    'process outsourcing list summary',
    path,
  )

  source = replaceRequired(
    source,
    "{process.terceirizado ? <span>Terceirizado: {process.terceiroNome || 'Sem nome'} · {formatCnpj(process.terceiroCnpj)}</span> : null}{process.cobradoAParte ?",
    "{process.terceirizado ? <span>Terceirizado: {process.terceiroNome || 'Sem nome'} · {formatCnpj(process.terceiroCnpj)}</span> : null}{process.terceirizacaoLote ? <span>{(() => { const summary = outsourcingBatchSummary(process); return `Terceirização: ${summary.empresas} empresa(s) · ${summary.totalPessoas} pessoa(s) · ${summary.fechadas} fechamento(s)` })()}</span> : null}{process.cobradoAParte ?",
    'process outsourcing details summary',
    path,
  )

  source = '// ' + marker + '\n' + source
  writeFileSync(path, source)
}

function patchMainCss(root) {
  const path = root + 'src/main.jsx'
  let source = readFileSync(path, 'utf8')
  if (source.includes("./process-outsourcing.css")) return
  source = replaceRequired(
    source,
    "import './processes-react.css'",
    "import './processes-react.css'\nimport './process-outsourcing.css'",
    'process outsourcing css import',
    path,
  )
  writeFileSync(path, source)
}

export function applyProcessOutsourcingQuantityPatch(root) {
  patchModels(root)
  patchProcesses(root)
  patchMainCss(root)
}
