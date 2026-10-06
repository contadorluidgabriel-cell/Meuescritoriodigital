import { readFileSync } from 'node:fs'

export function applyTaskCalendarOnlyAudit(root) {
  const path = `${root}src/components/TasksReactBase.jsx`
  const source = readFileSync(path, 'utf8')
  const index = source.indexOf('appendNextRecurringTask(')
  if (index >= 0) {
    throw new Error('TASK_RECURRENCE_LEGACY_SNIPPET\n' + source.slice(Math.max(0, index - 1200), Math.min(source.length, index + 2200)))
  }
}
