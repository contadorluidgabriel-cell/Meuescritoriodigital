import { test } from 'node:test'
import { readFileSync } from 'node:fs'

test('inspect generated integration anchors', () => {
  const checks = [
    ['src/components/ProcessesReact.jsx', [/function saveProcess\([^\n]+/g, /function Process[^\n]{0,200}/g, /export default function ProcessesReact[^\n]+/g, /<Field label="Status"[^\n]{0,350}/g, /process-meta[^\n]{0,300}/g]],
    ['src/components/TasksReactBase.jsx', [/function saveTask[^\n]{0,250}/g, /function toggleTask[^\n]{0,200}/g, /export default function TasksReactBase[^\n]+/g, /<Field label="Status"[^\n]{0,350}/g]],
    ['src/components/ClientsReact.jsx', [/function Client[^\n]{0,180}/g, /export default function ClientsReact[^\n]+/g, /client-detail[^\n]{0,170}/g]],
  ]
  for (const [path, patterns] of checks) {
    const source = readFileSync(path, 'utf8')
    console.log('FOLLOWUP_INSPECT_FILE', path)
    for (const pattern of patterns) console.log('FOLLOWUP_INSPECT_MATCH', String(pattern), [...source.matchAll(pattern)].slice(0, 3).map(match => match[0]).join('\n').slice(0, 950))
  }
})
