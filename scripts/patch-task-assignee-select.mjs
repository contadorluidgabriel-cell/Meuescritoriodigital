import { readFileSync } from 'node:fs'

export function applyTaskAssigneeSelectPatch(root) {
  const path = `${root}src/components/TasksReactBase.jsx`
  const source = readFileSync(path, 'utf8')
  const keys = ['function openNew', 'Responsável', 'responsavelUserId', 'function saveTask']
  const snippets = keys.map(key => {
    const index = source.indexOf(key)
    return `### ${key}\n` + (index >= 0 ? source.slice(Math.max(0,index-900), Math.min(source.length,index+1800)) : 'NOT FOUND')
  })
  throw new Error('TASK_ASSIGNEE_SNIPPETS\n' + snippets.join('\n\n'))
}

// trigger inspection
