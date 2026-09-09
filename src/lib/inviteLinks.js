import { supabase } from './supabase.js'

async function invokeInviteLinks(action, body = {}, authenticated = false) {
  const headers = {}
  if (authenticated) {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
    headers.Authorization = `Bearer ${token}`
  }

  const { data, error } = await supabase.functions.invoke('office-invite-links', {
    body: { action, ...body },
    headers,
  })

  if (error) {
    let message = error.message || 'Não foi possível processar o convite.'
    try {
      if (error.context && typeof error.context.json === 'function') {
        const detail = await error.context.json()
        if (detail?.message) message = detail.message
      }
    } catch {}
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.message || 'Não foi possível processar o convite.')
  return data
}

export const createWorkspaceInviteLink = (workspaceId, memberId) => invokeInviteLinks('create', {
  workspace_id: workspaceId,
  member_id: memberId,
}, true)

export const inspectWorkspaceInviteLink = token => invokeInviteLinks('inspect', { token })

export const acceptWorkspaceInviteLink = (token, password) => invokeInviteLinks('accept', { token, password })
