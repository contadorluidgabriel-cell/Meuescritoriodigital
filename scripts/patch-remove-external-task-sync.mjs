import { readFileSync, writeFileSync } from 'node:fs'

export function applyRemoveExternalTaskSyncPatch(root) {
  const taskPath = `${root}src/components/TasksReactBase.jsx`
  let source = readFileSync(taskPath, 'utf8')

  source = source.replace(/\s*<section className="google-tasks-card">[\s\S]*?<\/section>\s*/g, '\n')

  source = source
    .replace(/import\s+\{\s*useGoogleTasks\s*\}\s+from\s+['"][^'"]+useGoogleTasks\.js['"]\s*;?\n?/g, '')
    .replace(/,\s*reconcileGoogleTaskPayload/g, '')
    .replace(/reconcileGoogleTaskPayload\s*,\s*/g, '')

  source = source.replace("  const reconcileGoogleTasks = useCallback((remoteTasks, currentTasks) => {\n    return reconcileGoogleTaskPayload(remoteTasks, currentTasks, office.clients)\n  }, [office.clients])\n", '')
  source = source.replace("  const google = useGoogleTasks({ enabled: Boolean(session), tasks: office.tasks, update, reconcileTasks: reconcileGoogleTasks })\n", '')
  source = source.replace(/^.*google\.schedule\([^\n]*\)\s*;?\s*$/gm, '')

  if (/useGoogleTasks|google\.|Google Tasks|reconcileGoogleTaskPayload|google-tasks-card/.test(source)) {
    const match = source.match(/.{0,180}(?:useGoogleTasks|google\.|Google Tasks|reconcileGoogleTaskPayload|google-tasks-card).{0,260}/s)
    throw new Error(`External task sync removal incomplete in ${taskPath}: ${match?.[0] || 'remaining reference'}`)
  }

  writeFileSync(taskPath, source)
}
