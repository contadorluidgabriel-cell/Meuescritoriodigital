import { readFileSync, writeFileSync } from 'node:fs'

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Multiuser Finance V2 patch failed (${label})`)
  return source.replace(from, to)
}

export function applyMultiuserFinanceV2Patch(root) {
  const chromePath = `${root}src/components/AppChrome.jsx`
  let chrome = readFileSync(chromePath, 'utf8')
  if (!chrome.includes('finance_receivables || permissions.finance_payables')) {
    chrome = replaceOrFail(
      chrome,
      "    if (permissions.finance) management.push(item('honorarios', 'Financeiro', 'finance'))",
      "    if (permissions.finance_receivables || permissions.finance_payables || permissions.finance_cash || permissions.finance_reports || permissions.finance) management.push(item('honorarios', 'Financeiro', 'finance'))",
      'finance navigation',
    )
  }
  if (!chrome.includes("role === 'pending'")) {
    const compactAnchor = "  const role = membership.role || 'admin'\n  const permissions = membership.permissions || {}\n  if (role === 'partner') return ["
    const spacedAnchor = "  const role = membership.role || 'admin'\n  const permissions = membership.permissions || {}\n\n  if (role === 'partner') return ["
    const replacement = "  const role = membership.role || 'pending'\n  const permissions = membership.permissions || {}\n\n  if (role === 'pending') return [\n    { label: 'Visão geral', items: [common.myDay, common.calendar] },\n  ]\n\n  if (role === 'partner') return ["
    if (chrome.includes(compactAnchor)) chrome = chrome.replace(compactAnchor, replacement)
    else if (chrome.includes(spacedAnchor)) chrome = chrome.replace(spacedAnchor, replacement)
    else throw new Error('Multiuser Finance V2 patch failed (pending access navigation)')
    chrome = chrome.replace("  const role = access?.membership?.role || 'admin'", "  const role = access?.membership?.role || 'pending'")
  }
  writeFileSync(chromePath, chrome)

  const appPath = `${root}src/App.jsx`
  let app = readFileSync(appPath, 'utf8')
  if (!app.includes('const scopedFinanceAdmin =')) {
    app = replaceOrFail(
      app,
      "    if (access?.membership?.role === 'collaborator' && !access?.membership?.permissions?.finance) return",
      "    const scopedFinanceAdmin = access?.membership?.role === 'admin' && access?.membership?.permissions?.access_v2 === true && String(access?.membership?.user_id || '') !== String(access?.workspace?.owner_user_id || '')\n    if ((access?.membership?.role === 'collaborator' || scopedFinanceAdmin) && !(access?.membership?.permissions?.finance_receivables || access?.membership?.permissions?.finance_payables || access?.membership?.permissions?.finance_cash || access?.membership?.permissions?.finance_reports || access?.membership?.permissions?.finance)) return",
      'finance route scope',
    )
    app = replaceOrFail(
      app,
      "<FinanceReact office={office} update={update} sync={sync} initialClientId={financeTarget.clientId} openClientRequest={financeTarget.request} openNewRequest={financeTarget.newRequest} />",
      "<FinanceReact office={office} update={update} sync={sync} access={access} initialClientId={financeTarget.clientId} openClientRequest={financeTarget.request} openNewRequest={financeTarget.newRequest} />",
      'finance access prop',
    )
    writeFileSync(appPath, app)
  }

  const financePath = `${root}src/components/FinanceCompleteReact.jsx`
  let finance = readFileSync(financePath, 'utf8')
  if (!finance.includes('const fullFinanceAdmin =')) {
    finance = replaceOrFail(
      finance,
      "export default function FinanceCompleteReact({ office, update, sync, initialClientId = '', openClientRequest = 0, openNewRequest = 0 }) {\n  const day = today()\n  const [tab, setTab] = useState('overview')",
      "export default function FinanceCompleteReact({ office, update, sync, access = {}, initialClientId = '', openClientRequest = 0, openNewRequest = 0 }) {\n  const day = today()\n  const role = access?.membership?.role || 'admin'\n  const permissions = access?.membership?.permissions || {}\n  const ownerUserId = String(access?.workspace?.owner_user_id || '')\n  const memberUserId = String(access?.membership?.user_id || '')\n  const scopedAdmin = role === 'admin' && permissions.access_v2 === true && Boolean(memberUserId) && memberUserId !== ownerUserId\n  const fullFinanceAdmin = role === 'admin' && !scopedAdmin\n  const canReceive = fullFinanceAdmin || Boolean(permissions.finance_receivables ?? permissions.finance)\n  const canPay = fullFinanceAdmin || Boolean(permissions.finance_payables)\n  const canCash = fullFinanceAdmin || Boolean(permissions.finance_cash)\n  const canReports = fullFinanceAdmin || Boolean(permissions.finance_reports)\n  const canOverview = fullFinanceAdmin || canCash\n  const visibleTabs = useMemo(() => tabs.filter(([id]) => fullFinanceAdmin || (id === 'receber' && canReceive) || (id === 'pagar' && canPay) || ((id === 'overview' || id === 'movimentos' || id === 'fluxo') && canCash) || (id === 'relatorios' && canReports)), [fullFinanceAdmin, canReceive, canPay, canCash, canReports])\n  const firstTab = visibleTabs[0]?.[0] || 'receber'\n  const [tab, setTab] = useState(() => firstTab)",
      'finance access signature',
    )
    finance = replaceOrFail(
      finance,
      "  const [creatingPayable, setCreatingPayable] = useState(false)",
      "  const [creatingPayable, setCreatingPayable] = useState(false)\n  useEffect(() => { if (!visibleTabs.some(([id]) => id === tab)) setTab(firstTab) }, [firstTab, tab, visibleTabs])",
      'finance tab guard',
    )
    finance = finance.replace('<nav className="fc-tabs">{tabs.map(', '<nav className="fc-tabs">{visibleTabs.map(')
    finance = finance.replace("{tab === 'overview' ?", "{canOverview && tab === 'overview' ?")
    finance = finance.replace("{tab === 'receber' ?", "{canReceive && tab === 'receber' ?")
    finance = finance.replace("{tab === 'pagar' ?", "{canPay && tab === 'pagar' ?")
    finance = finance.replace("{tab === 'movimentos' ?", "{canCash && tab === 'movimentos' ?")
    finance = finance.replace("{tab === 'fluxo' ?", "{canCash && tab === 'fluxo' ?")
    finance = finance.replace("{tab === 'parceiros' ?", "{fullFinanceAdmin && tab === 'parceiros' ?")
    finance = finance.replace("{tab === 'relatorios' ?", "{canReports && tab === 'relatorios' ?")
    finance = finance.replace("{tab === 'config' ?", "{fullFinanceAdmin && tab === 'config' ?")
    finance = replaceOrFail(
      finance,
      '<button type="button" onClick={() => setCreatingMovement(true)}>+ Movimentação</button>',
      '{canCash ? <button type="button" onClick={() => setCreatingMovement(true)}>+ Movimentação</button> : null}',
      'movement action guard',
    )
    writeFileSync(financePath, finance)
  }
}
