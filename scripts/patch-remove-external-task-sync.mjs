import { readFileSync, writeFileSync } from 'node:fs'

function removeGooglePanel(source, path) {
  const marker = 'Tarefas com data aparecem no Calendar; título, prazo e conclusão são sincronizados.'
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) return source

  const functionStart = source.lastIndexOf('\nfunction ', markerIndex)
  const functionEnd = source.indexOf('\n}', markerIndex)
  if (functionStart < 0 || functionEnd < 0) {
    throw new Error(`External task sync removal failed to isolate Google panel in ${path}`)
  }

  return source.slice(0, functionStart) + source.slice(functionEnd + 2)
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
