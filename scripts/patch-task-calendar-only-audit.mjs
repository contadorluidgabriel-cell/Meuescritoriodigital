import { readFileSync, writeFileSync } from 'node:fs'

export function applyTaskCalendarOnlyAudit(root) {
  const path = `${root}src/components/TasksReactBase.jsx`
  let source = readFileSync(path, 'utf8')

  source = source.replace(
    "    if (old && !isDone(old.status) && isDone(task.status)) nextTasks = appendNextRecurringTask(nextTasks, task, office.clients)\n",
    '',
  )
  source = source.replace(/appendNextRecurringTask,\s*/g, '')

  if (/appendNextRecurringTask\s*\(/.test(source)) {
    const index = source.indexOf('appendNextRecurringTask(')
    throw new Error('Task calendar-only patch still found legacy recurrence call: ' + source.slice(Math.max(0, index - 500), index + 1000))
  }

  writeFileSync(path, source)
}
