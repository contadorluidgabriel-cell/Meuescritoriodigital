import { createClient } from 'npm:@supabase/supabase-js@2.95.0'
import { assignmentBlockMessage, assignmentSummary } from './policy.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
const publishableKey = publishableKeys.default || Deno.env.get('SUPABASE_ANON_KEY') || ''
const secretKey = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

async function authenticatedUser(req: Request) {
  const authorization = req.headers.get('Authorization') || req.headers.get('authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!token || !publishableKey) return null
  const client = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.getUser(token)
  return error ? null : data.user
}

async function cleanupUserData(userId: string) {
  const tables = [
    'google_oauth_states',
    'google_task_connections',
    'google_task_mappings',
    'office_push_delivery_log',
    'office_push_preferences',
    'office_push_subscriptions',
    'office_user_workspace_preferences',
    'office_snapshots',
    'todoist_task_mappings',
  ]
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq('user_id', userId)
    if (error) console.error(`[office-user-admin] cleanup ${table}`, error.message)
  }
}

async function permanentlyDeleteUser(actor: any, input: any) {
  const workspaceId = String(input.workspace_id || '')
  const memberId = String(input.member_id || '')
  const confirmation = String(input.confirmation || '')
  if (!workspaceId || !memberId) return reply({ error: 'invalid_request', message: 'Usuário ou escritório não identificado.' }, 400)
  if (confirmation !== 'EXCLUIR') return reply({ error: 'confirmation_required', message: 'Digite EXCLUIR para confirmar a exclusão definitiva.' }, 400)

  const [{ data: workspace, error: workspaceError }, { data: actorMembership, error: actorError }] = await Promise.all([
    admin.from('office_workspaces').select('id,owner_user_id,name').eq('id', workspaceId).maybeSingle(),
    admin.from('office_members').select('id,user_id,role,status').eq('workspace_id', workspaceId).eq('user_id', actor.id).eq('status', 'active').maybeSingle(),
  ])
  if (workspaceError) throw workspaceError
  if (actorError) throw actorError
  if (!workspace || String(workspace.owner_user_id || '') !== String(actor.id) || actorMembership?.role !== 'admin') {
    return reply({ error: 'forbidden', message: 'Somente o proprietário do escritório pode excluir uma conta definitivamente.' }, 403)
  }

  const { data: member, error: memberError } = await admin
    .from('office_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', memberId)
    .maybeSingle()
  if (memberError) throw memberError
  if (!member) return reply({ error: 'not_found', message: 'Usuário não encontrado neste escritório.' }, 404)

  const targetUserId = String(member.user_id || '')
  if (!targetUserId) return reply({ error: 'invite_only', message: 'Este registro ainda é apenas um convite. Use Remover convite.' }, 409)
  if (targetUserId === String(actor.id) || targetUserId === String(workspace.owner_user_id || '')) {
    return reply({ error: 'owner_protected', message: 'O proprietário do escritório não pode ser excluído.' }, 409)
  }
  if (member.status !== 'disabled') {
    return reply({ error: 'disable_first', message: 'Desative o usuário antes de excluir a conta definitivamente.' }, 409)
  }

  const { data: snapshot, error: snapshotError } = await admin
    .from('office_workspace_snapshots')
    .select('payload')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (snapshotError) throw snapshotError
  const assignments = assignmentSummary(snapshot?.payload || {}, targetUserId)
  if (assignments.total > 0) {
    return reply({ error: 'active_assignments', message: assignmentBlockMessage(assignments), assignments }, 409)
  }

  const [{ data: ownedWorkspace, error: ownedError }, { data: otherMemberships, error: otherMembershipError }] = await Promise.all([
    admin.from('office_workspaces').select('id,name').eq('owner_user_id', targetUserId).limit(1),
    admin.from('office_members').select('id,workspace_id,status').eq('user_id', targetUserId).neq('id', memberId).limit(5),
  ])
  if (ownedError) throw ownedError
  if (otherMembershipError) throw otherMembershipError
  if ((ownedWorkspace || []).length) {
    return reply({ error: 'owns_workspace', message: 'Esta conta é proprietária de outro escritório e não pode ser excluída por este workspace.' }, 409)
  }
  if ((otherMemberships || []).length) {
    return reply({ error: 'other_memberships', message: 'Esta conta também está vinculada a outro escritório. Remova os outros acessos antes da exclusão definitiva.' }, 409)
  }

  const targetLabel = member.display_name || member.email || 'Usuário'
  await admin.from('office_audit_log').insert({
    workspace_id: workspaceId,
    actor_user_id: actor.id,
    actor_name: actor.user_metadata?.full_name || actor.user_metadata?.name || actor.email || 'Proprietário',
    actor_role: 'admin',
    action: 'delete_user',
    entity_type: 'member',
    entity_id: member.id,
    summary: `Conta excluída definitivamente: ${member.email || targetLabel}`,
    details: { target_user_id: targetUserId, target_name: targetLabel },
  })

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(targetUserId)
  if (authDeleteError) throw authDeleteError

  await cleanupUserData(targetUserId)
  await admin.from('office_invite_links').delete().eq('member_id', member.id)
  const { error: membershipDeleteError } = await admin.from('office_members').delete().eq('id', member.id)
  if (membershipDeleteError) throw membershipDeleteError

  return reply({ ok: true, deleted_user_id: targetUserId, email: member.email || '' })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed', message: 'Método não permitido.' }, 405)
  if (!supabaseUrl || !publishableKey || !secretKey) return reply({ error: 'server_not_configured', message: 'Serviço de usuários não configurado.' }, 500)

  try {
    const actor = await authenticatedUser(req)
    if (!actor) return reply({ error: 'unauthorized', message: 'Sessão inválida. Entre novamente.' }, 401)
    const input = await req.json().catch(() => ({}))
    const action = String(input.action || 'delete_user')
    if (action === 'delete_user') return await permanentlyDeleteUser(actor, input)
    return reply({ error: 'unknown_action', message: 'Ação desconhecida.' }, 400)
  } catch (error) {
    console.error('[office-user-admin]', error)
    return reply({ error: 'user_admin_error', message: error instanceof Error ? error.message : 'Falha ao administrar o usuário.' }, 500)
  }
})
