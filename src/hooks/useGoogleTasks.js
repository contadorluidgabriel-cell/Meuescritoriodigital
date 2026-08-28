import { useCallback, useEffect, useRef, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.js'

const GOOGLE_ORIGIN = 'https://pbwnzkmbcuoyyoojgnay.supabase.co'

async function invokeGoogle(body) {
  const { data, error } = await supabase.functions.invoke('google-tasks', { body })
  if (!error) return data || {}
  if (error instanceof FunctionsHttpError) {
    let detail = null
    try { detail = await error.context.json() } catch { /* response without a JSON error body */ }
    throw new Error(detail?.error || detail?.message || error.message)
  }
  throw new Error(error.message || 'Não foi possível acessar o Google Tasks.')
}

export function useGoogleTasks({ enabled, tasks, update, reconcileTasks }) {
  const [state, setState] = useState({ checking: enabled, configured: true, connected: false, busy: false, message: enabled ? 'Verificando Google…' : 'Entre para conectar o Google' })
  const tasksRef = useRef(tasks)
  const reconcileRef = useRef(reconcileTasks)
  const timerRef = useRef(null)
  const syncingRef = useRef(false)
  useEffect(() => { tasksRef.current = tasks }, [tasks])
  useEffect(() => { reconcileRef.current = reconcileTasks }, [reconcileTasks])

  const refresh = useCallback(async () => {
    if (!enabled) return
    setState(current => ({ ...current, checking: true, message: 'Verificando Google…' }))
    try {
      const data = await invokeGoogle({ action: 'status' })
      const configured = data.configured !== false
      setState(current => ({ ...current, checking: false, configured, connected: configured && Boolean(data.connected), message: !configured ? 'Configuração do Google pendente' : data.connected ? 'Google conectado' : 'Google ainda não conectado' }))
      return data
    } catch (error) {
      setState(current => ({ ...current, checking: false, connected: false, message: error.message }))
      return null
    }
  }, [enabled])

  const syncNow = useCallback(async ({ silent = false, sourceTasks } = {}) => {
    if (!enabled || syncingRef.current) return null
    syncingRef.current = true
    if (!silent) setState(current => ({ ...current, busy: true, message: 'Sincronizando…' }))
    try {
      const data = await invokeGoogle({ action: 'sync', tasks: sourceTasks || tasksRef.current })
      if (Array.isArray(data.tasks)) {
        const nextTasks = reconcileRef.current ? reconcileRef.current(data.tasks, tasksRef.current) : data.tasks
        const nextSerialized = JSON.stringify(nextTasks)
        if (nextSerialized !== JSON.stringify(tasksRef.current)) update(draft => { draft.tasks = nextTasks })
      }
      const time = data.syncedAt ? new Date(data.syncedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
      setState(current => ({ ...current, checking: false, connected: true, busy: false, message: `Sincronizado${time ? ` · ${time}` : ''}` }))
      return data
    } catch (error) {
      clearTimeout(timerRef.current)
      setState(current => ({ ...current, checking: false, connected: false, busy: false, message: error.message }))
      if (!silent) throw error
      return null
    } finally {
      syncingRef.current = false
    }
  }, [enabled, update])

  const schedule = useCallback(sourceTasks => {
    if (!state.connected) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => syncNow({ silent: true, sourceTasks }), 1200)
  }, [state.connected, syncNow])

  const connect = useCallback(async () => {
    if (!enabled) return
    setState(current => ({ ...current, busy: true, message: 'Preparando conexão…' }))
    try {
      const data = await invokeGoogle({ action: 'auth-url' })
      const popup = window.open(data.url, 'googleTasksConnect', 'popup,width=540,height=700')
      if (!popup) window.location.href = data.url
      setState(current => ({ ...current, busy: false, message: 'Finalize a conexão na janela do Google' }))
    } catch (error) {
      setState(current => ({ ...current, busy: false, connected: false, message: error.message }))
    }
  }, [enabled])

  const disconnect = useCallback(async () => {
    if (!window.confirm('Desconectar o Google? As tarefas existentes serão mantidas, mas deixarão de sincronizar.')) return
    setState(current => ({ ...current, busy: true, message: 'Desconectando…' }))
    try {
      await invokeGoogle({ action: 'disconnect' })
      clearTimeout(timerRef.current)
      setState(current => ({ ...current, busy: false, connected: false, message: 'Google desconectado' }))
    } catch (error) {
      setState(current => ({ ...current, busy: false, message: error.message }))
    }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    refresh().then(data => {
      if (active && data?.connected) timerRef.current = setTimeout(() => syncNow({ silent: true }), 800)
    })
    const interval = setInterval(() => { if (state.connected) syncNow({ silent: true }) }, 120000)
    return () => { active = false; clearInterval(interval); clearTimeout(timerRef.current) }
  }, [enabled, refresh, syncNow, state.connected])

  useEffect(() => {
    const receive = event => {
      if (event.origin !== GOOGLE_ORIGIN) return
      if (event.data?.type === 'google-tasks-error') { setState(current => ({ ...current, connected: false, busy: false, message: 'Não foi possível conectar o Google.' })); return }
      if (event.data?.type === 'google-tasks-connected') refresh().then(data => { if (data?.connected) syncNow() })
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [refresh, syncNow])

  return { ...state, refresh, connect, disconnect, syncNow, schedule }
}
