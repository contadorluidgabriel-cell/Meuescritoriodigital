import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label, path) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`Expediente daily target patch failed (${label}) in ${path}`)
  return source.replace(from, to)
}

export function applyTodayExpedienteDailyTargetPatch(root) {
  const path = `${root}src/components/WorkHorizonBoard.jsx`
  let source = readFileSync(path, 'utf8')

  source = replaceRequired(
    source,
    "import { updateObligationLinkQuantity } from '../lib/obligationQuantity.js'",
    "import { updateObligationLinkQuantity } from '../lib/obligationQuantity.js'\nimport { obligationProductivity } from '../lib/obligationProductivity.js'",
    'productivity import',
    path,
  )

  source = replaceRequired(
    source,
    "  const progress = item.type === 'obligation' ? obligationProgress(office, item.id) : null",
    "  const progress = item.type === 'obligation' ? obligationProgress(office, item.id) : null\n  const obligationRecord = item.type === 'obligation' ? (office.obligations || []).find(row => String(row.id) === String(item.id)) : null\n  const dailyProductivity = obligationRecord?.quantitativo ? obligationProductivity(obligationRecord, day) : null",
    'daily productivity calculation',
    path,
  )

  source = replaceRequired(
    source,
    "      {item.type === 'obligation' && progress?.quantitative ? <div className=\"v12-obligation-rhythm-block\"><small className=\"v12-obligation-rhythm\">{progress.firstPendingOverdue ? <><b>{progress.pendingPeople}</b> pessoas pendentes · prazo vencido</> : <><b>{progress.firstPendingRequiredPerDay}</b> pessoas por dia para concluir até {dateLabel(progress.obligation?.vencimento || progress.openLinks?.[0]?.vencimento || '')}</>}</small></div> : null}",
    "      {item.type === 'obligation' && progress?.quantitative ? <div className=\"v12-obligation-rhythm-block\"><small className=\"v12-obligation-rhythm\">{progress.firstPendingOverdue ? <><b>{progress.pendingPeople}</b> pessoas pendentes · prazo vencido</> : <><b>{progress.firstPendingRequiredPerDay}</b> pessoas por dia para concluir até {dateLabel(progress.obligation?.vencimento || progress.openLinks?.[0]?.vencimento || '')}</>}</small>{dailyProductivity && !dailyProductivity.completedAll ? <small className=\"v12-obligation-daily-target\"><b>Meta diária: {dailyProductivity.dailyGoalToday} pessoas</b> · feitas hoje: {dailyProductivity.doneToday} · faltam hoje: {Math.max(0, dailyProductivity.dailyGoalToday - dailyProductivity.doneToday)}{dailyProductivity.goalBelowRequired ? ' · META ABAIXO DO NECESSÁRIO' : ''}</small> : null}</div> : null}",
    'visible daily goal in today card',
    path,
  )

  const cssPath = `${root}src/work-horizon-v12.css`
  let css = readFileSync(cssPath, 'utf8')
  const marker = '.v12-obligation-daily-target{'
  if (!css.includes(marker)) {
    css += '\n.v12-obligation-daily-target{display:block;margin-top:5px;color:#2456e8;font-size:11px;line-height:1.45;font-weight:600}.v12-obligation-daily-target b{font-weight:800}\n'
    writeFileSync(cssPath, css)
  }
  writeFileSync(path, source)
}
