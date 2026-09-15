import { readFileSync, writeFileSync } from 'node:fs'

export function applyEdgeFunctionErrorPatch(root) {
  const path = `${root}src/lib/workspaceSync.js`
  let source = readFileSync(path, 'utf8')

  if (!source.includes("import { functionErrorMessage } from './functionError.js'")) {
    source = source.replace(
      "import { deepEqual } from './deepEqual.js'",
      "import { deepEqual } from './deepEqual.js'\nimport { functionErrorMessage } from './functionError.js'",
    )
  }

  source = source.replace(
    "if (error) throw new Error(error.message || 'Falha ao acessar o escritório.')",
    "if (error) throw new Error(await functionErrorMessage(error, 'Falha ao acessar o escritório.'))",
  )

  source = source.replace(
    "if (error) throw new Error(error.message || 'Falha ao excluir o usuário.')",
    "if (error) throw new Error(await functionErrorMessage(error, 'Falha ao excluir o usuário.'))",
  )

  writeFileSync(path, source)
}
