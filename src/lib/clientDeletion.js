import { supabase } from './supabase.js'
import { invokeEdgeJson } from './workspaceSync.js'
export { clientDependencies, clientHasEmbeddedHistory } from '../../supabase/functions/office-client-delete/dependencies.mjs'

export async function deleteClientFromWorkspace(workspaceId, clientId, confirmation) {
  if (!workspaceId || !clientId || confirmation !== 'EXCLUIR') throw new Error('Confirme a exclusão digitando EXCLUIR.')
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new Error('Sua sessão expirou. Entre novamente.')
  return invokeEdgeJson('office-client-delete', {
    token: data.session.access_token,
    body: { workspace_id: workspaceId, client_id: clientId, confirmation },
    fallback: 'Não foi possível excluir o cliente.',
  })
}
