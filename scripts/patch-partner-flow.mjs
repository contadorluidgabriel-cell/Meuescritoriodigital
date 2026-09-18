import { readFileSync, writeFileSync } from 'node:fs'

export function applyPartnerFlowPatch(root) {
  const path = `${root}src/components/FinanceCompleteReact.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes('<PartnerFlowReact office={office} partnerBalances={partnerBalances} />')) return
  const importAnchor = "import FinanceProReact from './FinanceProReact.jsx'"
  const sectionAnchor = "</div></section> : null}\n\n    {tab === 'relatorios' ?"
  if (!source.includes(importAnchor) || !source.includes(sectionAnchor)) {
    throw new Error('Partner flow patch failed: financial partner section changed')
  }
  source = source.replace(importAnchor, `${importAnchor}\nimport PartnerFlowReact from './PartnerFlowReact.jsx'`)
  source = source.replace(sectionAnchor, "</div><PartnerFlowReact office={office} partnerBalances={partnerBalances} /></section> : null}\n\n    {tab === 'relatorios' ?")
  writeFileSync(path, source)
}
