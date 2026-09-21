import { readFileSync, writeFileSync } from 'node:fs'

export function applyFollowUpsFinalPatch(root) {
  const path = `${root}src/components/TasksReactBase.jsx`
  const source = readFileSync(path, 'utf8')
  if (source.includes('MED_RESULT_FOLLOWUPS_TASK_DETAIL_V1')) return
  const before = '<form className="task-form" onSubmit={saveTask}>'
  if (!source.includes(before)) throw new Error('Follow-ups final patch: task editor form not found')
  writeFileSync(path, source.replace(before, '<form className="task-form" onSubmit={saveTask}>{editing?.id ? <FollowUpLinked records={followUps?.records} sourceType="task" sourceId={editing.id} onOpen={onOpenFollowUp} /> : null}{/* MED_RESULT_FOLLOWUPS_TASK_DETAIL_V1 */}'))
}
