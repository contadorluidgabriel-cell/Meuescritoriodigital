import { supabase } from './supabase.js'
import { invokeEdgeJson } from './workspaceSync.js'

async function invoke(action, body = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
  return invokeEdgeJson('office-distribution', {
    body: { action, ...body },
    token,
    fallback: 'Falha ao atualizar a distribuição.',
  })
}

export const setClientPrimaryResponsible = (workspaceId, clientId, userId = '', transferOpen = false) => invoke('set_primary_responsible', {
  workspace_id: workspaceId,
  client_id: clientId,
  user_id: userId,
  transfer_open: Boolean(transferOpen),
})

export const assignDistributionWork = (workspaceId, items = [], targetUserId = '') => invoke('assign_work', {
  workspace_id: workspaceId,
  items: (items || []).map(item => ({ kind: item.kind, id: item.id, clientId: item.clientId || '' })),
  target_user_id: targetUserId,
})

export const deactivateWorkspaceMemberWithReassignment = (workspaceId, memberId, replacementUserId = '') => invoke('deactivate_member', {
  workspace_id: workspaceId,
  member_id: memberId,
  replacement_user_id: replacementUserId,
})

export const recordDistributionEvent = (workspaceId, summary, details = {}, entityId = '') => invoke('record_event', {
  workspace_id: workspaceId,
  summary,
  details,
  entity_id: entityId,
})
