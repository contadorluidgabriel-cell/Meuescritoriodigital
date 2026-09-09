import { readFileSync } from 'node:fs'

export function applyV121Patch(root) {
  const path = `${root}src/components/ProcessesReact.jsx`
  const source = readFileSync(path, 'utf8')
  const anchors = ['etapas:', 'function toggle', 'Etapas', 'prazoFinal']
  console.error('V121_PROCESS_DEBUG_START')
  for (const anchor of anchors) {
    const index = source.indexOf(anchor)
    console.error(`--- ${anchor} @ ${index} ---`)
    if (index >= 0) console.error(source.slice(Math.max(0, index - 1200), index + 5200))
  }
  console.error('V121_PROCESS_DEBUG_END')
  throw new Error('V12.1 debug: estrutura de processos capturada')
}
