import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label, path) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`Process cancellation patch failed (${label}) in ${path}`)
  return source.replace(from, to)
}

export function applyProcessCancellationPatch(root) {
  const planningPath = `${root}src/lib/processPlanning.js`
  let planning = readFileSync(planningPath, 'utf8')
  if (!planning.includes("processIsClosed")) {
    planning = replaceRequired(
      planning,
      "import { isDone, today } from './storage.js'",
      "import { isDone, today } from './storage.js'\nimport { processIsClosed } from './processCancellation.js'",
      'planning closed import',
      planningPath,
    )
    planning = planning.replaceAll("if (!isDone(next.status)) next.status = processStatusFromStep(initialized)", "if (!processIsClosed(next)) next.status = processStatusFromStep(initialized)")
    planning = planning.replaceAll("if (!isDone(next.status) && current.allDone) next.status = 'Em andamento'", "if (!processIsClosed(next) && current.allDone) next.status = 'Em andamento'")
    planning = planning.replaceAll("if (!isDone(next.status)) next.status = processStatusFromStep(updated)", "if (!processIsClosed(next)) next.status = processStatusFromStep(updated)")
    writeFileSync(planningPath, planning)
  }

  const path = `${root}src/components/ProcessesReact.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes('MED_PROCESS_CANCELLATION_V1')) return

  source = replaceRequired(
    source,
    "import { buildProcessFinanceCharges, normalizedProcessFinance, processFinanceError, processHasFinanceCharge } from '../lib/processFinance.js'",
    "import { buildProcessFinanceCharges, normalizedProcessFinance, processFinanceError, processHasFinanceCharge } from '../lib/processFinance.js'\nimport { processCancellationError, processCancellationSummary, processIsCancelled, processIsClosed } from '../lib/processCancellation.js'",
    'imports',
    path,
  )

  source = source.replace(
    /const processStatuses = \[([^\]]*)\]/,
    (match, body) => body.includes("'Cancelado'") ? match : `const processStatuses = [${body.trim().replace(/,$/, '')}, 'Cancelado']`,
  )

  source = replaceRequired(
    source,
    "cobrancaGeradaEm: process?.cobrancaGeradaEm || '', etapas:",
    "cobrancaGeradaEm: process?.cobrancaGeradaEm || '', cancelamentoPor: process?.cancelamentoPor || '', cancelamentoMotivo: process?.cancelamentoMotivo || '', cancelamentoData: process?.cancelamentoData || '', cancelamentoValorDevido: process?.cancelamentoValorDevido ?? '', etapas:",
    'draft cancellation defaults',
    path,
  )

  source = replaceRequired(
    source,
    "    const financeError = processFinanceError(draft, financeClient)\n    if (financeError) { setError(financeError); return }",
    "    const cancellationError = processCancellationError(draft)\n    if (cancellationError) { setError(cancellationError); return }\n    const financeError = processFinanceError(draft, financeClient)\n    if (financeError) { setError(financeError); return }",
    'cancellation validation',
    path,
  )

  {
    const cancellationFields = `{processIsCancelled(draft) ? <><Field label="Cancelado por *"><select value={draft.cancelamentoPor || ''} onChange={event => setField('cancelamentoPor', event.target.value)}><option value="">Selecione…</option><option value="Cliente">Cliente</option><option value="Escritorio">Escritório</option><option value="Terceiro/Orgao">Terceiro/Órgão</option></select></Field><Field label="Data do cancelamento *"><input type="date" value={draft.cancelamentoData || ''} onChange={event => setField('cancelamentoData', event.target.value)} /></Field><Field label="Motivo do cancelamento *" full><textarea value={draft.cancelamentoMotivo || ''} onChange={event => setField('cancelamentoMotivo', event.target.value)} placeholder="Ex.: Cliente desistiu de prosseguir com o processo." /></Field><Field label="Valor devido no cancelamento"><input type="number" min="0" step="0.01" value={draft.cancelamentoValorDevido ?? ''} onChange={event => setField('cancelamentoValorDevido', event.target.value)} placeholder="0,00" /></Field><Field label="Resumo financeiro do cancelamento" full><div className="installment-note">{(() => { const summary = processCancellationSummary(draft, office.finance || []); return <>Contratado: <b>{summary.contracted.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b> · Pago: <b>{summary.paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b> · Devido no cancelamento: <b>{summary.due.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b> · Saldo: <b>{summary.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>{summary.overpaid > 0 ? <> · Pago a maior: <b>{summary.overpaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></> : null}</> })()}</div></Field></> : null}`
    const formPattern = /(<Field label="Status">[\s\S]*?<\/Field>)(<Field label="Financeiro" full>)/
    if (!formPattern.test(source)) throw new Error(`Process cancellation patch failed (cancellation form) in ${path}`)
    source = source.replace(formPattern, `$1${cancellationFields}$2`)
    source = source.replace(
      "onChange={event => setField('status', event.target.value)}",
      "onChange={event => setDraft(current => ({ ...current, status: event.target.value, cancelamentoData: event.target.value === 'Cancelado' ? (current.cancelamentoData || today()) : current.cancelamentoData }))}",
    )
  }

  source = source.replaceAll("!isDone(process.status)", "!processIsClosed(process)")
  source = source.replaceAll("!isDone(normalized.status)", "!processIsClosed(normalized)")

  source = source.replace(
    "<small>{clientName(clientsById.get(String(process.clientId)))} · {process.status || 'Novo'} · prazo {formatDate(process.prazoFinal)}",
    "<small>{clientName(clientsById.get(String(process.clientId)))} · {process.status || 'Novo'}{processIsCancelled(process) ? ` · ${process.cancelamentoPor || 'Cancelado'} · ${formatDate(process.cancelamentoData)}` : ''} · prazo {formatDate(process.prazoFinal)}",
  )

  source = source.replace(
    "<div className=\"process-meta\"><span>Abertura: {formatDate(process.dataAbertura)}</span>",
    "<div className=\"process-meta\"><span>Abertura: {formatDate(process.dataAbertura)}</span>{processIsCancelled(process) ? <><span>Cancelado por: {process.cancelamentoPor || '—'}</span><span>Data do cancelamento: {formatDate(process.cancelamentoData)}</span><span>Motivo: {process.cancelamentoMotivo || '—'}</span>{process.cobradoAParte ? <span>{(() => { const summary = processCancellationSummary(process, office.finance || []); return `Cancelamento: devido ${summary.due.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · pago ${summary.paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · saldo ${summary.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` })()}</span> : null}</> : null}",
  )

  source = '// MED_PROCESS_CANCELLATION_V1\n' + source
  writeFileSync(path, source)
}
