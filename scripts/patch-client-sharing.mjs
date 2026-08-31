import { readFileSync, writeFileSync } from 'node:fs'

export function applyClientSharingPatch(root) {
  const path = `${root}src/components/ClientsReact.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes("import PartnersPanel from './PartnersPanel.jsx'")) return

  const replacements = [
    [
      "import OutsourcedCompaniesPanel from './OutsourcedCompaniesPanel.jsx'",
      "import OutsourcedCompaniesPanel from './OutsourcedCompaniesPanel.jsx'\nimport PartnersPanel from './PartnersPanel.jsx'",
      'partners import',
    ],
    [
      "status: 'Ativo', perfilAtendimento: 'Direto', drive: '', observacoes: '', dataEntrada: '', dataSaida: '', motivoSaida: '', comunicacoes: [],",
      "status: 'Ativo', perfilAtendimento: 'Direto', parceiroId: '', compartilhadoRecebedor: 'Escritorio', compartilhadoMinhaParte: '', compartilhadoParceiroParte: '', drive: '', observacoes: '', dataEntrada: '', dataSaida: '', motivoSaida: '', comunicacoes: [],",
      'shared defaults',
    ],
    [
      "    if (office.clients.some(client => client.id !== editing.id && documentDigits(client.documento) === normalizedDocument)) { setError('Este CPF/CNPJ já está cadastrado.'); return }\n    const isNew = !editing.id",
      "    if (office.clients.some(client => client.id !== editing.id && documentDigits(client.documento) === normalizedDocument)) { setError('Este CPF/CNPJ já está cadastrado.'); return }\n    if (editing.perfilAtendimento === 'Compartilhado' && !editing.parceiroId) { setError('Selecione o parceiro deste cliente compartilhado.'); return }\n    const sharedMonthlyValue = Number(editing.mensalidade) || 0\n    const sharedMyPart = Number(editing.compartilhadoMinhaParte) || 0\n    const sharedPartnerPart = Number(editing.compartilhadoParceiroParte) || 0\n    if (editing.perfilAtendimento === 'Compartilhado' && editing.relacionamento === 'Recorrente' && (sharedMyPart > 0 || sharedPartnerPart > 0) && Math.abs((sharedMyPart + sharedPartnerPart) - sharedMonthlyValue) > 0.009) { setError('No padrão financeiro, sua parte + parte do parceiro deve ser igual à mensalidade.'); return }\n    const isNew = !editing.id",
      'shared validation',
    ],
    [
      "mensalidade: Number(editing.mensalidade) || 0, vencimento: Number(editing.vencimento) || null, drive:",
      "mensalidade: Number(editing.mensalidade) || 0, compartilhadoMinhaParte: Number(editing.compartilhadoMinhaParte) || 0, compartilhadoParceiroParte: Number(editing.compartilhadoParceiroParte) || 0, vencimento: Number(editing.vencimento) || null, drive:",
      'shared numeric save',
    ],
    [
      "<Field label=\"Forma de atendimento\"><select value={editing.perfilAtendimento || 'Direto'} onChange={event => setField('perfilAtendimento', event.target.value)}><option value=\"Direto\">Direto</option><option value=\"Terceirizador\">Terceirizador</option><option value=\"Compartilhado\">Compartilhado</option></select></Field>",
      "<Field label=\"Forma de atendimento\"><select value={editing.perfilAtendimento || 'Direto'} onChange={event => setField('perfilAtendimento', event.target.value)}><option value=\"Direto\">Direto</option><option value=\"Terceirizador\">Terceirizador</option><option value=\"Compartilhado\">Compartilhado</option></select></Field>{editing.perfilAtendimento === 'Compartilhado' ? <Field label=\"Parceiro responsável\" full><select value={editing.parceiroId || ''} onChange={event => setField('parceiroId', event.target.value)}><option value=\"\">Selecione um parceiro</option>{(office.partners || []).filter(partner => partner.status !== 'Inativo' || String(partner.id) === String(editing.parceiroId)).map(partner => <option value={partner.id} key={partner.id}>{partner.nome || 'Parceiro'}{partner.status === 'Inativo' ? ' (inativo)' : ''}</option>)}</select>{!(office.partners || []).some(partner => partner.status !== 'Inativo') ? <small>Cadastre primeiro um parceiro no bloco “Parceiros de trabalho”.</small> : null}</Field> : null}",
      'partner selector',
    ],
    [
      "<Field label=\"Mensalidade\"><input type=\"number\" min=\"0\" step=\"0.01\" value={editing.mensalidade} onChange={event => setField('mensalidade', event.target.value)} /></Field><Field label=\"Dia de vencimento\"><input type=\"number\" min=\"1\" max=\"31\" value={editing.vencimento} onChange={event => setField('vencimento', event.target.value)} /></Field>",
      "<Field label=\"Mensalidade\"><input type=\"number\" min=\"0\" step=\"0.01\" value={editing.mensalidade} onChange={event => setField('mensalidade', event.target.value)} /></Field><Field label=\"Dia de vencimento\"><input type=\"number\" min=\"1\" max=\"31\" value={editing.vencimento} onChange={event => setField('vencimento', event.target.value)} /></Field>{editing.perfilAtendimento === 'Compartilhado' && editing.relacionamento === 'Recorrente' ? <><Field label=\"Quem normalmente recebe\"><select value={editing.compartilhadoRecebedor || 'Escritorio'} onChange={event => setField('compartilhadoRecebedor', event.target.value)}><option value=\"Escritorio\">Meu escritório</option><option value=\"Parceiro\">Parceiro</option></select></Field><Field label=\"Minha parte padrão\"><input type=\"number\" min=\"0\" step=\"0.01\" value={editing.compartilhadoMinhaParte} onChange={event => setField('compartilhadoMinhaParte', event.target.value)} /></Field><Field label=\"Parte padrão do parceiro\"><input type=\"number\" min=\"0\" step=\"0.01\" value={editing.compartilhadoParceiroParte} onChange={event => setField('compartilhadoParceiroParte', event.target.value)} /></Field><Field label=\"Como funciona\" full><small>Esses valores serão sugeridos nas cobranças mensais. Você poderá alterar uma competência sem mudar este padrão.</small></Field></> : null}",
      'recurring shared finance fields',
    ],
    [
      "    <OutsourcedCompaniesPanel office={office} update={update} />",
      "    <PartnersPanel office={office} update={update} />\n\n    <OutsourcedCompaniesPanel office={office} update={update} />",
      'partners panel',
    ],
  ]

  for (const [from, to, label] of replacements) {
    if (!source.includes(from)) throw new Error(`Client sharing patch failed (${label}) in ${path}`)
    source = source.replace(from, to)
  }

  writeFileSync(path, source)
}