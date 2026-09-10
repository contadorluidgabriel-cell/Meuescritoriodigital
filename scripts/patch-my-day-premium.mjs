import { readFileSync, writeFileSync } from 'node:fs'

export function applyMyDayPremiumPatch(root) {
  const path = `${root}src/App.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes("import './my-day-premium.css'")) return
  const marker = "import './operational-command-center.css'"
  if (!source.includes(marker)) throw new Error('My Day premium patch failed (operational styles import)')
  source = source.replace(marker, `${marker}\nimport './my-day-premium.css'`)
  writeFileSync(path, source)
}
