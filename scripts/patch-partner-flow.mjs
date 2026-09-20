import { readFileSync, writeFileSync } from 'node:fs'
import { applyClientDeletionPatch } from './patch-client-deletion.mjs'

export function applyPartnerFlowPatch(root) {
  // Este é o último patch de vite.config.js: os anchors do cadastro já estão estabilizados.
  applyClientDeletionPatch(root)
  const path = `${root}src/components/FinanceCompleteReact.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes('<PartnerFlowReact office={office} partnerBalances={partnerBalances} />')) return
  const importAnchor = "import FinanceProReact from './FinanceProReact.jsx'"
  // A proteção multiusuário antecede a condição de aba com fullFinanceAdmin &&.
  const partnerStart = source.indexOf("tab === 'parceiros' ?")
  const nextSection = partnerStart >= 0 ? source.indexOf("tab === 'relatorios' ?", partnerStart) : -1
  const partnerEnd = nextSection >= 0 ? source.lastIndexOf('</section>', nextSection) : -1
  if (!source.includes(importAnchor) || partnerStart < 0 || partnerEnd < partnerStart) {
    throw new Error('Partner flow patch failed: financial partner section changed')
  }
  source = source.slice(0, partnerEnd) + '<PartnerFlowReact office={office} partnerBalances={partnerBalances} />' + source.slice(partnerEnd)
  source = source.replace(importAnchor, `${importAnchor}\nimport PartnerFlowReact from './PartnerFlowReact.jsx'`)
  writeFileSync(path, source)
}
