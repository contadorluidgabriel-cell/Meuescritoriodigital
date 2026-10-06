import { readFileSync, writeFileSync } from 'node:fs'

export function applyRemoveExternalTaskSyncPatch(root) {
  const taskPath = `${root}src/components/TasksReactBase.jsx`
  let source = readFileSync(taskPath, 'utf8')

  const debugIndex = source.indexOf('useGoogleTasks')
  if (debugIndex >= 0) throw new Error('GOOGLE_HOOK_SNIPPET\n' + source.slice(Math.max(0, debugIndex - 500), Math.min(source.length, debugIndex + 1700)))
  source = source.replace(/\s*<section className="google-tasks-card">[\s\S]*?<\/section>\s*/g, '\n')

  source = source
    .replace(/import\s+\{\s*useGoogleTasks\s*\}\s+from\s+['"][^'"]+useGoogleTasks\.js['"]\s*;?\n?/g, '')
    .replace(/,\s*reconcileGoogleTaskPayload/g, '')
    .replace(/reconcileGoogleTaskPayload\s*,\s*/g, '')

  source = source.replace(/\n\s*const\s+reconcileGoogleTasks\s*=\s*useCallback\(\(remoteTasks, currentTasks\)\s*=>\s*\{[\s\S]*?\n\s*\},\s*\[office\.clients\]\)\s*;?/g, '\n')
  source = source.replace(/\n\s*const\s+google\s*=\s*useGoogleTasks\(\{[\s\S]*?\n\s*\}\)\s*;?/g, '\n')
  source = source.replace(/^.*google\.schedule\([^\n]*\)\s*;?\s*$/gm, '')

  if (/useGoogleTasks|google\.|Google Tasks|reconcileGoogleTaskPayload|google-tasks-card/.test(source)) {
    const match = source.match(/.{0,180}(?:useGoogleTasks|google\.|Google Tasks|reconcileGoogleTaskPayload|google-tasks-card).{0,260}/s)
    throw new Error(`External task sync removal incomplete in ${taskPath}: ${match?.[0] || 'remaining reference'}`)
  }

  writeFileSync(taskPath, source)
}
