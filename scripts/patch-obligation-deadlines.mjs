import { readFileSync, writeFileSync } from 'node:fs'

export function applyObligationDeadlinesPatch(root) {
  const obligationsPath = `${root}src/components/ObligationsReact.jsx`
  let obligations = readFileSync(obligationsPath, 'utf8')

  const importMarker = "import ObligationDeadlinesBoard from './ObligationDeadlinesBoard.jsx'"
  if (!obligations.includes(importMarker)) {
    const anchor = "import { formatCnpj, thirdPartyError } from '../lib/thirdPartyWork.js'"
    if (!obligations.includes(anchor)) throw new Error('Obligation deadlines patch failed (import anchor)')
    obligations = obligations.replace(anchor, `${anchor}\n${importMarker}`)
  }

  const signatureFrom = "export default function ObligationsReact({ office, update, sync, initialObligationId = '', initialClientId = '', openObligationRequest = 0 })"
  const signatureTo = "export default function ObligationsReact({ office, update, sync, onNavigate, initialObligationId = '', initialClientId = '', openObligationRequest = 0 })"
  if (obligations.includes(signatureFrom)) obligations = obligations.replace(signatureFrom, signatureTo)
  else if (!obligations.includes(signatureTo)) throw new Error('Obligation deadlines patch failed (component signature)')

  const boardMarker = '<ObligationDeadlinesBoard office={office}'
  if (!obligations.includes(boardMarker)) {
    const topbar = "    <div className=\"react-module-topbar\"><div><h1>Obrigações</h1><p>Uma obrigação, vários clientes, vencimentos e status individuais.</p></div><div className=\"react-module-actions\"><span className=\"sync-indicator\">{sync}</span><button type=\"button\" className=\"primary\" onClick={openNew}>+ Nova obrigação</button></div></div>"
    if (!obligations.includes(topbar)) throw new Error('Obligation deadlines patch failed (topbar anchor)')
    const board = `${topbar}\n    <ObligationDeadlinesBoard office={office} onNavigate={onNavigate} onOpenObligation={(obligationId, clientId) => { const obligation = (office.obligations || []).find(item => String(item.id) === String(obligationId)); if (obligation) openDetails(obligation, clientId) }} />`
    obligations = obligations.replace(topbar, board)
  }
  writeFileSync(obligationsPath, obligations)

  const appPath = `${root}src/App.jsx`
  let app = readFileSync(appPath, 'utf8')
  const propMarker = 'onNavigate={navigate} initialObligationId={obligationTarget.id}'
  if (!app.includes(propMarker)) {
    const from = "{view === 'obrigacoes' ? <ObligationsReact office={office} update={update} sync={sync} initialObligationId={obligationTarget.id}"
    const to = "{view === 'obrigacoes' ? <ObligationsReact office={office} update={update} sync={sync} onNavigate={navigate} initialObligationId={obligationTarget.id}"
    if (!app.includes(from)) throw new Error('Obligation deadlines patch failed (app navigation)')
    app = app.replace(from, to)
    writeFileSync(appPath, app)
  }
}
