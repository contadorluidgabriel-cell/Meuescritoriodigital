import { readFileSync, writeFileSync } from 'node:fs'

export function applyClientSharingPatch(root) {
  const path = `${root}src/components/ClientsReact.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes("import SharedClientFields from './SharedClientFields.jsx'")) return

  const replacements = [
    [
      "import OutsourcedCompaniesPanel from './OutsourcedCompaniesPanel.jsx'",
      "import OutsourcedCompaniesPanel from './OutsourcedCompaniesPanel.jsx'\nimport PartnersPanel from './PartnersPanel.jsx'\nimport SharedClientFields from './SharedClientFields.jsx'\nimport { clientPartnerIds, normalizedSharedClientFields, sharedClientError, sharedSplit } from '../lib/sharedWork.js'",
      'shared imports',
    ],
    [
      "status: 'Ativo', perfilAtendimento: 'Direto', drive: '', observacoes: '', dataEntrada: '', dataSaida: '', motivoSaida: '', comunicacoes: [],",
      "status: 'Ativo', perfilAtendimento: 'Direto', parceiroIds: [], parceiroId: '', responsabilidadesCompartilhadas: {}, compartilhadoRecebedor: 'Escritorio', compartilhadoMinhaParte: '', compartilhadoPartesParceiros: [], compartilhadoParceiroParte: '', drive: '', observacoes: '', dataEntrada: '', dataSaida: '', motivoSaida: '', comunicacoes: [],",
      'shared defaults',
    ],
    [
      "    if (office.clients.some(client => client.id !== editing.id && documentDigits(client.documento) === normalizedDocument)) { setError('Este CPF/CNPJ já está cadastrado.'); return }\n    const isNew = !editing.id",
      "    if (office.clients.some(client => client.id !== editing.id && documentDigits(client.documento) === normalizedDocument)) { setError('Este CPF/CNPJ já está cadastrado.'); return }\n    const sharingError = sharedClientError(editing, office)\n    if (sharingError) { setError(sharingError); return }\n    const sharedFields = editing.perfilAtendimento === 'Compartilhado' ? normalizedSharedClientFields(editing) : { parceiroIds: [], parceiroId: '', responsabilidadesCompartilhadas: {}, compartilhadoRecebedor: 'Escritorio', compartilhadoMinhaParte: 0, compartilhadoPartesParceiros: [], compartilhadoParceiroParte: 0 }\n    const isNew = !editing.id",
      'shared validation',
    ],
    [
      "    const client = { ...editing, id: editing.id || uid('cli'), documento:",
      "    const client = { ...editing, ...sharedFields, id: editing.id || uid('cli'), documento:",
      'shared save',
    ],
    [
      "<Field label=\"Forma de atendimento\"><select value={editing.perfilAtendimento || 'Direto'} onChange={event => setField('perfilAtendimento', event.target.value)}><option value=\"Direto\">Direto</option><option value=\"Terceirizador\">Terceirizador</option><option value=\"Compartilhado\">Compartilhado</option></select></Field>",
      "<Field label=\"Forma de atendimento\"><select value={editing.perfilAtendimento || 'Direto'} onChange={event => setField('perfilAtendimento', event.target.value)}><option value=\"Direto\">Direto</option><option value=\"Terceirizador\">Terceirizador</option><option value=\"Compartilhado\">Compartilhado</option></select></Field><SharedClientFields editing={editing} setField={setField} office={office} />",
      'shared client fields',
    ],
    [
      "    <OutsourcedCompaniesPanel office={office} update={update} />",
      "    <PartnersPanel office={office} update={update} />\n\n    <OutsourcedCompaniesPanel office={office} update={update} />",
      'partners panel',
    ],
    [
      "  const canCharge = client.status !== 'Inativo'\n  return <Modal",
      "  const canCharge = client.status !== 'Inativo'\n  const partnerIds = clientPartnerIds(client)\n  const clientPartners = partnerIds.map(id => (office.partners || []).find(partner => String(partner.id) === id)).filter(Boolean)\n  return <Modal",
      'details partners',
    ],
    [
      "<div className=\"client-summary\"><article><b>Contato</b><p>WhatsApp: {client.whatsapp || '—'}<br />Telefone: {client.telefone || '—'}<br />{client.email || '—'}</p></article><article><b>Relacionamento</b><p>{client.relacionamento}{client.relacionamento === 'Recorrente' ? ` · ${money(client.mensalidade)}` : ''}</p></article><article><b>Documentos</b>",
      "<div className=\"client-summary\"><article><b>Contato</b><p>WhatsApp: {client.whatsapp || '—'}<br />Telefone: {client.telefone || '—'}<br />{client.email || '—'}</p></article><article><b>Relacionamento</b><p>{client.relacionamento}{client.relacionamento === 'Recorrente' ? ` · ${money(client.mensalidade)}` : ''}<br />{client.perfilAtendimento || 'Direto'}{client.perfilAtendimento === 'Compartilhado' ? ` · ${clientPartners.map(partner => partner.nome || partner.razao || 'Parceiro').join(', ') || 'Sem parceiro'}` : ''}</p></article><article><b>Documentos</b>",
      'details shared summary',
    ],
    [
      "<div className=\"detail-list\">{charges.slice(0, 12).map(charge => <article key={charge.id}><div><b>{charge.descricao || 'Cobrança'}</b><small>{charge.competencia || 'Sem competência'} · {charge.status || 'Pendente'} · {formatDate(charge.vencimento)}</small></div><strong>{money(charge.valor)}</strong></article>)}{!charges.length ? <div className=\"empty\">Nenhuma cobrança vinculada a este cliente.</div> : null}</div>",
      "<div className=\"detail-list\">{charges.slice(0, 12).map(charge => { const split = charge.compartilhado ? sharedSplit(charge, client) : null; return <article key={charge.id}><div><b>{charge.descricao || 'Cobrança'}</b><small>{charge.competencia || 'Sem competência'} · {charge.status || 'Pendente'} · {formatDate(charge.vencimento)}</small>{split ? <small>Minha parte {money(split.mine)} · parceiros {money(split.partnerTotal)} · acerto {charge.compartilhadoAcertoStatus === 'Liquidado' ? 'liquidado' : 'pendente'}</small> : null}</div><strong>{money(charge.valor)}</strong></article>})}{!charges.length ? <div className=\"empty\">Nenhuma cobrança vinculada a este cliente.</div> : null}</div>",
      'details finance history',
    ],
  ]

  for (const [from, to, label] of replacements) {
    if (!source.includes(from)) throw new Error(`Client sharing patch failed (${label}) in ${path}`)
    source = source.replace(from, to)
  }

  writeFileSync(path, source)
}
