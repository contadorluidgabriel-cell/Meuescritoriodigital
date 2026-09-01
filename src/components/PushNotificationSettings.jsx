import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_PUSH_PREFERENCES,
  browserTimeZone,
  disableCurrentDevice,
  isCurrentDeviceEnabled,
  loadPushHistory,
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
const typeLabel = {
  daily: 'Tarefas do dia', midday: 'Check-in do dia', weekly: 'Visão semanal',
  closing: 'Fechamento do dia', weekly_closing: 'Fechamento semanal',
}
const compactTime = value => String(value || '').slice(0, 5)
const compactPrefs = values => ({
  ...values,
  daily_time: compactTime(values.daily_time),
  midday_time: compactTime(values.midday_time),
  weekly_time: compactTime(values.weekly_time),
  closing_time: compactTime(values.closing_time),
  weekly_closing_time: compactTime(values.weekly_closing_time),
})

export default function PushNotificationSettings({ session }) {
  const userId = session?.user?.id || ''
  const support = useMemo(() => pushSupport(), [])
  const [prefs, setPrefs] = useState({ ...DEFAULT_PUSH_PREFERENCES, timezone: browserTimeZone() })
  const [deviceActive, setDeviceActive] = useState(false)
  const [history, setHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loading, setLoading] = useState(Boolean(userId))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!userId) { setLoading(false); return undefined }
    Promise.all([loadPushPreferences(userId), isCurrentDeviceEnabled(userId), loadPushHistory(userId).catch(() => [])])
      .then(([nextPrefs, active, nextHistory]) => {
        if (cancelled) return
        setPrefs(compactPrefs(nextPrefs))
        setDeviceActive(active)
        setHistory(nextHistory)
      })
      .catch(error => { if (!cancelled) setMessage(error?.message || 'Não foi possível carregar as configurações de push.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  function patch(next) { setPrefs(current => ({ ...current, ...next })) }

  async function refreshHistory() {
    if (!userId) return
    try { setHistory(await loadPushHistory(userId)) } catch { /* history is non-critical */ }
  }

  async function activateDevice() {
    if (!userId) return
    setSaving(true); setMessage('')
    try {
      const subscription = await subscribeCurrentDevice(userId)
      const saved = await savePushPreferences(userId, { ...prefs, enabled: true, timezone: browserTimeZone() })
      setPrefs(compactPrefs(saved))
      setDeviceActive(true)
      const registration = await registerPushWorker()
      await registration.showNotification('Notificações ativadas', {
        body: 'Este aparelho agora recebe os resumos inteligentes do Meu Escritório Digital.',
        icon: '/app-icon-v2.svg',
        tag: 'office-push-enabled',
        data: { url: '/?push=meu-dia' },
        actions: [{ action: 'open-day', title: 'Abrir Meu Dia' }],
      })
      if (!subscription) throw new Error('Não foi possível confirmar a assinatura deste aparelho.')
      setMessage('Ativado. Este aparelho pode receber notificações mesmo com o sistema fechado.')
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
      setPrefs(compactPrefs(saved))
      setMessage('Rotina de notificações salva.')
      await refreshHistory()
    } catch (error) {
      setMessage(error?.message || 'Não foi possível salvar as configurações.')
    } finally { setSaving(false) }
  }

  if (!userId) return null

  return <section className="push-settings" aria-label="Notificações push no aparelho">
    <header className="push-settings-header">
      <div><strong>Push no aparelho</strong><small>Resumos e fechamento mesmo com o sistema fechado</small></div>
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

    <div className="push-category-box">
      <strong>O que pode entrar nos resumos</strong>
      <div>{[
        ['include_tasks', 'Tarefas'], ['include_processes', 'Processos'], ['include_obligations', 'Obrigações'], ['include_finance', 'Financeiro'],
      ].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(prefs[key])} onChange={event => patch({ [key]: event.target.checked })} /><span>{label}</span></label>)}</div>
    </div>

    <div className="push-schedule-grid">
      <label className="push-schedule-card">
        <span><input type="checkbox" checked={Boolean(prefs.daily_enabled)} onChange={event => patch({ daily_enabled: event.target.checked })} /> <b>Começo do dia</b></span>
        <small>Prioridades de hoje, atrasos e o que merece ser feito primeiro.</small>
        <input type="time" step="900" value={compactTime(prefs.daily_time)} onChange={event => patch({ daily_time: event.target.value })} disabled={!prefs.daily_enabled} />
      </label>

      <label className="push-schedule-card optional">
        <span><input type="checkbox" checked={Boolean(prefs.midday_enabled)} onChange={event => patch({ midday_enabled: event.target.checked })} /> <b>Check-in no meio do dia</b><em>Opcional</em></span>
        <small>Mostra o progresso e o que ainda precisa ser resolvido.</small>
        <input type="time" step="900" value={compactTime(prefs.midday_time)} onChange={event => patch({ midday_time: event.target.value })} disabled={!prefs.midday_enabled} />
      </label>

      <label className="push-schedule-card">
        <span><input type="checkbox" checked={Boolean(prefs.weekly_enabled)} onChange={event => patch({ weekly_enabled: event.target.checked })} /> <b>Planejamento da semana</b></span>
        <small>Visão da semana inteira, pendências e prioridades.</small>
        <div className="push-weekly-fields">
          <select value={Number(prefs.weekly_weekday)} onChange={event => patch({ weekly_weekday: Number(event.target.value) })} disabled={!prefs.weekly_enabled}>{weekdays.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
          <input type="time" step="900" value={compactTime(prefs.weekly_time)} onChange={event => patch({ weekly_time: event.target.value })} disabled={!prefs.weekly_enabled} />
        </div>
      </label>

      <label className="push-schedule-card">
        <span><input type="checkbox" checked={Boolean(prefs.closing_enabled)} onChange={event => patch({ closing_enabled: event.target.checked })} /> <b>Fechamento do dia</b></span>
        <small>Entregas feitas, o que ficou pendente e atrasos que seguem abertos.</small>
        <input type="time" step="900" value={compactTime(prefs.closing_time)} onChange={event => patch({ closing_time: event.target.value })} disabled={!prefs.closing_enabled} />
      </label>

      <label className="push-schedule-card weekly-close">
        <span><input type="checkbox" checked={Boolean(prefs.weekly_closing_enabled)} onChange={event => patch({ weekly_closing_enabled: event.target.checked })} /> <b>Fechamento semanal</b></span>
        <small>Resumo da operação e do financeiro no encerramento da semana.</small>
        <div className="push-weekly-fields">
          <select value={Number(prefs.weekly_closing_weekday)} onChange={event => patch({ weekly_closing_weekday: Number(event.target.value) })} disabled={!prefs.weekly_closing_enabled}>{weekdays.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
          <input type="time" step="900" value={compactTime(prefs.weekly_closing_time)} onChange={event => patch({ weekly_closing_time: event.target.value })} disabled={!prefs.weekly_closing_enabled} />
        </div>
      </label>
    </div>

    <div className="push-settings-footer">
      <button type="button" onClick={saveSchedule} disabled={saving || loading}>Salvar rotina</button>
      {message ? <small>{message}</small> : <small>Os resumos agrupam informações para evitar excesso de notificações.</small>}
    </div>

    <div className="push-history">
      <button type="button" className="push-history-toggle" onClick={() => { setHistoryOpen(current => !current); if (!historyOpen) refreshHistory() }}><span>Histórico de envios</span><b>{historyOpen ? '−' : '+'}</b></button>
      {historyOpen ? <div className="push-history-list">{history.length ? history.map(item => <article key={item.id}><span>{typeLabel[item.notification_type] || item.notification_type}</span><strong>{item.title || typeLabel[item.notification_type] || 'Notificação'}</strong><small>{item.body || `Período ${item.period_key}`} · {new Date(item.sent_at).toLocaleString('pt-BR')}</small></article>) : <p>Nenhum envio registrado ainda.</p>}</div> : null}
    </div>
  </section>
}
