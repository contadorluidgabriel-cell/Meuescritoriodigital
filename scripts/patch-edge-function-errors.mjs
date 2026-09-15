import { readFileSync, writeFileSync } from 'node:fs'

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Edge function invocation patch failed (${label})`)
  return source.replace(from, to)
}

export function applyEdgeFunctionErrorPatch(root) {
  const path = `${root}src/lib/workspaceSync.js`
  let source = readFileSync(path, 'utf8')

  if (!source.includes("import { invokeEdgeJson } from './edgeFunctionFetch.js'")) {
    source = replaceOrFail(
      source,
      "import { deepEqual } from './deepEqual.js'",
      "import { deepEqual } from './deepEqual.js'\nimport { invokeEdgeJson } from './edgeFunctionFetch.js'",
      'edge helper import',
    )
  }

  const workspaceInvoke = `async function invoke(action, body = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
  const { data, error } = await supabase.functions.invoke('office-workspace-web', { body: { action, ...body }, headers: { Authorization: \`Bearer \${token}\` } })
  if (error) throw new Error(error.message || 'Falha ao acessar o escritório.')
  if (data?.error) throw new Error(data.message || 'Falha ao acessar o escritório.')
  return data
}`

  const safeWorkspaceInvoke = `async function invoke(action, body = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
  return invokeEdgeJson('office-workspace-web', {
    body: { action, ...body },
    token,
    fallback: 'Falha ao acessar o escritório.',
  })
}`

  if (source.includes(workspaceInvoke)) {
    source = source.replace(workspaceInvoke, safeWorkspaceInvoke)
  } else if (!source.includes("return invokeEdgeJson('office-workspace-web'")) {
    throw new Error('Edge function invocation patch failed (workspace invoke)')
  }

  const deleteInvoke = `  const { data, error } = await supabase.functions.invoke('office-user-admin', {
    body: { action: 'delete_user', workspace_id: workspaceId, member_id: memberId, confirmation },
    headers: { Authorization: \`Bearer \${token}\` },
  })
  if (error) throw new Error(error.message || 'Falha ao excluir o usuário.')
  if (data?.error) throw new Error(data.message || 'Falha ao excluir o usuário.')
  return data`

  const safeDeleteInvoke = `  return invokeEdgeJson('office-user-admin', {
    body: { action: 'delete_user', workspace_id: workspaceId, member_id: memberId, confirmation },
    token,
    fallback: 'Falha ao excluir o usuário.',
  })`

  if (source.includes(deleteInvoke)) {
    source = source.replace(deleteInvoke, safeDeleteInvoke)
  } else if (!source.includes("return invokeEdgeJson('office-user-admin'")) {
    throw new Error('Edge function invocation patch failed (user delete invoke)')
  }

  writeFileSync(path, source)
}
