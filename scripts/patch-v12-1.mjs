import { readFileSync } from 'node:fs'

export function applyV121Patch(root) {
  const path = `${root}src/components/ProcessesReact.jsx`
  const source = readFileSync(path, 'utf8')
  const anchors = ['function updateProcess', 'function advance', 'etapaAtual', 'process.etapas', "status: 'Concluído'", 'Protocolos']
  console.error('V121_PROCESS_ACTION_DEBUG_START')
  for (const anchor of anchors) {
    let from = 0
    let occurrence = 0
    while (occurrence < 4) {
      const index = source.indexOf(anchor, from)
      if (index < 0) break
      console.error(`--- ${anchor} #${occurrence + 1} @ ${index} ---`)
      console.error(source.slice(Math.max(0, index - 1600), index + 6200))
      from = index + anchor.length
      occurrence += 1
    }
  }
  console.error('V121_PROCESS_ACTION_DEBUG_END')
  throw new Error('V12.1 debug: ações de processos capturadas')
}
