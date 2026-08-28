import { readFileSync, writeFileSync } from 'node:fs'

export function applyQuantitativeDuplicatePatch(root) {
  const path = `${root}src/components/TasksReactBase.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes("quantidadeConcluida: task.quantitativo ? 0 : task.quantidadeConcluida")) return
  const from = "const copy = { ...structuredClone(task), id: uid('tar'), titulo: `${task.titulo} (cópia)`, status: 'Pendente', recorrencia: '', subtarefas: (task.subtarefas || []).map(item => ({ ...item, id: uid('sub'), concluida: false })), updatedAt: new Date().toISOString() }"
  const to = "const copy = { ...structuredClone(task), id: uid('tar'), titulo: `${task.titulo} (cópia)`, status: 'Pendente', recorrencia: '', quantidadeConcluida: task.quantitativo ? 0 : task.quantidadeConcluida, subtarefas: (task.subtarefas || []).map(item => ({ ...item, id: uid('sub'), concluida: false })), updatedAt: new Date().toISOString() }"
  if (!source.includes(from)) throw new Error('Quantitative duplicate patch failed')
  source = source.replace(from, to)
  writeFileSync(path, source)
}
