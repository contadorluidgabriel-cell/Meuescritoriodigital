import { readFileSync, writeFileSync } from 'node:fs'

export function applyRemoveExternalTaskSyncPatch(root) {
  const taskPath = `${root}src/components/TasksReactBase.jsx`
  let source = readFileSync(taskPath, 'utf8')

  source = source
    .replace(/import\s+\{\s*useGoogleTasks\s*\}\s+from\s+['"][^'"]+useGoogleTasks\.js['"]\s*;?\n?/g, '')
    .replace(/,\s*reconcileGoogleTaskPayload/g, '')
    .replace(/reconcileGoogleTaskPayload\s*,\s*/g, '')

  source = source.replace(/\n\s*const\s+google\s*=\s*useGoogleTasks\(\{[\s\S]*?\n\s*\}\)\s*;?/g, '\n')
  source = source.replace(/^.*google\.schedule\([^\n]*\)\s*;?\s*$/gm, '')

  source = source.replace(/\{google\.connected\s*\?[\s\S]*?\:\s*null\}/g, 'null')
  source = source.replace(/\{!google\.connected\s*\?[\s\S]*?\:\s*null\}/g, 'null')
  source = source.replace(/<button[^>]*onClick=\{google\.[^}]+\}[^>]*>[\s\S]*?<\/button>/g, '')
  source = source.replace(/<[^>]+className=["'][^"']*(?:google|sync)[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi, match =>
    /google\.|Google Tasks|Sincroniz|Conectar Google|Desconectar Google/i.test(match) ? '' : match
  )
  source = source.replace(/<p>Tarefas com data aparecem no Calendar; título, prazo e conclusão são sincronizados\.<\/p><small className=\{!google\.configured \? 'error' : ''\}>\{google\.message\}<\/small>/g, '<p>As tarefas são gerenciadas exclusivamente no MED.</p>')
  source = source.replace(/<div className="google-actions">\s*null\s*<\/div>/g, '')
  source = source.replace(/<[^>]+>[\s\S]*?(?:Google Tasks|Google conectado|Google ainda não conectado|Sincronizar Google)[\s\S]*?<\/[^>]+>/gi, '')

  if (/useGoogleTasks|google\.|Google Tasks|reconcileGoogleTaskPayload/.test(source)) {
    const match = source.match(/.{0,180}(?:useGoogleTasks|google\.|Google Tasks|reconcileGoogleTaskPayload).{0,260}/s)
    throw new Error(`External task sync removal incomplete in ${taskPath}: ${match?.[0] || 'remaining reference'}`)
  }

  writeFileSync(taskPath, source)
}
