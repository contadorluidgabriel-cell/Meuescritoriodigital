import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label, path) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`Today obligation filter patch failed (${label}) in ${path}`)
  return source.replace(from, to)
}

function patchWorkHorizon(root) {
  const path = `${root}src/components/WorkHorizonBoard.jsx`
  let source = readFileSync(path, 'utf8')

  source = replaceRequired(
    source,
    'function HorizonItem({ item, office, update, onOpenItem, onNotice, onCompleted, day })',
    'function HorizonItem({ item, office, update, onOpenItem, onNotice, onCompleted, day, pendingOnly = false })',
    'work item pending-only prop',
    path,
  )

  source = replaceRequired(
    source,
    "  const openTarget = progress?.firstPendingClientId ? { ...item, clientId: progress.firstPendingClientId } : item",
    "  const openTarget = progress?.firstPendingClientId\n    ? { ...item, clientId: progress.firstPendingClientId, pendingOnly: item.type === 'obligation' && pendingOnly }\n    : item.type === 'obligation' && pendingOnly ? { ...item, pendingOnly: true } : item",
    'pending-only open target',
    path,
  )

  source = replaceRequired(
    source,
    '<HorizonItem key={item.key} item={item} office={office} update={update} onOpenItem={onOpenItem} onNotice={setNotice} onCompleted={registerCompletion} day={day} />',
    '<HorizonItem key={item.key} item={item} office={office} update={update} onOpenItem={onOpenItem} onNotice={setNotice} onCompleted={registerCompletion} day={day} pendingOnly={mode === \'today\'} />',
    'today pending-only routing',
    path,
  )

  writeFileSync(path, source)
}

function patchApp(root) {
  const path = `${root}src/App.jsx`
  let source = readFileSync(path, 'utf8')

  source = replaceRequired(
    source,
    "  const [obligationTarget, setObligationTarget] = useState({ id: '', clientId: '', request: 0 })",
    "  const [obligationTarget, setObligationTarget] = useState({ id: '', clientId: '', pendingOnly: false, request: 0 })",
    'obligation target state',
    path,
  )

  source = replaceRequired(
    source,
    "    setObligationTarget({ id: '', clientId: '', request: 0 })",
    "    setObligationTarget({ id: '', clientId: '', pendingOnly: false, request: 0 })",
    'obligation target reset',
    path,
  )

  source = replaceRequired(
    source,
    "      setObligationTarget(current => ({ id: event.id, clientId: event.clientId || '', request: current.request + 1 }))",
    "      setObligationTarget(current => ({ id: event.id, clientId: event.clientId || '', pendingOnly: Boolean(event.pendingOnly), request: current.request + 1 }))",
    'obligation source routing',
    path,
  )

  source = replaceRequired(
    source,
    "      setObligationTarget(current => ({ id: item.id, clientId: item.clientId || '', request: current.request + 1 }))",
    "      setObligationTarget(current => ({ id: item.id, clientId: item.clientId || '', pendingOnly: false, request: current.request + 1 }))",
    'search opens full obligation',
    path,
  )

  source = replaceRequired(
    source,
    'openObligationRequest={obligationTarget.request} access={access} />',
    'openObligationRequest={obligationTarget.request} initialPendingOnly={Boolean(obligationTarget.pendingOnly)} access={access} />',
    'obligation workspace pending-only prop',
    path,
  )

  writeFileSync(path, source)
}

function patchWorkspace(root) {
  const path = `${root}src/components/ObligationsWorkspace.jsx`
  let source = readFileSync(path, 'utf8')

  source = replaceRequired(
    source,
    'function ClientDetailsModal({ obligation, clientsById, linkedCompaniesById, partners, focusClientId, onClose, onSave })',
    'function ClientDetailsModal({ obligation, clientsById, linkedCompaniesById, partners, focusClientId, pendingOnly = false, onClose, onSave })',
    'details pending-only prop',
    path,
  )

  source = replaceRequired(
    source,
    "  const receiptEnabled = controlsReceipt(obligation)\n  const due = dueInfo(obligation)\n\n  function changeRow(row, patch) {",
    "  const receiptEnabled = controlsReceipt(obligation)\n  const due = dueInfo(obligation)\n  const pendingRowKeys = useMemo(() => new Set((obligation.clientes || []).filter(link => !settledStatus(link.status)).map(link => entityKey(inferLinkType(link, clientsById, linkedCompaniesById), link.clienteId))), [clientsById, linkedCompaniesById, obligation.clientes])\n  const visibleRows = pendingOnly ? rows.filter(row => pendingRowKeys.has(entityKey(inferLinkType(row, clientsById, linkedCompaniesById), row.clienteId))) : rows\n\n  function changeRow(row, patch) {",
    'pending rows selection',
    path,
  )

  source = replaceRequired(
    source,
    '<form className="obligation-client-form obligation-v2-details" onSubmit={submit}><div className="obligation-client-list">{rows.map(row => {',
    '<form className="obligation-client-form obligation-v2-details" onSubmit={submit}><div className="obligation-client-list">{visibleRows.map(row => {',
    'details visible rows',
    path,
  )

  source = replaceRequired(
    source,
    "export default function ObligationsWorkspace({ office, update, sync, onNavigate, initialObligationId = '', initialClientId = '', openObligationRequest = 0, access })",
    "export default function ObligationsWorkspace({ office, update, sync, onNavigate, initialObligationId = '', initialClientId = '', initialPendingOnly = false, openObligationRequest = 0, access })",
    'workspace pending-only prop',
    path,
  )

  source = replaceRequired(
    source,
    "  const openDetails = useCallback((obligation, focusClientId = '') => setDetails({ obligation, focusClientId }), [])",
    "  const openDetails = useCallback((obligation, focusClientId = '', pendingOnly = false) => setDetails({ obligation, focusClientId, pendingOnly }), [])",
    'details source mode',
    path,
  )

  source = replaceRequired(
    source,
    "    if (obligation) { if (obligationIsComplete(obligation)) setTab('history'); openDetails(obligation, initialClientId) }",
    "    if (obligation) { if (obligationIsComplete(obligation)) setTab('history'); openDetails(obligation, initialClientId, initialPendingOnly) }",
    'external details source mode',
    path,
  )

  source = replaceRequired(
    source,
    '  }, [initialClientId, initialObligationId, office.obligations, openDetails, openObligationRequest])',
    '  }, [initialClientId, initialObligationId, initialPendingOnly, office.obligations, openDetails, openObligationRequest])',
    'external details dependencies',
    path,
  )

  source = replaceRequired(
    source,
    'focusClientId={details.focusClientId} onClose={() => setDetails(null)} onSave={saveClientDetails} key={`${details.obligation.id}-${details.focusClientId}`} />',
    'focusClientId={details.focusClientId} pendingOnly={Boolean(details.pendingOnly)} onClose={() => setDetails(null)} onSave={saveClientDetails} key={`${details.obligation.id}-${details.focusClientId}-${details.pendingOnly ? \'pending\' : \'all\'}`} />',
    'details pending-only render',
    path,
  )

  writeFileSync(path, source)
}

export function applyTodayObligationFilterPatch(root) {
  patchWorkHorizon(root)
  patchApp(root)
  patchWorkspace(root)
}
