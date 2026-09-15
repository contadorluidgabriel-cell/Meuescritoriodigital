export function evaluateTodoistAccess({
  userId = '',
  requestedWorkspaceId = '',
  workspaceConfigured = false,
  membership = null,
  workspace = null,
} = {}) {
  const user = String(userId || '')
  const requested = String(requestedWorkspaceId || '')

  if (!requested || !workspaceConfigured) {
    return { ok: false, status: 403, message: 'Todoist não está habilitado neste escritório.' }
  }

  if (
    !membership
    || membership.status !== 'active'
    || membership.role !== 'admin'
    || String(membership.user_id || '') !== user
    || String(membership.workspace_id || '') !== requested
  ) {
    return { ok: false, status: 403, message: 'Seu acesso não permite usar a integração com o Todoist.' }
  }

  if (
    !workspace
    || String(workspace.id || '') !== requested
    || String(workspace.owner_user_id || '') !== user
  ) {
    return { ok: false, status: 403, message: 'Somente o proprietário deste escritório pode usar a integração com o Todoist.' }
  }

  return { ok: true, status: 200, workspaceId: requested }
}
