import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const APP_URL = 'https://meu-escritorio-digital.vercel.app'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
})
const cleanEmail = (value = '') => String(value || '').trim().toLowerCase()
const hex = (bytes: Uint8Array) => Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('')
const base64url = (bytes: Uint8Array) => {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return hex(new Uint8Array(digest))
}
function randomToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64url(bytes)
}
async function authenticatedUser(service: any, req: Request) {
  const authorization = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await service.auth.getUser(token)
  return error || !data?.user ? null : data.user
}
async function requireAdmin(service: any, req: Request, workspaceId: string) {
  const user = await authenticatedUser(service, req)
  if (!user) throw new Error('Sessão inválida.')
  const { data: membership, error } = await service.from('office_members')
    .select('id,role,status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  if (!membership || membership.role !== 'admin') throw new Error('Apenas administradores podem gerar links de convite.')
  return { user, membership }
}
async function loadValidInvite(service: any, token: string) {
  if (!token || token.length < 24) return { error: 'Link de convite inválido.', status: 400 } as const
  const tokenHash = await hashToken(token)
  const { data: link, error: linkError } = await service.from('office_invite_links')
    .select('id,workspace_id,member_id,expires_at,used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (linkError) throw linkError
  if (!link) return { error: 'Este link não está mais disponível. Ele pode ter sido substituído pelo administrador. Solicite o link mais recente.', status: 404 } as const
  if (link.used_at) return { error: 'Este link de convite já foi utilizado.', status: 410 } as const
  if (Date.parse(link.expires_at || '') <= Date.now()) return { error: 'Este link de convite expirou. Solicite um novo link ao administrador.', status: 410 } as const
  const [{ data: member, error: memberError }, { data: workspace, error: workspaceError }] = await Promise.all([
    service.from('office_members').select('id,workspace_id,user_id,email,display_name,role,status,partner_id').eq('id', link.member_id).maybeSingle(),
    service.from('office_workspaces').select('id,name,owner_user_id').eq('id', link.workspace_id).maybeSingle(),
  ])
  if (memberError) throw memberError
  if (workspaceError) throw workspaceError
  if (!member || !workspace || String(member.workspace_id) !== String(workspace.id)) return { error: 'O acesso vinculado a este convite não está mais disponível.', status: 404 } as const
  if (member.status !== 'invited') return { error: member.status === 'active' ? 'Este acesso já foi ativado.' : 'Este convite não está disponível para ativação.', status: 409 } as const
  return { link, member, workspace, tokenHash } as const
}
async function findUserByEmail(service: any, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const found = (data?.users || []).find((user: any) => cleanEmail(user.email) === email)
    if (found) return found
    if ((data?.users || []).length < 1000) return null
  }
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server_not_configured', message: 'Serviço de convites indisponível.' }, 500)
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  let body: any = {}
  try { body = await req.json() } catch { body = {} }
  const action = String(body.action || 'inspect')

  try {
    if (action === 'create') {
      const workspaceId = String(body.workspace_id || '')
      const memberId = String(body.member_id || '')
      const replace = body.replace === true
      if (!workspaceId || !memberId) return json({ error: 'invalid_request', message: 'Membro ou escritório não informado.' }, 400)
      const { user } = await requireAdmin(service, req, workspaceId)
      const { data: member, error: memberError } = await service.from('office_members')
        .select('id,workspace_id,user_id,email,display_name,role,status,partner_id')
        .eq('workspace_id', workspaceId)
        .eq('id', memberId)
        .maybeSingle()
      if (memberError) throw memberError
      if (!member) return json({ error: 'member_not_found', message: 'Membro não encontrado.' }, 404)
      if (member.status !== 'invited') return json({ error: 'member_not_invited', message: member.status === 'active' ? 'Este acesso já está ativo.' : 'Este acesso não pode receber um link agora.' }, 409)

      const now = new Date().toISOString()
      await service.from('office_invite_links').delete().eq('member_id', member.id).lt('expires_at', now)
      if (replace) await service.from('office_invite_links').delete().eq('member_id', member.id).is('used_at', null)

      const token = randomToken()
      const tokenHash = await hashToken(token)
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
      const { data: saved, error: saveError } = await service.from('office_invite_links').insert({
        workspace_id: workspaceId,
        member_id: member.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_by: user.id,
      }).select('id,expires_at').single()
      if (saveError) throw saveError
      await service.from('office_audit_log').insert({
        workspace_id: workspaceId,
        actor_user_id: user.id,
        actor_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Administrador',
        actor_role: 'admin',
        action: replace ? 'replace_invite_link' : 'invite_link',
        entity_type: 'member',
        entity_id: member.id,
        summary: replace ? `Links anteriores substituídos para ${member.email}` : `Link de convite gerado para ${member.email}`,
        details: { expires_at: saved.expires_at, replace },
      })
      return json({
        ok: true,
        link: `${APP_URL}/?join=${encodeURIComponent(token)}`,
        expires_at: saved.expires_at,
        replaced_previous: replace,
        member: { id: member.id, email: member.email, display_name: member.display_name, role: member.role },
      })
    }

    if (action === 'inspect') {
      const loaded = await loadValidInvite(service, String(body.token || ''))
      if ('error' in loaded) return json({ error: 'invite_invalid', message: loaded.error }, loaded.status)
      return json({
        ok: true,
        invite: {
          email: loaded.member.email,
          display_name: loaded.member.display_name || '',
          role: loaded.member.role,
          workspace_name: loaded.workspace.name || 'Meu Escritório',
          expires_at: loaded.link.expires_at,
        },
      })
    }

    if (action === 'accept') {
      const password = String(body.password || '')
      if (password.length < 6) return json({ error: 'weak_password', message: 'Use uma senha com pelo menos 6 caracteres.' }, 400)
      const loaded = await loadValidInvite(service, String(body.token || ''))
      if ('error' in loaded) return json({ error: 'invite_invalid', message: loaded.error }, loaded.status)
      const email = cleanEmail(loaded.member.email)
      const now = new Date().toISOString()
      let userId = String(loaded.member.user_id || '')

      if (userId) {
        const { data: existingById, error: byIdError } = await service.auth.admin.getUserById(userId)
        if (byIdError || !existingById?.user || cleanEmail(existingById.user.email) !== email) return json({ error: 'account_mismatch', message: 'O usuário vinculado a este convite não corresponde ao e-mail esperado.' }, 409)
        const { error: updateAuthError } = await service.auth.admin.updateUserById(userId, { password, email_confirm: true, user_metadata: { ...(existingById.user.user_metadata || {}), full_name: loaded.member.display_name || existingById.user.user_metadata?.full_name || '' } })
        if (updateAuthError) throw updateAuthError
      } else {
        const existing = await findUserByEmail(service, email)
        if (existing) {
          const loginClient = createClient(supabaseUrl, anonKey || serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
          const { data: signed, error: signError } = await loginClient.auth.signInWithPassword({ email, password })
          if (signError || !signed?.user) return json({ error: 'existing_account', message: 'Já existe uma conta com este e-mail. Informe a senha atual dessa conta para aceitar o convite.' }, 400)
          userId = signed.user.id
        } else {
          const { data: created, error: createError } = await service.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: loaded.member.display_name || '' },
          })
          if (createError || !created?.user) throw createError || new Error('Não foi possível criar o acesso.')
          userId = created.user.id
        }
      }

      const { data: activated, error: activateError } = await service.from('office_members').update({
        user_id: userId,
        status: 'active',
        joined_at: now,
        updated_at: now,
      }).eq('id', loaded.member.id).eq('status', 'invited').select('id').maybeSingle()
      if (activateError) throw activateError
      if (!activated) return json({ error: 'invite_changed', message: 'Este convite foi alterado enquanto você concluía o acesso. Solicite um novo link.' }, 409)

      const { error: usedError } = await service.from('office_invite_links').update({ used_at: now, updated_at: now }).eq('id', loaded.link.id).is('used_at', null)
      if (usedError) throw usedError
      await service.from('office_user_workspace_preferences').upsert({ user_id: userId, active_workspace_id: loaded.workspace.id, updated_at: now }, { onConflict: 'user_id' })
      await service.from('office_audit_log').insert({
        workspace_id: loaded.workspace.id,
        actor_user_id: userId,
        actor_name: loaded.member.display_name || email,
        actor_role: loaded.member.role || '',
        action: 'accept_invite_link',
        entity_type: 'member',
        entity_id: loaded.member.id,
        summary: `Convite por link aceito: ${email}`,
        details: {},
      })
      return json({ ok: true, email, workspace_name: loaded.workspace.name || 'Meu Escritório', role: loaded.member.role })
    }

    return json({ error: 'unknown_action', message: 'Ação de convite desconhecida.' }, 400)
  } catch (error) {
    console.error('office-invite-links failed', action, (error as Error)?.message || String(error))
    return json({ error: 'invite_error', message: (error as Error)?.message || 'Não foi possível processar o convite.' }, 400)
  }
})
