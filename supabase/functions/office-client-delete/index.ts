import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { clientDependencies, clientHasEmbeddedHistory } from './dependencies.mjs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
})

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return reply({ message: 'Método não permitido.' }, 405)
  const url = Deno.env.get('SUPABASE_URL') || ''
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!url || !secret) return reply({ message: 'Serviço indisponível.' }, 503)
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return reply({ message: 'Entre novamente para continuar.' }, 401)

  const service = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: auth, error: authError } = await service.auth.getUser(token)
  if (authError || !auth?.user?.id) return reply({ message: 'Sessão inválida.' }, 401)

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return reply({ message: 'Solicitação inválida.' }, 400) }
  const workspaceId = String(body?.workspace_id || '').trim()
  const clientId = String(body?.client_id || '').trim()
  if (!/^[a-zA-Z0-9_-]{3,120}$/.test(clientId) || !/^[a-zA-Z0-9_-]{8,120}$/.test(workspaceId) || body?.confirmation !== 'EXCLUIR') {
    return reply({ message: 'Confirme a exclusão digitando EXCLUIR.' }, 400)
  }

  const [{ data: member, error: memberError }, { data: workspace, error: workspaceError }] = await Promise.all([
    service.from('office_members').select('role,permissions,status,user_id').eq('workspace_id', workspaceId).eq('user_id', auth.user.id).eq('status', 'active').maybeSingle(),
    service.from('office_workspaces').select('id,owner_user_id').eq('id', workspaceId).maybeSingle(),
  ])
  if (memberError || workspaceError) return reply({ message: 'Não foi possível verificar suas permissões.' }, 503)
  if (!member || !workspace) return reply({ message: 'Você não tem acesso a este escritório.' }, 403)
  const owner = String(workspace.owner_user_id) === String(auth.user.id)
  const permissions = member.permissions || {}
  if (!owner && (member.role !== 'admin' || permissions.delete_records !== true || permissions.clients !== true || permissions.manage_clients !== true)) {
    return reply({ message: 'Somente administradores autorizados podem excluir clientes.' }, 403)
  }
  if (!owner && permissions.access_v2 === true && (!Array.isArray(permissions.client_ids) || !permissions.client_ids.map(String).includes(clientId))) {
    return reply({ message: 'Este cliente não está no seu escopo de acesso.' }, 403)
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: snapshot, error: readError } = await service.from('office_workspace_snapshots')
      .select('payload,version').eq('workspace_id', workspaceId).single()
    if (readError || !snapshot) return reply({ message: 'Não foi possível conferir o cadastro atual.' }, 503)
    const payload = snapshot.payload || {}
    const clients = Array.isArray(payload.med_clientes) ? payload.med_clientes : []
    const client = clients.find((item: Record<string, unknown>) => String(item?.id || '') === clientId)
    if (!client) return reply({ message: 'Cliente não encontrado. Atualize a página.' }, 404)
    const dependencies = clientDependencies(payload, clientId)
    if (clientHasEmbeddedHistory(client)) dependencies.push({ key: 'historico_cliente', label: 'histórico do próprio cliente', count: 1 })

    const { data: linkedMembers, error: membersError } = await service.from('office_members')
      .select('id,permissions').eq('workspace_id', workspaceId).in('status', ['active', 'invited'])
    if (membersError) return reply({ message: 'Não foi possível conferir os acessos vinculados.' }, 503)
    const assigned = (linkedMembers || []).filter((item: any) => Array.isArray(item.permissions?.client_ids) && item.permissions.client_ids.map(String).includes(clientId))
    if (assigned.length) dependencies.push({ key: 'permissoes', label: 'permissões de usuários', count: assigned.length })
    if (dependencies.length) return reply({ message: 'Este cliente possui vínculos ou histórico. Inative o cadastro em vez de excluí-lo.', dependencies }, 409)

    const next = { ...payload, med_clientes: clients.filter((item: Record<string, unknown>) => String(item?.id || '') !== clientId) }
    const nextVersion = Number(snapshot.version || 1) + 1
    const { data: saved, error: saveError } = await service.from('office_workspace_snapshots')
      .update({ payload: next, version: nextVersion, updated_by: auth.user.id, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId).eq('version', snapshot.version).select('version').maybeSingle()
    if (saveError) return reply({ message: 'Não foi possível excluir o cadastro. Nenhuma alteração foi confirmada.' }, 503)
    if (!saved) continue

    const { error: auditError } = await service.from('office_audit_log').insert({
      workspace_id: workspaceId, actor_user_id: auth.user.id, actor_name: auth.user.email || 'Administrador',
      actor_role: member.role, action: 'delete', entity_type: 'clients', entity_id: clientId,
      summary: 'Cadastro sem vínculos excluído após confirmação', details: { origem: 'MED', tipo: 'cadastro_sem_vinculos' },
    })
    if (auditError) console.error('office-client-delete audit failed', auditError.message)
    return reply({ ok: true, client_id: clientId, audit_warning: Boolean(auditError) })
  }
  return reply({ message: 'O escritório foi alterado simultaneamente. Atualize e tente novamente.' }, 409)
})
