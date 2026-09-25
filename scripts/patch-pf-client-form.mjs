import { readFileSync, writeFileSync } from 'node:fs'

const marker = 'MED_PF_CLIENT_FORM_V1'

function replaceRequired(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source
  if (!source.includes(oldValue)) throw new Error('PF client form patch: missing ' + label)
  return source.replace(oldValue, newValue)
}

export function applyPfClientFormPatch(root) {
  const componentPath = root + 'src/components/ClientsReact.jsx'
  let source = readFileSync(componentPath, 'utf8')
  if (!source.includes(marker)) {
    source = replaceRequired(
      source,
      "import { today, uid } from '../lib/storage.js'",
      "import { today, uid } from '../lib/storage.js'\nimport { clientServiceKey, createInitialClientServices } from '../lib/clientServices.js'",
      'service helper import',
    )

    source = replaceRequired(
      source,
      "telefone: '', whatsapp: '', email: '', endereco: '', relacionamento:",
      "telefone: '', whatsapp: '', email: '', dataNascimento: '', endereco: '', relacionamento:",
      'birth date default',
    )

    source = replaceRequired(
      source,
      "  const [selectedTemplates, setSelectedTemplates] = useState(new Set())",
      "  const [selectedTemplates, setSelectedTemplates] = useState(new Set())\n  const [selectedServiceModels, setSelectedServiceModels] = useState(new Set())",
      'service selection state',
    )

    source = replaceRequired(
      source,
      "  const matchingTemplates = useMemo(() => !editing?.id ? (office.taskTemplates || []).filter(model => (!model.departamento || editing?.departamentos?.includes(model.departamento)) && (!(model.regimes || []).length || model.regimes.includes(editing?.tributacao))) : [], [editing, office.taskTemplates])",
      "  const matchingTemplates = useMemo(() => !editing?.id ? (office.taskTemplates || []).filter(model => (!model.departamento || editing?.departamentos?.includes(model.departamento)) && (!(model.regimes || []).length || model.regimes.includes(editing?.tributacao))) : [], [editing, office.taskTemplates])\n  const serviceModels = useMemo(() => [\n    ...(office.processModels || []).map(model => ({ key: clientServiceKey('process', model.id), type: 'process', title: model.nome || 'Processo', detail: \`${(model.etapas || []).length} etapa(s)\` })),\n    ...(office.taskTemplates || []).map(model => ({ key: clientServiceKey('task', model.id), type: 'task', title: model.titulo || 'Tarefa', detail: model.departamento || 'Sem departamento' })),\n  ], [office.processModels, office.taskTemplates])",
      'service models',
    )

    source = replaceRequired(
      source,
      "  function openNew() { setEditing({ ...emptyClient, departamentos: [], dataEntrada: today() }); setSelectedTemplates(new Set()); setError('') }",
      "  function openNew() { const person = clientView === 'person'; const oneoff = clientView === 'oneoff'; setEditing({ ...emptyClient, tipo: person ? 'PF' : 'PJ', relacionamento: person || oneoff ? 'Avulso' : 'Recorrente', departamentos: [], dataEntrada: today() }); setSelectedTemplates(new Set()); setSelectedServiceModels(new Set()); setError('') }",
      'new client defaults by view',
    )

    source = replaceRequired(
      source,
      "  function openEdit(client) { setEditing({ ...emptyClient, ...structuredClone(client), documento: formatDocument(client.documento, client.tipo), departamentos: [...(client.departamentos || [])], comunicacoes: [...(client.comunicacoes || [])] }); setSelectedTemplates(new Set()); setError('') }",
      "  function openEdit(client) { setEditing({ ...emptyClient, ...structuredClone(client), documento: formatDocument(client.documento, client.tipo), departamentos: [...(client.departamentos || [])], comunicacoes: [...(client.comunicacoes || [])] }); setSelectedTemplates(new Set()); setSelectedServiceModels(new Set()); setError('') }",
      'edit client selection reset',
    )

    source = replaceRequired(
      source,
      "  function setClientType(type) { setEditing(current => ({ ...current, tipo: type, documento: formatDocument(current.documento, type) })) }",
      "  function setClientType(type) { setEditing(current => ({ ...current, tipo: type, documento: formatDocument(current.documento, type), relacionamento: type === 'PF' ? 'Avulso' : (current.tipo === 'PF' ? 'Recorrente' : current.relacionamento) })); if (type === 'PF') setSelectedTemplates(new Set()); else setSelectedServiceModels(new Set()) }",
      'client type behavior',
    )

    source = replaceRequired(
      source,
      "  function toggleTemplate(id) { setSelectedTemplates(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next }) }",
      "  function toggleTemplate(id) { setSelectedTemplates(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next }) }\n  function toggleServiceModel(key) { setSelectedServiceModels(current => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next }) }",
      'service toggle',
    )

    source = replaceRequired(
      source,
      "    const isNew = !editing.id",
      "    const isNew = !editing.id\n    const shouldCreateServices = isNew && editing.tipo === 'PF' && selectedServiceModels.size > 0 && event.nativeEvent?.submitter?.value === 'save-create-services'",
      'explicit service creation intent',
    )

    source = replaceRequired(
      source,
      "    update(draft => {",
      "    if (client.tipo === 'PF') Object.assign(client, { fantasia: '', tributacao: '', atividade: '', departamentos: [], relacionamento: 'Avulso', mensalidade: 0, vencimento: null, perfilAtendimento: 'Direto', parceiroIds: [], parceiroId: '', responsabilidadesCompartilhadas: {}, compartilhadoRecebedor: 'Escritorio', compartilhadoMinhaParte: 0, compartilhadoPartesParceiros: [], compartilhadoParceiroParte: 0 })\n    update(draft => {",
      'PF normalization',
    )

    source = replaceRequired(
      source,
      "      if (isNew && selectedTemplates.size) {",
      "      if (isNew && client.tipo === 'PJ' && selectedTemplates.size) {",
      'PJ initial task behavior',
    )

    source = replaceRequired(
      source,
      "        draft.tasks = [...draft.tasks, ...createdTasks]\n      }\n    })",
      "        draft.tasks = [...draft.tasks, ...createdTasks]\n      }\n      if (shouldCreateServices) {\n        const created = createInitialClientServices({ client, selectedKeys: [...selectedServiceModels], taskTemplates: draft.taskTemplates || [], processModels: draft.processModels || [], baseDate: client.dataEntrada || today() })\n        draft.tasks = [...(draft.tasks || []), ...created.tasks]\n        draft.processes = [...(draft.processes || []), ...created.processes]\n      }\n    })",
      'manual service creation',
    )

    source = replaceRequired(
      source,
      "    setEditing(null)\n    setClientView(clientViewOf(client))",
      "    setEditing(null)\n    setSelectedServiceModels(new Set())\n    setClientView(clientViewOf(client))",
      'service selection cleanup',
    )

    source = replaceRequired(
      source,
      '<form className="client-form" onSubmit={saveClient}>',
      '<form className={\`client-form ${editing.tipo === \'PF\' ? \'client-form-person\' : \'client-form-company\'}\`} onSubmit={saveClient}>',
      'dynamic form class',
    )

    source = replaceRequired(
      source,
      '<Field label="Tipo"><select value={editing.tipo} onChange={event => setClientType(event.target.value)}><option>PJ</option><option>PF</option></select></Field><Field label="CPF/CNPJ *"><input inputMode="numeric" maxLength={editing.tipo === \'PF\' ? 14 : 18} value={formatDocument(editing.documento, editing.tipo)} onChange={event => setField(\'documento\', formatDocument(event.target.value, editing.tipo))} placeholder={editing.tipo === \'PF\' ? \'000.000.000-00\' : \'00.000.000/0000-00\'} /></Field>',
      '<Field label="Tipo"><select value={editing.tipo} onChange={event => setClientType(event.target.value)}><option>PJ</option><option>PF</option></select></Field><Field label={editing.tipo === \'PF\' ? \'CPF *\' : \'CNPJ *\'}><input inputMode="numeric" maxLength={editing.tipo === \'PF\' ? 14 : 18} value={formatDocument(editing.documento, editing.tipo)} onChange={event => setField(\'documento\', formatDocument(event.target.value, editing.tipo))} placeholder={editing.tipo === \'PF\' ? \'000.000.000-00\' : \'00.000.000/0000-00\'} /></Field>',
      'document label',
    )

    source = replaceRequired(
      source,
      '<Field label="Nome / Razão Social *"><input value={editing.razao} onChange={event => setField(\'razao\', event.target.value)} /></Field><Field label="Nome Fantasia"><input value={editing.fantasia} onChange={event => setField(\'fantasia\', event.target.value)} /></Field>',
      '<Field label={editing.tipo === \'PF\' ? \'Nome completo *\' : \'Razão Social *\'}><input value={editing.razao} onChange={event => setField(\'razao\', event.target.value)} /></Field>{editing.tipo === \'PF\' ? <Field label="Data de nascimento"><input type="date" value={editing.dataNascimento || \'\'} onChange={event => setField(\'dataNascimento\', event.target.value)} /></Field> : <Field label="Nome Fantasia"><input value={editing.fantasia} onChange={event => setField(\'fantasia\', event.target.value)} /></Field>}',
      'name and birth date',
    )

    source = replaceRequired(
      source,
      '<Field label="Tributação"><select value={editing.tributacao} onChange={event => setField(\'tributacao\', event.target.value)}>{taxOptions.map(item => <option key={item}>{item}</option>)}</select></Field><Field label="Atividade"><select value={editing.atividade} onChange={event => setField(\'atividade\', event.target.value)}>{activityOptions.map(item => <option key={item}>{item}</option>)}</select></Field>\n      <Field label="Departamentos" full><div className="choice-list">{departmentChoices.map(name => <label key={name}><input type="checkbox" checked={editing.departamentos.includes(name)} onChange={() => toggleDepartment(name)} /> {name}{activeDepartments.has(name) ? \'\' : \' (inativo)\'}</label>)}</div></Field>',
      '{editing.tipo === \'PJ\' ? <><Field label="Tributação"><select value={editing.tributacao} onChange={event => setField(\'tributacao\', event.target.value)}>{taxOptions.map(item => <option key={item}>{item}</option>)}</select></Field><Field label="Atividade"><select value={editing.atividade} onChange={event => setField(\'atividade\', event.target.value)}>{activityOptions.map(item => <option key={item}>{item}</option>)}</select></Field>\n      <Field label="Departamentos" full><div className="choice-list">{departmentChoices.map(name => <label key={name}><input type="checkbox" checked={editing.departamentos.includes(name)} onChange={() => toggleDepartment(name)} /> {name}{activeDepartments.has(name) ? \'\' : \' (inativo)\'}</label>)}</div></Field></> : null}',
      'PJ tax fields',
    )

    source = replaceRequired(
      source,
      '<Field label="E-mail"><input type="email" value={editing.email} onChange={event => setField(\'email\', event.target.value)} /></Field><Field label="Relacionamento"><select value={editing.relacionamento} onChange={event => setField(\'relacionamento\', event.target.value)}><option>Recorrente</option><option>Avulso</option></select></Field><Field label="Forma de atendimento"><select value={editing.perfilAtendimento || \'Direto\'} onChange={event => setField(\'perfilAtendimento\', event.target.value)}><option value="Direto">Direto</option><option value="Terceirizador">Terceirizador</option><option value="Compartilhado">Compartilhado</option></select></Field><SharedClientFields editing={editing} setField={setField} office={office} />',
      '<Field label="E-mail"><input type="email" value={editing.email} onChange={event => setField(\'email\', event.target.value)} /></Field>{editing.tipo === \'PJ\' ? <><Field label="Relacionamento"><select value={editing.relacionamento} onChange={event => setField(\'relacionamento\', event.target.value)}><option>Recorrente</option><option>Avulso</option></select></Field><Field label="Forma de atendimento"><select value={editing.perfilAtendimento || \'Direto\'} onChange={event => setField(\'perfilAtendimento\', event.target.value)}><option value="Direto">Direto</option><option value="Terceirizador">Terceirizador</option><option value="Compartilhado">Compartilhado</option></select></Field><SharedClientFields editing={editing} setField={setField} office={office} /></> : null}',
      'PJ relationship fields',
    )

    source = replaceRequired(
      source,
      '<Field label="Mensalidade"><input type="number" min="0" step="0.01" value={editing.mensalidade} onChange={event => setField(\'mensalidade\', event.target.value)} /></Field><Field label="Dia de vencimento"><input type="number" min="1" max="31" value={editing.vencimento} onChange={event => setField(\'vencimento\', event.target.value)} /></Field>',
      '{editing.tipo === \'PJ\' ? <><Field label="Mensalidade"><input type="number" min="0" step="0.01" value={editing.mensalidade} onChange={event => setField(\'mensalidade\', event.target.value)} /></Field><Field label="Dia de vencimento"><input type="number" min="1" max="31" value={editing.vencimento} onChange={event => setField(\'vencimento\', event.target.value)} /></Field></> : null}',
      'PJ finance fields',
    )

    source = replaceRequired(
      source,
      '{!editing.id ? <Field label="Tarefas iniciais do cliente" full>',
      '{!editing.id && editing.tipo === \'PJ\' ? <Field label="Tarefas iniciais do cliente" full>',
      'PJ initial tasks only',
    )

    source = replaceRequired(
      source,
      '      <Field label="Observações" full><textarea value={editing.observacoes} onChange={event => setField(\'observacoes\', event.target.value)} /></Field>',
      '      {!editing.id && editing.tipo === \'PF\' ? <Field label="Serviços contratados" full><div className="client-service-picker"><div className="client-service-picker-head"><div><b>Selecione os modelos</b><small>Nada será criado até você usar “Salvar e criar serviços”.</small></div><span>{selectedServiceModels.size} selecionado(s)</span></div><div className="client-service-models">{serviceModels.map(model => <label key={model.key} className={selectedServiceModels.has(model.key) ? \'selected\' : \'\'}><input type="checkbox" checked={selectedServiceModels.has(model.key)} onChange={() => toggleServiceModel(model.key)} /><span><b>{model.title}</b><small>{model.type === \'process\' ? \'Processo\' : \'Tarefa\'} · {model.detail}</small></span></label>)}{!serviceModels.length ? <p>Nenhum modelo de tarefa ou processo cadastrado.</p> : null}</div></div></Field> : null}\n      <Field label="Observações" full><textarea value={editing.observacoes} onChange={event => setField(\'observacoes\', event.target.value)} /></Field>',
      'PF service selector',
    )

    source = replaceRequired(
      source,
      '<button className="primary">Salvar cliente</button></footer>',
      '<button type="submit" value="save" className={!editing.id && editing.tipo === \'PF\' && selectedServiceModels.size ? \'\' : \'primary\'}>Salvar cliente</button>{!editing.id && editing.tipo === \'PF\' && selectedServiceModels.size ? <button type="submit" value="save-create-services" className="primary">Salvar e criar serviços</button> : null}</footer>',
      'explicit save actions',
    )

    source = '// ' + marker + '\n' + source
    writeFileSync(componentPath, source)
  }

  const cssPath = root + 'src/clients-react.css'
  let css = readFileSync(cssPath, 'utf8')
  if (!css.includes(marker)) {
    css += `\n/* ${marker} */
.client-service-picker{display:grid;gap:12px;padding:14px;border:1px solid #E4E9F1;border-radius:14px;background:#F8FAFD}.client-service-picker-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.client-service-picker-head>div{display:grid;gap:3px}.client-service-picker-head b{color:#182230}.client-service-picker-head small{color:#667085;font-weight:400}.client-service-picker-head>span{flex:0 0 auto;padding:4px 9px;border-radius:999px;background:#EEF3FF;color:#2456E8;font-size:12px;font-weight:700}.client-service-models{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.client-service-models>label{display:flex;align-items:flex-start;gap:9px;padding:11px 12px;border:1px solid #E4E9F1;border-radius:11px;background:#fff;cursor:pointer}.client-service-models>label.selected{border-color:#AFC1F8;background:#F4F7FF}.client-service-models>label input{margin-top:3px}.client-service-models>label span{display:grid;gap:2px}.client-service-models>label b{font-size:13px;color:#182230}.client-service-models>label small{font-size:12px;color:#667085;font-weight:400}.client-service-models>p{grid-column:1/-1;margin:0;color:#667085}.client-form-person .client-field textarea{min-height:78px}@media(max-width:720px){.client-service-picker-head{align-items:stretch;flex-direction:column}.client-service-picker-head>span{align-self:flex-start}.client-service-models{grid-template-columns:1fr}}\n`
    writeFileSync(cssPath, css)
  }
}
