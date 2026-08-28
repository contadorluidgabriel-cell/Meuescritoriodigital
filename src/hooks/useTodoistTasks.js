import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.js'

async function invokeTodoist(body) {
  const { data, error } = await supabase.functions.invoke('todoist-sync', { body })
  if (!error) return data || {}
  if (error instanceof FunctionsHttpError) {
    let detail = null
    try { detail = await error.context.json() } catch { /* response without JSON body */ }
    throw new Error(detail?.error || detail?.message || error.message)
  }
  throw new Error(error.message || 'Não foi possível acessar o Todoist.')
}

export function useTodoistTasks({ enabled, tasks, update }) {
  const [state, setState] = useState({
    checking: Boolean(enabled),
    configured: true,
    connected: false,
    busy: false,
    message: enabled ? 'Verificando Todoist…' : 'Todoist aguardando acesso',
  })
  const tasksRef = useRef(tasks)
  const syncingRef = useRef(false)
  const debounceRef = useRef(null)

  useEffect(() => { tasksRef.current = tasks }, [tasks])

  const taskSignature = useMemo(() => JSON.stringify((tasks || []).map(task => ({
    id: task.id,
    titulo: task.titulo,
    descricao: task.descricao,
    prazo: task.prazo,
    prioridade: task.prioridade,
    departamento: task.departamento,
    status: task.status,
    updatedAt: task.updatedAt,
  }))), [tasks])

  const refresh = useCallback(async () => {
    if (!enabled) return null
    setState(current => ({ ...current, checking: true, message: 'Verificando Todoist…' }))
    try {
      const data = await invokeTodoist({ action: 'status' })
      const configured = data.configured !== false
      const connected = configured && Boolean(data.connected)
      setState(current => ({
        ...current,
        checking: false,
        configured,
        connected,
        message: !configured ? 'Configuração do Todoist pendente' : connected ? 'Todoist conectado' : 'Todoist indisponível',
      }))
      return data
    } catch (error) {
      setState(current => ({ ...current, checking: false, connected: false, message: error.message }))
      return null
    }
  }, [enabled])

  const syncNow = useCallback(async ({ silent = false, sourceTasks } = {}) => {
    if (!enabled || syncingRef.current) return null
    syncingRef.current = true
    if (!silent) setState(current => ({ ...current, busy: true, message: 'Sincronizando Todoist…' }))
    try {
      const data = await invokeTodoist({ action: 'sync', tasks: sourceTasks || tasksRef.current || [] })
      if (Array.isArray(data.tasks) && JSON.stringify(data.tasks) !== JSON.stringify(tasksRef.current || [])) {
        update(draft => { draft.tasks = data.tasks })
      }
      const time = data.syncedAt
        ? new Date(data.syncedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : ''
      setState(current => ({
        ...current,
        checking: false,
        configured: true,
        connected: true,
        busy: false,
        message: `Todoist sincronizado${time ? ` · ${time}` : ''}`,
      }))
      return data
    } catch (error) {
      setState(current => ({ ...current, checking: false, connected: false, busy: false, message: error.message }))
      if (!silent) throw error
      return null
    } finally {
      syncingRef.current = false
    }
  }, [enabled, update])

  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    refresh().then(data => {
      if (active && data?.connected) syncNow({ silent: true })
    })
    return () => { active = false }
  }, [enabled, refresh, syncNow])

  useEffect(() => {
    if (!enabled || !state.connected) return undefined
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => syncNow({ silent: true, sourceTasks: tasksRef.current }), 1200)
    return () => clearTimeout(debounceRef.current)
  }, [enabled, state.connected, taskSignature, syncNow])

  useEffect(() => {
    if (!enabled) return undefined
    const interval = setInterval(() => {
      if (state.connected) syncNow({ silent: true })
      else refresh()
    }, 120000)
    return () => clearInterval(interval)
  }, [enabled, refresh, state.connected, syncNow])

  return { ...state, refresh, syncNow }
}
