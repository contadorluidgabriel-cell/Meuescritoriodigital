import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import {
  DEFAULT_PERMISSIONS,
  ROLE_ADMIN,
  ROLE_COLLABORATOR,
  ROLE_PARTNER,
  applyOfficePatch,
  filterPayloadForMembership,
  memberCanSeeTeam,
  permissionsFor,
} from './access.js'

const APP_URL = 'https://meu-escritorio-digital.vercel.app'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
})
const cleanEmail = (value = '') => String(value || '').trim().toLowerCase()
const cleanRole = (value = '') => [ROLE_ADMIN, ROLE_COLLABORATOR, ROLE_PARTNER].includes(value) ? value : ROLE_COLLABORATOR
const displayFromUser = (user: any) => String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Usuário').trim()

function memberView(member: any, workspace: any = null) {
  return {
    id: member.id,
    workspace_id: member.workspace_id,
    user_id: member.user_id,
    email: member.email,
    display_name: member.display_name || '',
    role: member.role,
    partner_id: member.partner_id || '',
    status: member.status,
    permissions: permissionsFor(member),
    joined_at: member.joined_at,
    invited_at: member.invited_at,
    workspace: workspace ? { id: workspace.id, name: workspace.name, owner_user_id: workspace.owner_user_id } : undefined,
  }
}

async function authenticatedUser(service: any, req: Request) {
  const authorization = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await service.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

async function claimInvites(service: any, user: any) {
  const email = cleanEmail(user.email)
  if (!email) return
  const { data: invited } = await service
    .from('office_members')
    .select('id,workspace_id,user_id,email,status')
    .eq('email', email)
    .eq('status', 'invited')
  for (const row of invited || []) {
    if (row.user_id && String(row.user_id) !== String(user.id)) continue
    await service.from('office_members').update({
      user_id: user.id,
      status: 'active',
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
  }
}

async function provisionWorkspace(service: any, user: any) {
  const { data: existing } = await service.from('office_workspaces').select('*').eq('owner_user_id', user.id).maybeSingle()
  if (existing) {
    await service.from('office_members').upsert({
      workspace_id: existing.id,
      user_id: user.id,
      email: cleanEmail(user.email) || `${user.id}@local.invalid`,
      display_name: displayFromUser(user),
      role: ROLE_ADMIN,
      status: 'active',
      permissions: DEFAULT_PERMISSIONS.admin,
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,user_id' })
    return existing
  }

  const { data: legacy } = await service.from('office_snapshots').select('payload,app_version,created_at,updated_at').eq('user_id', user.id).maybeSingle()
  const configured = legacy?.payload?.med_configuracoes || {}
  const workspaceName = String(configured.office || user.user_metadata?.office || 'Meu Escritório').trim() || 'Meu Escritório'
  const { data: workspace, error: workspaceError } = await service.from('office_workspaces').insert({
    name: workspaceName,
    owner_user_id: user.id,
  }).select('*').single()
  if (workspaceError) throw workspaceError

  await service.from('office_members').insert({
    workspace_id: workspace.id,
    user_id: user.id,
    email: cleanEmail(user.email) || `${user.id}@local.invalid`,
    display_name: displayFromUser(user),
    role: ROLE_ADMIN,
    status: 'active',
    permissions: DEFAULT_PERMISSIONS.admin,
    joined_at: new Date().toISOString(),
  })
  await service.from('office_workspace_snapshots').insert({
    workspace_id: workspace.id,
    payload: legacy?.payload || {},
    app_version: legacy?.app_version || '11.1',
    version: 1,
    updated_by: user.id,
    created_at: legacy?.created_at || new Date().toISOString(),
    updated_at: legacy?.updated_at || new Date().toISOString(),
  })
  await service.from('office_user_workspace_preferences').upsert({ user_id: user.id, active_workspace_id: workspace.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return workspace
}

async function activeMemberships(service: any, user: any) {
  await claimInvites(service, user)
  let { data, error } = await service
    .from('office_members')
    .select('*,office_workspaces(id,name,owner_user_id,created_at,updated_at)')
    .eq('user_id', user.id)
    .eq('status', 'active')
  if (error) throw error
  if (!data?.length) {
    await provisionWorkspace(service, user)
    const retry = await service
      .from('office_members')
      .select('*,office_workspaces(id,name,owner_user_id,created_at,updated_at)')
      .eq('user_id', user.id)
      .eq('status', 'active')
    if (retry.error) throw retry.error
    data = retry.data || []
  }
  return data || []
}

async function chooseMembership(service: any, user: any, memberships: any[], requestedWorkspaceId = '') {
  let selected = requestedWorkspaceId ? memberships.find(item => String(item.workspace_id) === String(requestedWorkspaceId)) : null
  if (!selected) {
    const { data: pref } = await service.from('office_user_workspace_preferences').select('active_workspace_id').eq('user_id', user.id).maybeSingle()
    if (pref?.active_workspace_id) selected = memberships.find(item => String(item.workspace_id) === String(pref.active_workspace_id))
  }
  if (!selected) selected = memberships.find(item => item.role === ROLE_ADMIN) || memberships[0]
  if (!selected) throw new Error('Nenhum escritório disponível para este usuário.')
  await service.from('office_user_workspace_preferences').upsert({
    user_id: user.id,
    active_workspace_id: selected.workspace_id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  return selected
}

async function reconcileLegacyOwnerSnapshot(service: any, user: any, membership: any) {
  const workspace = membership.office_workspaces
  if (membership.role !== ROLE_ADMIN || String(workspace?.owner_user_id || '') !== String(user.id)) return
  const [{ data: legacy }, { data: shared }] = await Promise.all([
    service.from('office_snapshots').select('payload,app_version,updated_at').eq('user_id', user.id).maybeSingle(),
    service.from('office_workspace_snapshots').select('version,updated_at').eq('workspace_id', membership.workspace_id).maybeSingle(),
  ])
  if (!legacy?.payload || !shared || Number(shared.version || 1) > 1) return
  if (Date.parse(legacy.updated_at || '') <= Date.parse(shared.updated_at || '')) return
  await service.from('office_workspace_snapshots').update({
    payload: legacy.payload,
    app_version: legacy.app_version || '11.1',
    updated_by: user.id,
    updated_at: legacy.updated_at || new Date().toISOString(),
  }).eq('workspace_id', membership.workspace_id).eq('version', shared.version)
}

async function contextFor(service: any, user: any, requestedWorkspaceId = '') {
  const memberships = await activeMemberships(service, user)
  const selected = await chooseMembership(service, user, memberships, requestedWorkspaceId)
  return {
    selected,
    memberships,
    workspaces: memberships.map(item => ({
      id: item.workspace_id,
      name: item.office_workspaces?.name || 'Meu Escritório',
      role: item.role,
      partner_id: item.partner_id || '',
    })),
  }
}

async function loadWorkspace(service: any, user: any, requestedWorkspaceId = '') {
  const context = await contextFor(service, user, requestedWorkspaceId)
  await reconcileLegacyOwnerSnapshot(service, user, context.selected)
  let { data: snapshot, error } = await service.from('office_workspace_snapshots').select('*').eq('workspace_id', context.selected.workspace_id).maybeSingle()
  if (error) throw error
  if (!snapshot) {
    const created = await service.from('office_workspace_snapshots').insert({
      workspace_id: context.selected.workspace_id,
      payload: {},
      app_version: '11.1',
      version: 1,
      updated_by: user.id,
    }).select('*').single()
    if (created.error) throw created.error
    snapshot = created.data
  }
  return {
    workspace: context.selected.office_workspaces,
    membership: memberView(context.selected, context.selected.office_workspaces),
    workspaces: context.workspaces,
    payload: filterPayloadForMembership(snapshot.payload || {}, context.selected),
    version: Number(snapshot.version || 1),
    updated_at: snapshot.updated_at,
  }
}

async function writeAudit(service: any, workspaceId: string, user: any, membership: any, entries: any[]) {
  if (!entries.length) return
  const rows = entries.slice(0, 100).map(entry => ({
    workspace_id: workspaceId,
    actor_user_id: user.id,
    actor_name: membership.display_name || displayFromUser(user),
    actor_role: membership.role || '',
    action: entry.action || 'update',
    entity_type: entry.entity_type || '',
    entity_id: entry.entity_id || '',
    summary: entry.summary || 'Registro atualizado',
    details: entry.details || {},
  }))
  await service.from('office_audit_log').insert(rows)
}

async function saveWorkspace(service: any, user: any, body: any) {
  const context = await contextFor(service, user, String(body.workspace_id || ''))
  const membership = context.selected
  const patch = body.patch && typeof body.patch === 'object' ? body.patch : {}

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: current, error: currentError } = await service
      .from('office_workspace_snapshots')
      .select('payload,version,updated_at')
      .eq('workspace_id', membership.workspace_id)
      .single()
    if (currentError) throw currentError

    const applied = applyOfficePatch(current.payload || {}, patch, membership)
    const nextVersion = Number(current.version || 1) + 1
    const { data: saved, error: saveError } = await service
      .from('office_workspace_snapshots')
      .update({
        payload: applied.payload,
        app_version: '11.1',
        version: nextVersion,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', membership.workspace_id)
      .eq('version', current.version)
      .select('payload,version,updated_at')
      .maybeSingle()
    if (saveError) throw saveError
    if (!saved) continue

    await writeAudit(service, membership.workspace_id, user, membership, applied.audit)
    return {
      ok: true,
      workspace: membership.office_workspaces,
      membership: memberView(membership, membership.office_workspaces),
      workspaces: context.workspaces,
      payload: filterPayloadForMembership(saved.payload || {}, membership),
      version: Number(saved.version || nextVersion),
      updated_at: saved.updated_at,
    }
  }
  throw new Error('O escritório foi alterado simultaneamente. Tente novamente.')
}

async function requireAdminContext(service: any, user: any, workspaceId = '') {
  const context = await contextFor(service, user, workspaceId)
  if (!memberCanSeeTeam(context.selected)) throw new Error('Apenas administradores podem gerenciar a equipe.')
  return context
}

async function listMembers(service: any, user: any, workspaceId = '') {
  const context = await requireAdminContext(service, user, workspaceId)
  const { data, error } = await service.from('office_members').select('*').eq('workspace_id', context.selected.workspace_id).order('invited_at', { ascending: true })
  if (error) throw error
  return { workspace: context.selected.office_workspaces, members: (data || []).map(item => memberView(item)) }
}

async function inviteMember(service: any, user: any, body: any) {
  const context = await requireAdminContext(service, user, String(body.workspace_id || ''))
  const email = cleanEmail(body.email)
  const displayName = String(body.display_name || '').trim()
  const role = cleanRole(body.role)
  if (!email || !email.includes('@')) throw new Error('Informe um e-mail válido.')
  if (role === ROLE_ADMIN) throw new Error('Novos convites devem ser Colaborador ou Parceiro.')

  const partnerId = role === ROLE_PARTNER ? String(body.partner_id || '') : ''
  if (role === ROLE_PARTNER) {
    const { data: snapshot } = await service.from('office_workspace_snapshots').select('payload').eq('workspace_id', context.selected.workspace_id).single()
    const partners = Array.isArray(snapshot?.payload?.med_parceiros_trabalho) ? snapshot.payload.med_parceiros_trabalho : []
    if (!partnerId || !partners.some((partner: any) => String(partner.id) === partnerId)) throw new Error('Vincule o acesso a um parceiro cadastrado no escritório.')
  }

  const permissions = {
    ...DEFAULT_PERMISSIONS[role],
    ...(body.permissions && typeof body.permissions === 'object' ? body.permissions : {}),
  }
  const { data: existing } = await service.from('office_members').select('*').eq('workspace_id', context.selected.workspace_id).eq('email', email).maybeSingle()
  if (existing?.status === 'active') throw new Error('Este e-mail já faz parte do escritório.')

  const memberPayload = {
    workspace_id: context.selected.workspace_id,
    email,
    display_name: displayName || email.split('@')[0],
    role,
    partner_id: partnerId || null,
    status: 'invited',
    permissions,
    invited_by: user.id,
    invited_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  let member
  if (existing) {
    const updated = await service.from('office_members').update(memberPayload).eq('id', existing.id).select('*').single()
    if (updated.error) throw updated.error
    member = updated.data
  } else {
    const inserted = await service.from('office_members').insert(memberPayload).select('*').single()
    if (inserted.error) throw inserted.error
    member = inserted.data
  }

  let emailSent = false
  let emailNote = ''
  try {
    const invited = await service.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${APP_URL}/?invite=1`,
      data: { office_workspace_id: context.selected.workspace_id, office_role: role },
    })
    if (invited.data?.user?.id) {
      await service.from('office_members').update({ user_id: invited.data.user.id, updated_at: new Date().toISOString() }).eq('id', member.id)
      member.user_id = invited.data.user.id
    }
    emailSent = !invited.error
    if (invited.error) emailNote = invited.error.message || 'Convite cadastrado, mas o e-mail não pôde ser enviado.'
  } catch (error) {
    emailNote = (error as Error)?.message || 'Convite cadastrado, mas o e-mail não pôde ser enviado.'
  }

  await writeAudit(service, context.selected.workspace_id, user, context.selected, [{
    action: 'invite', entity_type: 'member', entity_id: member.id, summary: `${role === ROLE_PARTNER ? 'Parceiro' : 'Colaborador'} convidado: ${email}`,
  }])
  return { member: memberView(member), email_sent: emailSent, note: emailNote }
}

async function updateMember(service: any, user: any, body: any) {
  const context = await requireAdminContext(service, user, String(body.workspace_id || ''))
  const memberId = String(body.member_id || '')
  const { data: member, error } = await service.from('office_members').select('*').eq('workspace_id', context.selected.workspace_id).eq('id', memberId).single()
  if (error || !member) throw new Error('Membro não encontrado.')
  if (String(member.user_id || '') === String(context.selected.office_workspaces?.owner_user_id || '')) throw new Error('O administrador proprietário não pode ser rebaixado ou desativado.')

  const role = cleanRole(body.role || member.role)
  if (role === ROLE_ADMIN) throw new Error('A promoção para Administrador não está disponível nesta primeira versão.')
  const partnerId = role === ROLE_PARTNER ? String(body.partner_id || member.partner_id || '') : ''
  if (role === ROLE_PARTNER && !partnerId) throw new Error('Selecione o parceiro vinculado.')
  const permissions = { ...DEFAULT_PERMISSIONS[role], ...(body.permissions || {}) }
  const status = ['invited', 'active', 'disabled'].includes(body.status) ? body.status : member.status

  const { data: saved, error: saveError } = await service.from('office_members').update({
    display_name: String(body.display_name ?? member.display_name || '').trim(),
    role,
    partner_id: partnerId || null,
    status,
    permissions,
    updated_at: new Date().toISOString(),
  }).eq('id', member.id).select('*').single()
  if (saveError) throw saveError
  await writeAudit(service, context.selected.workspace_id, user, context.selected, [{ action: 'update', entity_type: 'member', entity_id: member.id, summary: `Acesso de ${saved.email} atualizado` }])
  return { member: memberView(saved) }
}

async function removeMember(service: any, user: any, body: any) {
  const context = await requireAdminContext(service, user, String(body.workspace_id || ''))
  const memberId = String(body.member_id || '')
  const { data: member } = await service.from('office_members').select('*').eq('workspace_id', context.selected.workspace_id).eq('id', memberId).maybeSingle()
  if (!member) return { ok: true }
  if (String(member.user_id || '') === String(context.selected.office_workspaces?.owner_user_id || '')) throw new Error('O administrador proprietário não pode ser removido.')
  const { error } = await service.from('office_members').delete().eq('id', member.id)
  if (error) throw error
  await writeAudit(service, context.selected.workspace_id, user, context.selected, [{ action: 'delete', entity_type: 'member', entity_id: member.id, summary: `Acesso removido: ${member.email}` }])
  return { ok: true }
}

async function listAudit(service: any, user: any, body: any) {
  const context = await contextFor(service, user, String(body.workspace_id || ''))
  const isAdmin = context.selected.role === ROLE_ADMIN
  let query = service.from('office_audit_log').select('*').eq('workspace_id', context.selected.workspace_id).order('created_at', { ascending: false }).limit(120)
  if (!isAdmin) query = query.eq('actor_user_id', user.id)
  const { data, error } = await query
  if (error) throw error
  return { audit: data || [] }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server_not_configured' }, 500)
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const user = await authenticatedUser(service, req)
  if (!user) return json({ error: 'unauthorized', message: 'Sessão inválida.' }, 401)

  let body: any = {}
  try { body = await req.json() } catch { body = {} }
  const action = String(body.action || 'load')
  try {
    if (action === 'context') {
      const context = await contextFor(service, user, String(body.workspace_id || ''))
      return json({
        workspace: context.selected.office_workspaces,
        membership: memberView(context.selected, context.selected.office_workspaces),
        workspaces: context.workspaces,
      })
    }
    if (action === 'load') return json(await loadWorkspace(service, user, String(body.workspace_id || '')))
    if (action === 'save') return json(await saveWorkspace(service, user, body))
    if (action === 'members') return json(await listMembers(service, user, String(body.workspace_id || '')))
    if (action === 'invite') return json(await inviteMember(service, user, body))
    if (action === 'update_member') return json(await updateMember(service, user, body))
    if (action === 'remove_member') return json(await removeMember(service, user, body))
    if (action === 'audit') return json(await listAudit(service, user, body))
    return json({ error: 'unknown_action' }, 400)
  } catch (error) {
    console.error('office-workspace failed', action, (error as Error)?.message || String(error))
    return json({ error: 'workspace_error', message: (error as Error)?.message || 'Falha ao processar o escritório.' }, 400)
  }
})
