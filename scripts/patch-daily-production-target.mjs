import { readFileSync } from 'node:fs'

export function applyDailyProductionTargetPatch(root) {
  const productivity = readFileSync(root + 'src/lib/obligationProductivity.js', 'utf8')
  const workspace = readFileSync(root + 'src/components/ObligationsWorkspace.jsx', 'utf8')
  const accordion = readFileSync(root + 'src/components/ObligationAccordionList.jsx', 'utf8')
  if (!productivity.includes('const savedDailyGoal = integer(link.metaDiariaPersonalizada)')) {
    throw new Error('Daily production target missing: productivity calculation')
  }
  if (!workspace.includes('Meta diária personalizada') || !workspace.includes('metaDiariaPersonalizada')) {
    throw new Error('Daily production target missing: editable and persisted field')
  }
  if (!accordion.includes('ritmo necessário') || !accordion.includes('META ABAIXO DO NECESSÁRIO')) {
    throw new Error('Daily production target missing: pace and warning display')
  }
}
