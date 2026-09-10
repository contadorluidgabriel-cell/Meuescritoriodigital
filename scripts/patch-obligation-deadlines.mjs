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
    const oldTopbar = "    <div className=\"react-module-topbar\"><div><h1>Obrigações</h1><p>Uma obrigação, vários clientes, vencimentos e status individuais.</p></div><div className=\"react-module-actions\"><span className=\"sync-indicator\">{sync}</span><button type=\"button\" className=\"primary\" onClick={openNew}>+ Nova obrigação</button></div></div>"
    const newTopbar = "    <div className=\"react-module-topbar\"><div><h1>Obrigações</h1><p>Uma obrigação, vários vínculos, vencimentos e status individuais.</p></div><div className=\"react-module-actions\"><span className=\"sync-indicator\">{sync}</span><button type=\"button\" className=\"primary\" onClick={openNew}>+ Nova obrigação</button></div></div>"
    const topbar = obligations.includes(newTopbar) ? newTopbar : oldTopbar
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

  // O centro operacional deve mostrar o nome do CNPJ terceirizado sem tratá-lo
  // como cliente da carteira nos indicadores de risco.
  const intelligencePath = `${root}src/lib/operationalIntelligence.js`
  let intelligence = readFileSync(intelligencePath, 'utf8')
  const linkedMarker = "const linkedCompanies = new Map((office.linkedCompanies || []).map(company => [String(company.id), company]))"
  if (!intelligence.includes(linkedMarker)) {
    const clientsAnchor = "export function collectOperationalWork(office = {}, { day = today(), includeDone = false } = {}) {\n  const clients = new Map((office.clients || []).map(client => [String(client.id), client]))"
    if (!intelligence.includes(clientsAnchor)) throw new Error('Obligation deadlines patch failed (operational clients anchor)')
    intelligence = intelligence.replace(clientsAnchor, `${clientsAnchor}\n  ${linkedMarker}`)

    const foreachAnchor = "  ;(office.obligations || []).forEach(obligation => {\n    ;(obligation.clientes || []).forEach(link => {\n      const done = obligationDone(link)"
    if (!intelligence.includes(foreachAnchor)) throw new Error('Obligation deadlines patch failed (operational obligation anchor)')
    intelligence = intelligence.replace(foreachAnchor, "  ;(office.obligations || []).forEach(obligation => {\n    ;(obligation.clientes || []).forEach(link => {\n      const linkId = String(link.clienteId || '')\n      const entityType = link.entityType === 'linkedCompany' || link.entidadeTipo === 'terceirizado' || (!clients.has(linkId) && linkedCompanies.has(linkId)) ? 'linkedCompany' : 'client'\n      const done = obligationDone(link)")

    intelligence = intelligence.replace("key: `obligation:${obligation.id}:${link.clienteId}`,", "key: `obligation:${obligation.id}:${linkId}`,")
    intelligence = intelligence.replace("clientId: String(link.clienteId || ''),\n        client: clientName(clients.get(String(link.clienteId))),", "clientId: linkId,\n        entityType,\n        client: entityType === 'linkedCompany' ? clientName(linkedCompanies.get(linkId)) : clientName(clients.get(linkId)),")
    intelligence = intelligence.replace("pending.filter(item => item.level === 'critical' && item.clientId).forEach", "pending.filter(item => item.level === 'critical' && item.clientId && item.entityType !== 'linkedCompany').forEach")
    writeFileSync(intelligencePath, intelligence)
  }
}
