import { readFileSync, writeFileSync } from 'node:fs'

function removeGooglePanel(source, path) {
  const marker = 'Tarefas com data aparecem no Calendar; título, prazo e conclusão são sincronizados.'
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) return source

  throw new Error('GOOGLE_PANEL_SNIPPET\n' + source.slice(Math.max(0, markerIndex - 900), Math.min(source.length, markerIndex + 1300)))
}

export function applyRemoveExternalTaskSyncPatch(root) {
  const taskPath = `${root}src/components/TasksReactBase.jsx`
  let source = readFileSync(taskPath, 'utf8')

  source = removeGooglePanel(source, taskPath)

  source = source
    .replace(/import\s+\{\s*useGoogleTasks\s*\}\s+from\s+['"][^'"]+useGoogleTasks\.js['"]\s*;?\n?/g, '')
    .replace(/,\s*reconcileGoogleTaskPayload/g, '')
    .replace(/reconcileGoogleTaskPayload\s*,\s*/g, '')

  source = source.replace(/\n\s*const\s+google\s*=\s*useGoogleTasks\(\{[\s\S]*?\n\s*\}\)\s*;?/g, '\n')
  source = source.replace(/^.*google\.schedule\([^\n]*\)\s*;?\s*$/gm, '')
  source = source.replace(/\{\s*google\.[^}]+\}/g, 'null')

  if (/useGoogleTasks|google\.|Google Tasks|reconcileGoogleTaskPayload/.test(source)) {
    const match = source.match(/.{0,180}(?:useGoogleTasks|google\.|Google Tasks|reconcileGoogleTaskPayload).{0,260}/s)
    throw new Error(`External task sync removal incomplete in ${taskPath}: ${match?.[0] || 'remaining reference'}`)
  }

  writeFileSync(taskPath, source)
}
