import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  },
})
const id = (value: unknown) => String(value || '')
const unique = (values: unknown[] = []) => [...new Set(values.map(id).filter(Boolean))]
const internalRole = (role = '') => role === 'admin' || role === 'collaborator'
const done = (value: unknown) => /conclu|recebido/i.test(String(value || ''))
const obligationOpen = (link: any) => !done(link?.status) && String(link?.status || '') !== 'Não se aplica'
const memberName = (member: any) => String(member?.display_name || member?.email || 'Usuário')

async function authenticatedUser(service: any, req: Request) {
  const authorization = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await service.auth.getUser(token)
  return error || !data?.user ? null : data.user
}

async function managerContext(service: any, user: any, workspaceId = '') {
  if (!workspaceId) throw new Error('Workspace não informado.')
  const { data: workspace, error: workspaceError } = await service.from('office_workspaces').select('*').eq('id', workspaceId).single()
  if (workspaceError || !workspace) throw new Error('Escritório não encontrado.')
  const { data: actor, error } = await service.from('office_members').select('*').eq('workspace_id', workspaceId).eq('user_id', user.id).eq('status', 'active').single()
  if (error || !actor || actor.role !== 'admin') throw new Error('Apenas proprietário ou administrador pode alterar a distribuição.')
  const owner = id(workspace.owner_user_id) === id(user.id)
  const scoped = !owner && actor.permissions?.access_v2 === true
  return { workspace, actor, owner, scoped }
}

async function workspaceSnapshot(service: any, workspaceId: string) {
  const { data, error } = await service.from('office_workspace_snapshots').select('payload,version').eq('workspace_id', workspaceId).single()
  if (error || !data) throw new Error('Dados do escritório não encontrados.')
  return { payload: structuredClone(data.payload || {}), version: Number(data.version || 1) }
}

async function saveSnapshot(service: any, workspaceId: string, snapshot: any, actorUserId: string) {
  const nextVersion = Number(snapshot.version || 1) + 1
  const { data, error } = await service.from('office_workspace_snapshots')
    .update({ payload: snapshot.payload, version: nextVersion, updated_by: actorUserId, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId).eq('version', snapshot.version).select('version').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('O escritório foi alterado simultaneamente. Atualize e tente novamente.')
  return nextVersion
}

async function audit(service: any, workspaceId: string, actor: any, action: string, entityId: string, summary: string, details: any = {}) {
  const { data, error } = await service.from('office_audit_log').insert({
    workspace_id: workspaceId,
    actor_user_id: actor.user_id,
    actor_name: memberName(actor),
    actor_role: actor.role || '',
    action,
    entity_type: 'distribution',
    entity_id: entityId,
    summary: String(summary || '').slice(0, 500),
    details: details && typeof details === 'object' ? details : {},
  }).select('*').single()
  if (error) throw error
  return data
}

function scopedCanManageClient(context: any, clientId: string) {
  if (!context.scoped) return true
  const p = context.actor.permissions || {}
  return Boolean(p.clients && p.manage_clients && (Array.isArray(p.client_ids) ? p.client_ids.map(id) : []).includes(id(clientId)))
}

function transferClientOpenWork(payload: any, clientId: string, fromUserId: string, toUserId: string, timestamp: string) {
  const result = { tasks: 0, processes: 0, obligations: 0, total: 0 }
  ;(payload.med_tarefas || []).forEach((item: any) => {
    if (id(item.clientId) !== clientId || done(item.status) || id(item.responsavelUserId) !== fromUserId) return
    item.responsavelUserId = toUserId; item.updatedAt = timestamp; result.tasks += 1
  })
  ;(payload.med_processos || []).forEach((item: any) => {
    if (id(item.clientId) !== clientId || done(item.status) || id(item.responsavelUserId) !== fromUserId) return
    item.responsavelUserId = toUserId; item.updatedAt = timestamp; result.processes += 1
  })
  ;(payload.med_obrigacoes || []).forEach((obligation: any) => (obligation.clientes || []).forEach((link: any) => {
    if (id(link.clienteId) !== clientId || !obligationOpen(link) || id(link.responsavelUserId) !== fromUserId) return
    link.responsavelUserId = toUserId; link.updatedAt = timestamp; result.obligations += 1
  }))
  result.total = result.tasks + result.processes + result.obligations
  return result
}

function assignedOpenWork(payload: any, userId: string) {
  const rows: any[] = []
  ;(payload.med_tarefas || []).forEach((item: any) => { if (!done(item.status) && id(item.responsavelUserId) === userId) rows.push({ kind: 'task', clientId: id(item.clientId), record: item }) })
  ;(payload.med_processos || []).forEach((item: any) => { if (!done(item.status) && id(item.responsavelUserId) === userId) rows.push({ kind: 'process', clientId: id(item.clientId), record: item }) })
  ;(payload.med_obrigacoes || []).forEach((obligation: any) => (obligation.clientes || []).forEach((link: any) => {
    if (obligationOpen(link) && id(link.responsavelUserId) === userId) rows.push({ kind: 'obligation', clientId: id(link.clienteId), record: link, obligation })
  }))
  return rows
}

function routineForKind(kind: string) {
  if (kind === 'task') return 'tasks'
  if (kind === 'process') return 'processes'
  return 'obligations'
}

function memberCanReceive(member: any, work: any, ownerUserId: string, extraClientIds: string[] = []) {
  if (!member || member.status !== 'active' || !member.user_id || !internalRole(member.role)) return false
  if (id(member.user_id) === id(ownerUserId)) return true
  const p = member.permissions || {}
  const routine = routineForKind(work.kind)
  if (p.access_v2 === true) {
    if (!p[routine]) return false
    if (!work.clientId) return work.kind === 'task'
    return new Set(unique([...(Array.isArray(p.client_ids) ? p.client_ids : []), ...extraClientIds])).has(work.clientId)
  }
  return p[routine] !== false
}

async function activeInternalMember(service: any, workspaceId: string, userId: string) {
  const { data } = await service.from('office_members').select('*').eq('workspace_id', workspaceId).eq('user_id', userId).eq('status', 'active').maybeSingle()
  return data && internalRole(data.role) ? data : null
}

async function grantCompanyAccessIfV2(service: any, member: any, clientIds: string[]) {
  if (!member || member.permissions?.access_v2 !== true || !clientIds.length) return member
  const permissions = { ...(member.permissions || {}), client_ids: unique([...(member.permissions.client_ids || []), ...clientIds]) }
  const { data, error } = await service.from('office_members').update({ permissions, updated_at: new Date().toISOString() }).eq('id', member.id).select('*').single()
  if (error) throw error
  return data
}

async function setPrimary(service: any, user: any, body: any) {
  const workspaceId = id(body.workspace_id)
  const clientId = id(body.client_id)
  const nextUserId = id(body.user_id)
  const transferOpen = body.transfer_open === true
  const context = await managerContext(service, user, workspaceId)
  if (!clientId || !scopedCanManageClient(context, clientId)) throw new Error('Você não pode alterar a responsabilidade desta empresa.')

  const snapshot = await workspaceSnapshot(service, workspaceId)
  const clients = Array.isArray(snapshot.payload.med_clientes) ? snapshot.payload.med_clientes : []
  const client = clients.find((item: any) => id(item.id) === clientId)
  if (!client) throw new Error('Cliente não encontrado.')

  let nextMember: any = null
  if (nextUserId) {
    nextMember = await activeInternalMember(service, workspaceId, nextUserId)
    if (!nextMember) throw new Error('O novo responsável precisa ser um usuário interno ativo.')
    nextMember = await grantCompanyAccessIfV2(service, nextMember, [clientId])
  }

  const previousUserId = id(client.responsavelPrincipalUserId)
  const timestamp = new Date().toISOString()
  client.responsavelPrincipalUserId = nextUserId
  client.responsavelPrincipalNome = nextMember ? memberName(nextMember) : ''
  client.updatedAt = timestamp

  const transferred = transferOpen ? transferClientOpenWork(snapshot.payload, clientId, previousUserId, nextUserId, timestamp) : { tasks: 0, processes: 0, obligations: 0, total: 0 }
  await saveSnapshot(service, workspaceId, snapshot, user.id)
  const targetLabel = nextMember ? memberName(nextMember) : 'Não atribuído'
  const event = await audit(service, workspaceId, context.actor, 'set_primary', clientId,
    `Responsável principal de ${client.razao || client.nome || client.fantasia || 'cliente'} definido como ${targetLabel}${transferOpen ? `; ${transferred.total} trabalho(s) aberto(s) transferido(s)` : ''}.`,
    { client_id: clientId, previous_user_id: previousUserId, user_id: nextUserId, transfer_open: transferOpen, transferred })
  return { ok: true, transferred, audit: event }
}

async function deactivateMember(service: any, user: any, body: any) {
  const workspaceId = id(body.workspace_id)
  const memberId = id(body.member_id)
  const replacementUserId = id(body.replacement_user_id)
  const context = await managerContext(service, user, workspaceId)
  const { data: target, error: targetError } = await service.from('office_members').select('*').eq('workspace_id', workspaceId).eq('id', memberId).single()
  if (targetError || !target) throw new Error('Usuário não encontrado.')
  if (id(target.user_id) === id(context.workspace.owner_user_id)) throw new Error('O proprietário não pode ser desativado.')
  if (!internalRole(target.role)) throw new Error('Parceiros serão gerenciados na área de Parceiros.')
  if (context.scoped && (target.role === 'admin' && target.permissions?.access_v2 !== true)) throw new Error('Este administrador só pode ser desativado pelo proprietário ou por um administrador integral.')
  if (replacementUserId && replacementUserId === id(target.user_id)) throw new Error('Selecione outro usuário para receber os trabalhos.')

  const snapshot = await workspaceSnapshot(service, workspaceId)
  const targetUserId = id(target.user_id)
  if (!targetUserId) throw new Error('O usuário ainda não possui uma conta vinculada.')
  const clients = Array.isArray(snapshot.payload.med_clientes) ? snapshot.payload.med_clientes : []
  const principalClients = clients.filter((client: any) => id(client.responsavelPrincipalUserId) === targetUserId)
  const principalIds = principalClients.map((client: any) => id(client.id))
  const work = assignedOpenWork(snapshot.payload, targetUserId)

  let replacement: any = null
  if (replacementUserId) {
    replacement = await activeInternalMember(service, workspaceId, replacementUserId)
    if (!replacement) throw new Error('O substituto precisa ser um usuário interno ativo.')
    const incompatible = work.filter(item => !memberCanReceive(replacement, item, context.workspace.owner_user_id, principalIds))
    if (incompatible.length) throw new Error(`${incompatible.length} trabalho(s) não podem ser transferidos porque o substituto não possui a rotina ou a empresa necessária. Ajuste os acessos ou deixe como Não atribuído.`)
    replacement = await grantCompanyAccessIfV2(service, replacement, principalIds)
  }

  const nextUserId = replacement ? id(replacement.user_id) : ''
  const nextName = replacement ? memberName(replacement) : ''
  const timestamp = new Date().toISOString()
  principalClients.forEach((client: any) => {
    client.responsavelPrincipalUserId = nextUserId
    client.responsavelPrincipalNome = nextName
    client.updatedAt = timestamp
  })
  work.forEach(item => { item.record.responsavelUserId = nextUserId; item.record.updatedAt = timestamp })

  const counts = {
    companies: principalClients.length,
    tasks: work.filter(item => item.kind === 'task').length,
    processes: work.filter(item => item.kind === 'process').length,
    obligations: work.filter(item => item.kind === 'obligation').length,
  }
  ;(counts as any).total = counts.tasks + counts.processes + counts.obligations

  await saveSnapshot(service, workspaceId, snapshot, user.id)
  const { error: disableError } = await service.from('office_members').update({ status: 'disabled', updated_at: timestamp }).eq('id', target.id)
  if (disableError) throw disableError
  const destination = replacement ? memberName(replacement) : 'Não atribuído'
  const event = await audit(service, workspaceId, context.actor, 'deactivate_member', memberId,
    `${memberName(target)} desativado; ${counts.companies} empresa(s) e ${counts.total} trabalho(s) direcionado(s) para ${destination}.`,
    { member_id: memberId, target_user_id: targetUserId, replacement_user_id: nextUserId, counts })
  return { ok: true, counts, audit: event }
}

async function recordEvent(service: any, user: any, body: any) {
  const workspaceId = id(body.workspace_id)
  const context = await managerContext(service, user, workspaceId)
  const summary = String(body.summary || '').trim()
  if (!summary) throw new Error('Resumo do evento não informado.')
  const event = await audit(service, workspaceId, context.actor, 'manual_distribution', id(body.entity_id), summary, body.details || {})
  return { ok: true, audit: event }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type' } })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server_not_configured' }, 500)
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const user = await authenticatedUser(service, req)
  if (!user) return json({ error: 'unauthorized', message: 'Sessão inválida.' }, 401)
  let body: any = {}
  try { body = await req.json() } catch { body = {} }
  try {
    const action = String(body.action || '')
    if (action === 'set_primary_responsible') return json(await setPrimary(service, user, body))
    if (action === 'deactivate_member') return json(await deactivateMember(service, user, body))
    if (action === 'record_event') return json(await recordEvent(service, user, body))
    return json({ error: 'unknown_action' }, 400)
  } catch (error) {
    console.error('office-distribution failed', (error as Error)?.message || String(error))
    return json({ error: 'distribution_error', message: (error as Error)?.message || 'Falha ao atualizar a distribuição.' }, 400)
  }
})
