import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`Daily target visibility patch failed (${label})`)
  return source.replace(from, to)
}

export function applyDailyTargetVisibilityPatch(root) {
  const componentPath = `${root}src/components/ObligationAccordionList.jsx`
  let component = readFileSync(componentPath, 'utf8')
  component = replaceOnce(
    component,
    '`Meta definida ${productivity.dailyGoalToday} · feitas ${productivity.doneToday} · faltam ${Math.max(0, productivity.dailyGoalToday - productivity.doneToday)} · ritmo necessário ${productivity.requiredToday}/dia${productivity.goalBelowRequired ? \' · META ABAIXO DO NECESSÁRIO\' : \'\'}`',
    '`Meta diária: ${productivity.dailyGoalToday} pessoas · feitas hoje: ${productivity.doneToday} · faltam hoje: ${Math.max(0, productivity.dailyGoalToday - productivity.doneToday)} · necessário: ${productivity.requiredToday}/dia${productivity.goalBelowRequired ? \' · META ABAIXO DO NECESSÁRIO\' : \'\'}`',
    'daily goal label',
  )
  writeFileSync(componentPath, component)

  const cssPath = `${root}src/components/obligation-accordion-list.css`
  let css = readFileSync(cssPath, 'utf8')
  const oldRule = '.obligation-accordion-rhythm{'
  if (!css.includes('.obligation-accordion-rhythm{font-size:11px;font-weight:700;color:#2456e8')) {
    if (!css.includes(oldRule)) throw new Error('Daily target visibility patch failed (rhythm style)')
    css = css.replace(oldRule, '.obligation-accordion-rhythm{font-size:11px;font-weight:700;color:#2456e8;')
    writeFileSync(cssPath, css)
  }
}
