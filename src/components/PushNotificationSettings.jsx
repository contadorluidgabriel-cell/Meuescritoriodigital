import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_PUSH_PREFERENCES,
  browserTimeZone,
  disableCurrentDevice,
  isCurrentDeviceEnabled,
  loadPushPreferences,
  pushSupport,
  registerPushWorker,
  savePushPreferences,
  subscribeCurrentDevice,
} from '../lib/pushNotifications.js'

const weekdays = [
  [1, 'Segunda-feira'], [2, 'Terça-feira'], [3, 'Quarta-feira'], [4, 'Quinta-feira'],
  [5, 'Sexta-feira'], [6, 'Sábado'], [0, 'Domingo'],
]

const compactTime = value => String(value || '').slice(0, 5)

export default function PushNotificationSettings({ session }) {
  const userId = session?.user?.id || ''
  const support = useMemo(() => pushSupport(), [])
  const [prefs, setPrefs] = useState({ ...DEFAULT_PUSH_PREFERENCES, timezone: browserTimeZone() })
  const [deviceActive, setDeviceActive] = useState(false)
  const [loading, setLoading] = useState(Boolean(userId))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!userId) { setLoading(false); return undefined }
    Promise.all([loadPushPreferences(userId), isCurrentDeviceEnabled(userId)])
      .then(([nextPrefs, active]) => {
        if (cancelled) return
        setPrefs({ ...nextPrefs, daily_time: compactTime(nextPrefs.daily_time), weekly_time: compactTime(nextPrefs.weekly_time), closing_time: compactTime(nextPrefs.closing_time) })
        setDeviceActive(active)
      })
      .catch(error => { if (!cancelled) setMessage(error?.message || 'Não foi possível carregar as configurações de push.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  function patch(next) {
    setPrefs(current => ({ ...current, ...next }))
  }

  async function activateDevice() {
    if (!userId) return
    setSaving(true); setMessage('')
    try {
      const subscription = await subscribeCurrentDevice(userId)
      const saved = await savePushPreferences(userId, { ...prefs, enabled: true, timezone: browserTimeZone() })
      setPrefs({ ...saved, daily_time: compactTime(saved.daily_time), weekly_time: compactTime(saved.weekly_time), closing_time: compactTime(saved.closing_time) })
      setDeviceActive(true)
      const registration = await registerPushWorker()
      await registration.showNotification('Notificações ativadas', {
        body: 'Este aparelho agora pode receber os resumos do Meu Escritório Digital.',
        icon: '/app-icon-v2.svg',
        tag: 'office-push-enabled',
        data: { url: '/?push=tarefas' },
      })
      if (!subscription) throw new Error('Não foi possível confirmar a assinatura deste aparelho.')
      setMessage('Ativado. Você receberá os resumos neste aparelho mesmo com o sistema fechado.')
    } catch (error) {
      setMessage(error?.message || 'Não foi possível ativar as notificações neste aparelho.')
    } finally { setSaving(false) }
  }

  async function deactivateDevice() {
    if (!userId) return
    setSaving(true); setMessage('')
    try {
      await disableCurrentDevice(userId)
      setDeviceActive(false)
      setMessage('Notificações desativadas somente neste aparelho.')
    } catch (error) {
      setMessage(error?.message || 'Não foi possível desativar este aparelho.')
    } finally { setSaving(false) }
  }

  async function saveSchedule() {
    if (!userId) return
    setSaving(true); setMessage('')
    try {
      const saved = await savePushPreferences(userId, { ...prefs, timezone: browserTimeZone() })
      setPrefs({ ...saved, daily_time: compactTime(saved.daily_time), weekly_time: compactTime(saved.weekly_time), closing_time: compactTime(saved.closing_time) })
      setMessage('Horários de notificação salvos.')
    } catch (error) {
      setMessage(error?.message || 'Não foi possível salvar os horários.')
    } finally { setSaving(false) }
  }

  if (!userId) return null

  return <section className="push-settings" aria-label="Notificações push no aparelho">
    <header className="push-settings-header">
      <div><strong>Push no aparelho</strong><small>Receba os resumos mesmo com o sistema fechado</small></div>
      <span className={deviceActive ? 'active' : 'inactive'}>{deviceActive ? 'Ativo' : 'Desativado'}</span>
    </header>

    {!support.supported ? <p className="push-support-note danger">Este navegador não oferece suporte a Web Push. Use uma versão atual do Chrome, Edge, Safari ou outro navegador compatível.</p> : null}
    {support.needsIosInstall ? <p className="push-support-note">No iPhone/iPad: use <b>Compartilhar → Adicionar à Tela de Início</b>, abra o sistema pelo ícone instalado e então ative as notificações.</p> : null}

    <div className="push-device-action">
      <button type="button" disabled={saving || loading || !support.supported || support.needsIosInstall} onClick={deviceActive ? deactivateDevice : activateDevice}>
        {loading ? 'Verificando…' : saving ? 'Aguarde…' : deviceActive ? 'Desativar neste aparelho' : 'Ativar neste aparelho'}
      </button>
      <small>Fuso detectado: {prefs.timezone || browserTimeZone()}</small>
    </div>

    <div className="push-schedule-grid">
      <label className="push-schedule-card">
        <span><input type="checkbox" checked={Boolean(prefs.daily_enabled)} onChange={event => patch({ daily_enabled: event.target.checked })} /> <b>Tarefas do dia</b></span>
        <small>O que vence hoje + atrasadas que precisam de atenção.</small>
        <input type="time" step="900" value={compactTime(prefs.daily_time)} onChange={event => patch({ daily_time: event.target.value })} disabled={!prefs.daily_enabled} />
      </label>

      <label className="push-schedule-card">
        <span><input type="checkbox" checked={Boolean(prefs.weekly_enabled)} onChange={event => patch({ weekly_enabled: event.target.checked })} /> <b>Tarefas da semana</b></span>
        <small>Visão de segunda a domingo, com pendentes e concluídas.</small>
        <div className="push-weekly-fields">
          <select value={Number(prefs.weekly_weekday)} onChange={event => patch({ weekly_weekday: Number(event.target.value) })} disabled={!prefs.weekly_enabled}>
            {weekdays.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          <input type="time" step="900" value={compactTime(prefs.weekly_time)} onChange={event => patch({ weekly_time: event.target.value })} disabled={!prefs.weekly_enabled} />
        </div>
      </label>

      <label className="push-schedule-card">
        <span><input type="checkbox" checked={Boolean(prefs.closing_enabled)} onChange={event => patch({ closing_enabled: event.target.checked })} /> <b>Fechamento do dia</b></span>
        <small>Quantas tarefas do dia foram concluídas, o que ficou pendente e atrasos.</small>
        <input type="time" step="900" value={compactTime(prefs.closing_time)} onChange={event => patch({ closing_time: event.target.value })} disabled={!prefs.closing_enabled} />
      </label>
    </div>

    <div className="push-settings-footer">
      <button type="button" onClick={saveSchedule} disabled={saving || loading}>Salvar horários</button>
      {message ? <small>{message}</small> : <small>Horários podem ser alterados a qualquer momento.</small>}
    </div>
  </section>
}
