import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import webpush from 'npm:web-push@3.6.7'
import { buildOfficeDigest, localClockParts, periodKey, shouldDispatch } from './digest.js'
import { filterPushPayload } from './recipientAccess.js'

const VAPID_PUBLIC_KEY = 'BO02_KpgqpcYBykMrxEOXeua9UfB3H0kebaj--zXw-3OUATgsCJ4tmnh45uP20IMvd5bAbnuWkkwmoSjrRHUzRw'
const PUSH_TYPES = ['daily', 'midday', 'weekly', 'closing', 'weekly_closing'] as const

type PushType = typeof PUSH_TYPES[number]

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
})

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'server_not_configured' }, 500)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: serverConfig, error: configError } = await supabase.rpc('get_office_push_server_config')
  if (configError || !serverConfig?.vapid_private_key || !serverConfig?.cron_token) {
    console.error('push config unavailable', configError?.message || 'missing secrets')
    return json({ error: 'push_config_unavailable' }, 500)
  }

  if (req.headers.get('x-cron-token') !== serverConfig.cron_token) return json({ error: 'unauthorized' }, 401)

  webpush.setVapidDetails(
    'https://meu-escritorio-digital.vercel.app',
    VAPID_PUBLIC_KEY,
    serverConfig.vapid_private_key,
  )

  const { data: preferences, error: preferencesError } = await supabase
    .from('office_push_preferences')
    .select('*')
    .eq('enabled', true)

  if (preferencesError) {
    console.error('push preferences query failed', preferencesError.message)
    return json({ error: 'preferences_query_failed' }, 500)
  }

  const now = new Date()
  const due = (preferences || []).flatMap(preference => {
    const local = localClockParts(now, preference.timezone || 'America/Sao_Paulo')
    return PUSH_TYPES
      .filter(type => shouldDispatch(preference, type, now))
      .map(type => ({ preference, type: type as PushType, localDate: local.date, period: periodKey(type, local.date) }))
  })

  if (!due.length) return json({ ok: true, due: 0, sent: 0 })

  const userIds = [...new Set(due.map(item => String(item.preference.user_id)))]
  const [
    { data: workspacePreferences, error: workspacePreferenceError },
    { data: memberships, error: membershipError },
    { data: subscriptions, error: subscriptionError },
    { data: legacySnapshots, error: legacySnapshotError },
  ] = await Promise.all([
    supabase.from('office_user_workspace_preferences').select('user_id,active_workspace_id').in('user_id', userIds),
    supabase.from('office_members').select('user_id,workspace_id,role,partner_id,permissions,status').in('user_id', userIds).eq('status', 'active'),
    supabase.from('office_push_subscriptions').select('id,user_id,endpoint,p256dh,auth_key,enabled').in('user_id', userIds).eq('enabled', true),
    supabase.from('office_snapshots').select('user_id,payload').in('user_id', userIds),
  ])

  if (workspacePreferenceError || membershipError || subscriptionError || legacySnapshotError) {
    console.error('push source query failed', workspacePreferenceError?.message || membershipError?.message || subscriptionError?.message || legacySnapshotError?.message)
    return json({ error: 'source_query_failed' }, 500)
  }

  const preferredWorkspaceByUser = new Map((workspacePreferences || []).map(row => [String(row.user_id), String(row.active_workspace_id || '')]))
  const membershipsByUser = new Map<string, any[]>()
  for (const membership of memberships || []) {
    const key = String(membership.user_id)
    membershipsByUser.set(key, [...(membershipsByUser.get(key) || []), membership])
  }

  const selectedMembershipByUser = new Map<string, any>()
  for (const userId of userIds) {
    const rows = membershipsByUser.get(userId) || []
    const preferred = preferredWorkspaceByUser.get(userId) || ''
    const selected = rows.find(row => String(row.workspace_id) === preferred) || rows.find(row => row.role === 'admin') || rows[0]
    if (selected) selectedMembershipByUser.set(userId, selected)
  }

  const workspaceIds = [...new Set([...selectedMembershipByUser.values()].map(row => String(row.workspace_id)).filter(Boolean))]
  const { data: workspaceSnapshots, error: workspaceSnapshotError } = workspaceIds.length
    ? await supabase.from('office_workspace_snapshots').select('workspace_id,payload').in('workspace_id', workspaceIds)
    : { data: [], error: null }
  if (workspaceSnapshotError) {
    console.error('workspace snapshot query failed', workspaceSnapshotError.message)
    return json({ error: 'workspace_snapshot_query_failed' }, 500)
  }

  const workspacePayloads = new Map((workspaceSnapshots || []).map(row => [String(row.workspace_id), row.payload || {}]))
  const legacyByUser = new Map((legacySnapshots || []).map(row => [String(row.user_id), row.payload || {}]))
  const payloadByUser = new Map<string, any>()
  for (const userId of userIds) {
    const membership = selectedMembershipByUser.get(userId)
    if (membership) {
      const fullPayload = workspacePayloads.get(String(membership.workspace_id))
      if (fullPayload) {
        payloadByUser.set(userId, filterPushPayload(fullPayload, membership, userId))
        continue
      }
    }
    const legacy = legacyByUser.get(userId)
    if (legacy) payloadByUser.set(userId, legacy)
  }

  const subscriptionsByUser = new Map<string, any[]>()
  for (const subscription of subscriptions || []) {
    const key = String(subscription.user_id)
    subscriptionsByUser.set(key, [...(subscriptionsByUser.get(key) || []), subscription])
  }

  const earliestLog = new Date(now.getTime() - 10 * 86400000).toISOString()
  const { data: recentLogs, error: logsError } = await supabase
    .from('office_push_delivery_log')
    .select('subscription_id,notification_type,period_key')
    .in('user_id', userIds)
    .gte('sent_at', earliestLog)

  if (logsError) {
    console.error('push delivery log query failed', logsError.message)
    return json({ error: 'delivery_log_query_failed' }, 500)
  }

  const delivered = new Set((recentLogs || []).map(row => `${row.subscription_id}|${row.notification_type}|${row.period_key}`))
  let sent = 0
  let skipped = 0
  let expired = 0
  let failed = 0

  for (const item of due) {
    const userId = String(item.preference.user_id)
    const payloadSource = payloadByUser.get(userId)
    if (!payloadSource) { skipped += 1; continue }

    const digest = buildOfficeDigest(payloadSource, item.type, item.localDate, item.preference)
    const targets = subscriptionsByUser.get(userId) || []

    for (const subscription of targets) {
      const deliveryKey = `${subscription.id}|${item.type}|${item.period}`
      if (delivered.has(deliveryKey)) { skipped += 1; continue }

      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
      }
      const pushPayload = JSON.stringify({
        title: digest.title,
        body: digest.body,
        tag: digest.tag,
        url: digest.url,
        actions: digest.actions || [],
        type: item.type,
      })

      try {
        const longLived = item.type === 'weekly' || item.type === 'weekly_closing'
        await webpush.sendNotification(pushSubscription, pushPayload, { TTL: longLived ? 21600 : 7200 })
        const { error: insertError } = await supabase.from('office_push_delivery_log').insert({
          subscription_id: subscription.id,
          user_id: userId,
          notification_type: item.type,
          period_key: item.period,
          title: digest.title,
          body: digest.body,
        })
        if (insertError && insertError.code !== '23505') console.error('push log insert failed', insertError.message)
        delivered.add(deliveryKey)
        sent += 1
      } catch (error) {
        const statusCode = Number((error as any)?.statusCode || 0)
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('office_push_subscriptions').delete().eq('id', subscription.id)
          expired += 1
        } else {
          console.error('push delivery failed', statusCode || 'unknown', (error as Error)?.message || String(error))
          failed += 1
        }
      }
    }
  }

  return json({ ok: true, due: due.length, sent, skipped, expired, failed })
})
