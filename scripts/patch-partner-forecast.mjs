import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, before, after, label, path) {
  if (source.includes(after)) return source
  if (!source.includes(before)) throw new Error(`Partner forecast patch failed (${label}) in ${path}`)
  return source.replace(before, after)
}

export function applyPartnerForecastPatch(root) {
  const path = `${root}src/lib/financeComplete.js`
  let source = readFileSync(path, 'utf8')
  source = replaceRequired(source,
    "import { officeCustomerCash, partnerAllocation, partnerSettlementCash } from './partnerAccounting.js'",
    "import { officeCustomerCash, partnerAllocation, partnerSettlementCash, projectedPartnerAmounts } from './partnerAccounting.js'",
    'forecast allocation import', path)
  source = replaceRequired(source,
    "export function forecastCash(office = {}, { day = '', days = 30 } = {}) {\n  const end = endDateFromDays(day, days)\n  const current = accountBalances(office, day).reduce((sum, account) => sum + Number(account.saldoAtual || 0), 0)\n  let incoming = 0, outgoing = 0",
    "export function forecastCash(office = {}, { day = '', days = 30 } = {}) {\n  const end = endDateFromDays(day, days)\n  const current = accountBalances(office, day).reduce((sum, account) => sum + Number(account.saldoAtual || 0), 0)\n  const clientsById = new Map((office.clients || []).map(client => [String(client.id), client]))\n  let incoming = 0, outgoing = 0",
    'forecast client lookup', path)
  source = replaceRequired(source,
    "    incoming += paymentSummary(charge).balance\n  })\n  ;(office.financePayables || []).forEach(payable => {",
    "    const projected = projectedPartnerAmounts(charge, clientsById.get(String(charge.clienteId)) || {})\n    incoming += projected.incoming\n    outgoing += projected.outgoing\n  })\n  ;(office.financePayables || []).forEach(payable => {",
    'forecast incoming and outgoing allocation', path)
  writeFileSync(path, source)

  const receivablePath = `${root}src/components/FinanceProReact.jsx`
  let receivables = readFileSync(receivablePath, 'utf8')
  receivables = replaceRequired(receivables,
    "import { today, uid } from '../lib/storage.js'",
    "import { today, uid } from '../lib/storage.js'\nimport { partnerForecast30Days } from '../lib/partnerAccounting.js'",
    'receivable forecast import', receivablePath)
  receivables = replaceRequired(receivables,
    "const forecast = useMemo(() => forecast30Days(finance, day), [day, finance])",
    "const forecast = useMemo(() => partnerForecast30Days(finance, clients, day), [clients, day, finance])",
    'receivable forecast net share', receivablePath)
  receivables = replaceRequired(receivables,
    '<span>Previsão global de recebimento</span>',
    '<span>Participação estimada do escritório; repasses sujeitos à quitação e à confirmação do acerto.</span>',
    'receivable forecast caveat', receivablePath)
  writeFileSync(receivablePath, receivables)
}
