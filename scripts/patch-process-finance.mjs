import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label, path) {
  if (!source.includes(from)) throw new Error(`Process finance patch failed (${label}) in ${path}`)
  return source.replace(from, to)
}

function ensureUseEffectImport(source, path) {
  const match = source.match(/import\s+\{([^}]*)\}\s+from ['"]react['"]/)
  if (!match) throw new Error(`Process finance patch failed (react import) in ${path}`)
  if (match[1].split(',').map(item => item.trim()).includes('useEffect')) return source
  const names = match[1].split(',').map(item => item.trim()).filter(Boolean)
  names.unshift('useEffect')
  return source.replace(match[0], `import { ${[...new Set(names)].join(', ')} } from 'react'`)
}

export function applyProcessFinancePatch(root) {
  const path = `${root}src/components/ProcessesReact.jsx`
  let source = readFileSync(path, 'utf8')
  const marker = 'Gerar cobrança no Financeiro ao salvar'
  if (source.includes(marker)) return

  source = ensureUseEffectImport(source, path)

  source = replaceRequired(
    source,
    "import { workResponsibilityFields } from '../lib/sharedResponsibility.js'",
    "import { workResponsibilityFields } from '../lib/sharedResponsibility.js'\nimport { clientPartnerIds } from '../lib/sharedWork.js'\nimport { buildProcessFinanceCharges, normalizedProcessFinance, processFinanceError, processHasFinanceCharge } from '../lib/processFinance.js'",
    'imports',
    path,
  )

  source = replaceRequired(
    source,
    "status: process?.status || 'Novo', drive: process?.drive || '', observacoes: process?.observacoes || '', terceirizado: Boolean(process?.terceirizado), terceiroCnpj: process?.terceiroCnpj || '', terceiroNome: process?.terceiroNome || '', compartilhadoResponsavel: process?.compartilhadoResponsavel || '', compartilhadoParceiroId: process?.compartilhadoParceiroId || '', etapas:",
    "status: process?.status || 'Novo', drive: process?.drive || '', observacoes: process?.observacoes || '', terceirizado: Boolean(process?.terceirizado), terceiroCnpj: process?.terceiroCnpj || '', terceiroNome: process?.terceiroNome || '', compartilhadoResponsavel: process?.compartilhadoResponsavel || '', compartilhadoParceiroId: process?.compartilhadoParceiroId || '', cobradoAParte: Boolean(process?.cobradoAParte), financeiroValor: process?.financeiroValor ?? '', financeiroParcelas: process?.financeiroParcelas || 1, financeiroVencimento: process?.financeiroVencimento || today(), financeiroDescricao: process?.financeiroDescricao || '', financeiroParceiroIds: Array.isArray(process?.financeiroParceiroIds) ? process.financeiroParceiroIds : [], financeiroRecebedor: process?.financeiroRecebedor || 'Escritorio', financeiroMinhaParte: process?.financeiroMinhaParte ?? '', financeiroPartesParceiros: Array.isArray(process?.financeiroPartesParceiros) ? process.financeiroPartesParceiros : [], gerarCobranca: false, cobrancaGeradaEm: process?.cobrancaGeradaEm || '', etapas:",
    'draft defaults',
    path,
  )

  source = replaceRequired(
    source,
    "    const outsourcingError = thirdPartyError(draft)\n    if (outsourcingError) { setError(outsourcingError); return }",
    "    const outsourcingError = thirdPartyError(draft)\n    if (outsourcingError) { setError(outsourcingError); return }\n    const financeClient = clients.find(client => String(client.id) === String(draft.clientId))\n    const financeError = processFinanceError(draft, financeClient)\n    if (financeError) { setError(financeError); return }",
    'validation',
    path,
  )

  source = replaceRequired(
    source,
    "onSave({ ...draft, ...workResponsibilityFields(draft, clients.find(client => String(client.id) === String(draft.clientId))), tipo: type, origem: draft.origem.trim(), drive: draft.drive.trim(), observacoes: draft.observacoes.trim(), terceirizado: Boolean(draft.terceirizado), terceiroCnpj: draft.terceirizado ? formatCnpj(draft.terceiroCnpj) : '', terceiroNome: draft.terceirizado ? draft.terceiroNome.trim() : '', relacionados:",
    "onSave({ ...draft, ...workResponsibilityFields(draft, clients.find(client => String(client.id) === String(draft.clientId))), ...normalizedProcessFinance(draft, clients.find(client => String(client.id) === String(draft.clientId))), tipo: type, origem: draft.origem.trim(), drive: draft.drive.trim(), observacoes: draft.observacoes.trim(), terceirizado: Boolean(draft.terceirizado), terceiroCnpj: draft.terceirizado ? formatCnpj(draft.terceiroCnpj) : '', terceiroNome: draft.terceirizado ? draft.terceiroNome.trim() : '', cobrancaGeradaEm: draft.cobrancaGeradaEm || '', relacionados:",
    'normalized save',
    path,
  )

  const statusAnchor = "<Field label=\"Status\"><select value={draft.status} onChange={event => setField('status', event.target.value)}>{processStatuses.map(status => <option key={status}>{status}</option>)}</select></Field><Field label=\"Terceirização\" full>"
  const financeFields = `<Field label="Status"><select value={draft.status} onChange={event => setField('status', event.target.value)}>{processStatuses.map(status => <option key={status}>{status}</option>)}</select></Field><Field label="Financeiro" full><div className="third-party-toggle"><label><input type="checkbox" checked={Boolean(draft.cobradoAParte)} onChange={event => setDraft(current => ({ ...current, cobradoAParte: event.target.checked, gerarCobranca: event.target.checked ? current.gerarCobranca : false }))} /> Este processo é cobrado à parte</label></div></Field>{draft.cobradoAParte ? <><Field label="Valor do serviço *"><input type="number" min="0.01" step="0.01" value={draft.financeiroValor} onChange={event => setField('financeiroValor', event.target.value)} placeholder="0,00" /></Field><Field label="Parcelas"><input type="number" min="1" max="60" step="1" value={draft.financeiroParcelas} onChange={event => setField('financeiroParcelas', event.target.value)} /></Field><Field label="Primeiro vencimento *"><input type="date" value={draft.financeiroVencimento} onChange={event => setField('financeiroVencimento', event.target.value)} /></Field><Field label="Descrição da cobrança"><input value={draft.financeiroDescricao} onChange={event => setField('financeiroDescricao', event.target.value)} placeholder={draft.tipo || 'Serviço do processo'} /></Field>{clients.find(client => String(client.id) === String(draft.clientId))?.perfilAtendimento === 'Compartilhado' ? <><Field label="Quem recebe"><select value={draft.financeiroRecebedor || 'Escritorio'} onChange={event => setField('financeiroRecebedor', event.target.value)}><option value="Escritorio">Meu escritório</option><option value="CadaUm">Cada um recebe sua parte</option>{clientPartnerIds(clients.find(client => String(client.id) === String(draft.clientId))).map(partnerId => { const partner = (office.partners || []).find(item => String(item.id) === String(partnerId)); return <option value={\`partner:\${partnerId}\`} key={partnerId}>{partner?.nome || partner?.razao || 'Parceiro'} recebe</option> })}</select></Field><Field label="Minha parte *"><input type="number" min="0" step="0.01" value={draft.financeiroMinhaParte} onChange={event => setField('financeiroMinhaParte', event.target.value)} /></Field>{clientPartnerIds(clients.find(client => String(client.id) === String(draft.clientId))).map(partnerId => { const partner = (office.partners || []).find(item => String(item.id) === String(partnerId)); const currentShare = (draft.financeiroPartesParceiros || []).find(item => String(item.parceiroId) === String(partnerId)); return <Field label={\`Parte · \${partner?.nome || partner?.razao || 'Parceiro'} *\`} key={partnerId}><input type="number" min="0" step="0.01" value={currentShare?.valor ?? ''} onChange={event => setDraft(current => ({ ...current, financeiroParceiroIds: clientPartnerIds(clients.find(client => String(client.id) === String(current.clientId))), financeiroPartesParceiros: [...(current.financeiroPartesParceiros || []).filter(item => String(item.parceiroId) !== String(partnerId)), { parceiroId: String(partnerId), valor: event.target.value }] }))} /></Field> })}</> : null}<Field label="Gerar cobrança" full>{draft.cobrancaGeradaEm ? <div className="installment-note">Cobrança já gerada no Financeiro. Alterar o processo não modifica lançamentos financeiros existentes.</div> : <div className="third-party-toggle"><label><input type="checkbox" checked={Boolean(draft.gerarCobranca)} onChange={event => setField('gerarCobranca', event.target.checked)} /> Gerar cobrança no Financeiro ao salvar</label><small>{Number(draft.financeiroParcelas || 1) > 1 ? \`Serão criadas \${Math.min(60, Math.max(1, Number(draft.financeiroParcelas) || 1))} parcelas mensais.\` : 'Será criada uma cobrança à vista.'}</small></div>}</Field></> : <Field label="Financeiro" full><div className="installment-note">Sem cobrança adicional: o processo é considerado incluído no atendimento/mensalidade.</div></Field>}<Field label="Terceirização" full>`
  source = replaceRequired(source, statusAnchor, financeFields, 'form fields', path)

  source = replaceRequired(
    source,
    "<small>{clientName(clientsById.get(String(process.clientId)))} · {process.status || 'Novo'} · prazo {formatDate(process.prazoFinal)}{process.terceirizado ? ` · Terceirizado: ${process.terceiroNome || 'Sem nome'} · ${formatCnpj(process.terceiroCnpj)}` : ''}</small><SharedResponsibilityBadge record={process} client={clientsById.get(String(process.clientId))} office={office} />",
    "<small>{clientName(clientsById.get(String(process.clientId)))} · {process.status || 'Novo'} · prazo {formatDate(process.prazoFinal)}{process.terceirizado ? ` · Terceirizado: ${process.terceiroNome || 'Sem nome'} · ${formatCnpj(process.terceiroCnpj)}` : ''}</small><SharedResponsibilityBadge record={process} client={clientsById.get(String(process.clientId))} office={office} />{process.cobradoAParte ? <small>Financeiro · {Number(process.financeiroValor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · {Number(process.financeiroParcelas || 1) > 1 ? `${process.financeiroParcelas}x` : 'à vista'} · {processHasFinanceCharge(process, office.finance || []) ? 'cobrança gerada' : 'cobrança ainda não gerada'}</small> : <small>Financeiro · incluído no atendimento</small>}",
    'list finance summary',
    path,
  )

  source = replaceRequired(
    source,
    "<div className=\"process-meta\"><span>Abertura: {formatDate(process.dataAbertura)}</span><span>Origem: {process.origem || '—'}</span>{process.terceirizado ? <span>Terceirizado: {process.terceiroNome || 'Sem nome'} · {formatCnpj(process.terceiroCnpj)}</span> : null}",
    "<div className=\"process-meta\"><span>Abertura: {formatDate(process.dataAbertura)}</span><span>Origem: {process.origem || '—'}</span>{process.terceirizado ? <span>Terceirizado: {process.terceiroNome || 'Sem nome'} · {formatCnpj(process.terceiroCnpj)}</span> : null}{process.cobradoAParte ? <span>Financeiro: {Number(process.financeiroValor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · {Number(process.financeiroParcelas || 1) > 1 ? `${process.financeiroParcelas} parcelas` : 'à vista'} · venc. {formatDate(process.financeiroVencimento)}</span> : <span>Financeiro: incluído no atendimento</span>}",
    'details finance summary',
    path,
  )

  const mainFunction = /export default function ProcessesReact\(([^)]*)\) \{/
  const mainMatch = source.match(mainFunction)
  if (!mainMatch) throw new Error(`Process finance patch failed (main component) in ${path}`)
  const effect = `${mainMatch[0]}\n  useEffect(() => {\n    const pending = (office.processes || []).filter(process => process.cobradoAParte && process.gerarCobranca && !process.cobrancaGeradaEm)\n    if (!pending.length) return\n    update(draftOffice => {\n      const clientsById = new Map((draftOffice.clients || []).map(client => [String(client.id), client]))\n      pending.forEach(snapshot => {\n        const process = (draftOffice.processes || []).find(item => String(item.id) === String(snapshot.id))\n        if (!process || !process.cobradoAParte || !process.gerarCobranca || process.cobrancaGeradaEm) return\n        const exists = processHasFinanceCharge(process, draftOffice.finance || [])\n        if (!exists) {\n          const client = clientsById.get(String(process.clientId)) || {}\n          const charges = buildProcessFinanceCharges(process, client, uid)\n          draftOffice.finance = [...(draftOffice.finance || []), ...charges]\n        }\n        process.gerarCobranca = false\n        process.cobrancaGeradaEm = today()\n      })\n    })\n  }, [office.processes, office.finance, office.clients, update])`
  source = source.replace(mainFunction, effect)

  writeFileSync(path, source)
}
