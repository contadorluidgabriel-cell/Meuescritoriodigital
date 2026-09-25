import { readFileSync, writeFileSync } from 'node:fs'

const marker = 'MED_PF_CLIENT_FORM_V2'

function replaceRequired(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source
  if (!source.includes(oldValue)) throw new Error('PF client form V2 patch: missing ' + label)
  return source.replace(oldValue, newValue)
}

export function applyPfClientFormV2Patch(root) {
  const componentPath = root + 'src/components/ClientsReact.jsx'
  let source = readFileSync(componentPath, 'utf8')
  if (!source.includes(marker)) {
    source = replaceRequired(
      source,
      "telefone: '', whatsapp: '', email: '', dataNascimento: '', endereco: '', relacionamento:",
      "telefone: '', whatsapp: '', email: '', endereco: '', relacionamento:",
      'remove birth date default',
    )

    source = replaceRequired(
      source,
      "  function setClientType(type) { setEditing(current => ({ ...current, tipo: type, documento: formatDocument(current.documento, type), relacionamento: type === 'PF' ? 'Avulso' : (current.tipo === 'PF' ? 'Recorrente' : current.relacionamento) })); if (type === 'PF') setSelectedTemplates(new Set()); else setSelectedServiceModels(new Set()) }",
      "  function setClientType(type) { setEditing(current => ({ ...current, tipo: type, documento: formatDocument(current.documento, type), relacionamento: type === 'PF' ? 'Avulso' : (current.tipo === 'PF' ? 'Recorrente' : current.relacionamento), perfilAtendimento: type === 'PF' && current.perfilAtendimento === 'Terceirizador' ? 'Direto' : current.perfilAtendimento })); if (type === 'PF') setSelectedTemplates(new Set()); else setSelectedServiceModels(new Set()) }",
      'PF service profile normalization',
    )

    source = replaceRequired(
      source,
      "    if (client.tipo === 'PF') Object.assign(client, { fantasia: '', tributacao: '', atividade: '', departamentos: [], relacionamento: 'Avulso', mensalidade: 0, vencimento: null, perfilAtendimento: 'Direto', parceiroIds: [], parceiroId: '', responsabilidadesCompartilhadas: {}, compartilhadoRecebedor: 'Escritorio', compartilhadoMinhaParte: 0, compartilhadoPartesParceiros: [], compartilhadoParceiroParte: 0 })",
      "    if (client.tipo === 'PF') Object.assign(client, { fantasia: '', tributacao: '', atividade: '', departamentos: [], relacionamento: 'Avulso', mensalidade: 0, vencimento: null })",
      'preserve PF sharing fields',
    )

    source = replaceRequired(
      source,
      "<Field label={editing.tipo === 'PF' ? 'Nome completo *' : 'Razão Social *'}><input value={editing.razao} onChange={event => setField('razao', event.target.value)} /></Field>{editing.tipo === 'PF' ? <Field label=\"Data de nascimento\"><input type=\"date\" value={editing.dataNascimento || ''} onChange={event => setField('dataNascimento', event.target.value)} /></Field> : <Field label=\"Nome Fantasia\"><input value={editing.fantasia} onChange={event => setField('fantasia', event.target.value)} /></Field>}",
      "<Field label={editing.tipo === 'PF' ? 'Nome completo *' : 'Razão Social *'}><input value={editing.razao} onChange={event => setField('razao', event.target.value)} /></Field>{editing.tipo === 'PJ' ? <Field label=\"Nome Fantasia\"><input value={editing.fantasia} onChange={event => setField('fantasia', event.target.value)} /></Field> : null}",
      'remove birth date field',
    )

    source = replaceRequired(
      source,
      "<Field label=\"E-mail\"><input type=\"email\" value={editing.email} onChange={event => setField('email', event.target.value)} /></Field>{editing.tipo === 'PJ' ? <><Field label=\"Relacionamento\"><select value={editing.relacionamento} onChange={event => setField('relacionamento', event.target.value)}><option>Recorrente</option><option>Avulso</option></select></Field><Field label=\"Forma de atendimento\"><select value={editing.perfilAtendimento || 'Direto'} onChange={event => setField('perfilAtendimento', event.target.value)}><option value=\"Direto\">Direto</option><option value=\"Terceirizador\">Terceirizador</option><option value=\"Compartilhado\">Compartilhado</option></select></Field><SharedClientFields editing={editing} setField={setField} office={office} /></> : null}",
      "<Field label=\"E-mail\"><input type=\"email\" value={editing.email} onChange={event => setField('email', event.target.value)} /></Field>{editing.tipo === 'PJ' ? <Field label=\"Relacionamento\"><select value={editing.relacionamento} onChange={event => setField('relacionamento', event.target.value)}><option>Recorrente</option><option>Avulso</option></select></Field> : null}<Field label=\"Forma de atendimento\"><select value={editing.perfilAtendimento || 'Direto'} onChange={event => setField('perfilAtendimento', event.target.value)}><option value=\"Direto\">Direto</option>{editing.tipo === 'PJ' ? <option value=\"Terceirizador\">Terceirizador</option> : null}<option value=\"Compartilhado\">Compartilhado</option></select></Field><SharedClientFields editing={editing} setField={setField} office={office} />",
      'PF sharing controls',
    )

    source = replaceRequired(
      source,
      "<Field label=\"Status\"><select value={editing.status} onChange={event => setField('status', event.target.value)}><option>Ativo</option><option>Inativo</option></select></Field><Field label=\"Data de entrada\"><input type=\"date\" value={editing.dataEntrada} onChange={event => setField('dataEntrada', event.target.value)} /></Field>\n      <Field label=\"Data de saída\"><input type=\"date\" value={editing.dataSaida} onChange={event => setField('dataSaida', event.target.value)} /></Field><Field label=\"Motivo da saída\" full><input value={editing.motivoSaida} onChange={event => setField('motivoSaida', event.target.value)} placeholder=\"Opcional; use quando o cliente sair\" /></Field>",
      "<Field label=\"Status\"><select value={editing.status} onChange={event => setField('status', event.target.value)}><option>Ativo</option><option>Inativo</option></select></Field><Field label=\"Data de entrada\"><input type=\"date\" value={editing.dataEntrada} onChange={event => setField('dataEntrada', event.target.value)} /></Field>\n      {editing.status === 'Inativo' ? <><Field label=\"Data de saída\"><input type=\"date\" value={editing.dataSaida} onChange={event => setField('dataSaida', event.target.value)} /></Field><Field label=\"Motivo da saída\" full><input value={editing.motivoSaida} onChange={event => setField('motivoSaida', event.target.value)} placeholder=\"Informe o motivo da inativação\" /></Field></> : null}",
      'conditional exit fields',
    )

    source = '// ' + marker + '\n' + source
    writeFileSync(componentPath, source)
  }
}
