import { test } from 'node:test'
import { readFileSync } from 'node:fs'

test('inspect generated integration anchors', () => {
  const checks = [
    ['src/components/ProcessesReact.jsx', [/function ProcessEditor[^\n]+/g, /function ProcessDetails[^\n]+/g, /export default function ProcessesReact[^\n]+/g, /<ProcessEditor[^\n]{0,600}/g, /<ProcessDetails[^\n]{0,600}/g, /function saveProcess\([^\n]+/g, /const \[draft, setDraft\][^\n]{0,350}/g, /<Field label="Status"[^\n]{0,240}/g, /<div className="process-meta"[^\n]{0,100}/g]],
    ['src/components/TasksReactBase.jsx', [/export default function[^\n]{0,220}/g, /function TasksReact[^\n]{0,220}/g, /function saveTask\(event\)[\s\S]{0,1500}/g, /<Field label="Status"[^\n]{0,240}/g, /<form[^\n]{0,220}/g]],
    ['src/components/ClientsReact.jsx', [/function ClientDetails[^\n]+/g, /<ClientDetails[^\n]{0,500}/g, /export default function ClientsReact[^\n]+/g, /function ClientsReact[^\n]+/g, /<section[^\n]{0,170}/g]],
  ]
  for (const [path, patterns] of checks) {
    const source = readFileSync(path, 'utf8')
    console.log('FOLLOWUP_INSPECT_FILE', path)
    for (const pattern of patterns) console.log('FOLLOWUP_INSPECT_MATCH', String(pattern), [...source.matchAll(pattern)].slice(0, 2).map(match => match[0]).join('\n').slice(0, 1500))
  }
})
