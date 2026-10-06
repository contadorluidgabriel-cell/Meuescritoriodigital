import { readFileSync } from 'node:fs'

export function applyTaskAssigneeSelectPatch(root) {
  const path = `${root}src/components/TasksReactBase.jsx`
  const source = readFileSync(path, 'utf8')
  const keys = ['value={editing.responsavel}', '<Field label="Responsável"', 'responsavel: editing.responsavel.trim()', 'function openNew']
  const snippets = keys.map(key => {
    const index = source.indexOf(key)
    return `### ${key}\n` + (index >= 0 ? source.slice(Math.max(0,index-700), Math.min(source.length,index+1700)) : 'NOT FOUND')
  })
  throw new Error('TASK_ASSIGNEE_FORM_SNIPPETS\n' + snippets.join('\n\n'))
}
