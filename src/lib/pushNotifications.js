import { supabase } from './supabase.js'

export const VAPID_PUBLIC_KEY = 'BO02_KpgqpcYBykMrxEOXeua9UfB3H0kebaj--zXw-3OUATgsCJ4tmnh45uP20IMvd5bAbnuWkkwmoSjrRHUzRw'

export const DEFAULT_PUSH_PREFERENCES = {
  enabled: true,
  timezone: 'America/Sao_Paulo',
  daily_enabled: true,
  daily_time: '08:00',
  midday_enabled: false,
  midday_time: '14:00',
  weekly_enabled: true,
  weekly_weekday: 1,
  weekly_time: '08:00',
  closing_enabled: true,
  closing_time: '18:00',
  weekly_closing_enabled: true,
  weekly_closing_weekday: 5,
  weekly_closing_time: '18:00',
  include_tasks: true,
  include_processes: true,
  include_obligations: true,
  include_finance: true,
}

export function browserTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo' } catch { return 'America/Sao_Paulo' }
}

function base64UrlToUint8Array(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)))
}

function deviceLabel() {
  const ua = navigator.userAgent || ''
  const family = /iPhone|iPad|iPod/i.test(ua) ? 'iPhone/iPad' : /Android/i.test(ua) ? 'Android' : /Windows/i.test(ua) ? 'Windows' : /Macintosh/i.test(ua) ? 'Mac' : 'Navegador'
  return `${family} · ${navigator.platform || 'Web'}`
}

export function pushSupport() {
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const isiOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent || '')
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true)
  return { supported, isiOS, standalone, needsIosInstall: supported && isiOS && !standalone }
}

export async function registerPushWorker() {
  if (!pushSupport().supported) throw new Error('Este navegador não oferece suporte a notificações push.')
  return navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
}

export async function loadPushPreferences(userId) {
  const timezone = browserTimeZone()
  const { data, error } = await supabase.from('office_push_preferences').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return { ...DEFAULT_PUSH_PREFERENCES, timezone, ...(data || {}) }
}

export async function savePushPreferences(userId, values = {}) {
  const payload = {
    ...DEFAULT_PUSH_PREFERENCES,
    ...values,
    user_id: userId,
    timezone: values.timezone || browserTimeZone(),
    daily_time: String(values.daily_time || DEFAULT_PUSH_PREFERENCES.daily_time).slice(0, 5),
    midday_time: String(values.midday_time || DEFAULT_PUSH_PREFERENCES.midday_time).slice(0, 5),
    weekly_time: String(values.weekly_time || DEFAULT_PUSH_PREFERENCES.weekly_time).slice(0, 5),
    closing_time: String(values.closing_time || DEFAULT_PUSH_PREFERENCES.closing_time).slice(0, 5),
    weekly_closing_time: String(values.weekly_closing_time || DEFAULT_PUSH_PREFERENCES.weekly_closing_time).slice(0, 5),
    weekly_weekday: Number(values.weekly_weekday ?? DEFAULT_PUSH_PREFERENCES.weekly_weekday),
    weekly_closing_weekday: Number(values.weekly_closing_weekday ?? DEFAULT_PUSH_PREFERENCES.weekly_closing_weekday),
    include_tasks: Boolean(values.include_tasks ?? DEFAULT_PUSH_PREFERENCES.include_tasks),
    include_processes: Boolean(values.include_processes ?? DEFAULT_PUSH_PREFERENCES.include_processes),
    include_obligations: Boolean(values.include_obligations ?? DEFAULT_PUSH_PREFERENCES.include_obligations),
    include_finance: Boolean(values.include_finance ?? DEFAULT_PUSH_PREFERENCES.include_finance),
    updated_at: new Date().toISOString(),
  }
  delete payload.created_at
  const { data, error } = await supabase.from('office_push_preferences').upsert(payload, { onConflict: 'user_id' }).select().single()
  if (error) throw error
  return data
}

export async function loadPushHistory(userId, limit = 12) {
  const { data, error } = await supabase
    .from('office_push_delivery_log')
    .select('id,notification_type,period_key,title,body,sent_at')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(Math.max(1, Math.min(30, Number(limit) || 12)))
  if (error) throw error
  return data || []
}

export async function currentDeviceSubscription() {
  if (!pushSupport().supported) return null
  const registration = await navigator.serviceWorker.getRegistration('/') || await registerPushWorker()
  return registration.pushManager.getSubscription()
}

export async function subscribeCurrentDevice(userId) {
  const support = pushSupport()
  if (!support.supported) throw new Error('Este aparelho/navegador não suporta notificações push.')
  if (support.needsIosInstall) throw new Error('No iPhone/iPad, adicione o sistema à Tela de Início e abra por lá antes de ativar as notificações.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('A permissão de notificações não foi concedida neste aparelho.')

  const registration = await registerPushWorker()
  await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('O navegador não retornou uma assinatura push válida.')

  const { error } = await supabase.from('office_push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth_key: json.keys.auth,
    timezone: browserTimeZone(),
    device_label: deviceLabel(),
    enabled: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  if (error) throw error
  return subscription
}

export async function disableCurrentDevice(userId) {
  const subscription = await currentDeviceSubscription()
  if (!subscription) return false
  const endpoint = subscription.endpoint
  const { error } = await supabase.from('office_push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint)
  if (error) throw error
  await subscription.unsubscribe()
  return true
}

export async function isCurrentDeviceEnabled(userId) {
  const subscription = await currentDeviceSubscription()
  if (!subscription) return false
  const { data, error } = await supabase.from('office_push_subscriptions').select('id,enabled').eq('user_id', userId).eq('endpoint', subscription.endpoint).maybeSingle()
  if (error) throw error
  return Boolean(data?.enabled)
}
