import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { invokeEdgeJson } from '../lib/workspaceSync.js'

export function useFollowUps(workspaceId, userId) {
  const [records, setRecords] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestId = useRef(0)

  const request = useCallback(async (action, values = {}) => {
    if (!workspaceId || !userId) throw new Error('Entre no escritório para acessar os acompanhamentos.')
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return invokeEdgeJson('office-follow-ups', {
      token,
      body: { action, workspace_id: workspaceId, ...values },
      fallback: 'Não foi possível sincronizar os acompanhamentos.',
    })
  }, [workspaceId, userId])

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!workspaceId || !userId) return
    const version = ++requestId.current
    if (!silent) setLoading(true)
    try {
      const result = await request('list')
      if (version !== requestId.current) return
      setRecords(Array.isArray(result?.records) ? result.records : [])
      setMembers(Array.isArray(result?.members) ? result.members : [])
      setError('')
    } catch (cause) {
      if (version === requestId.current) setError(cause?.message || 'Falha ao carregar acompanhamentos.')
    } finally {
      if (version === requestId.current) setLoading(false)
    }
  }, [request, workspaceId, userId])

  useEffect(() => {
    requestId.current += 1
    setRecords([])
    setMembers([])
    setError('')
    setLoading(true)
    if (!workspaceId || !userId) return undefined
    refresh()
    const timer = setInterval(() => refresh({ silent: true }), 45000)
    const focus = () => refresh({ silent: true })
    window.addEventListener('focus', focus)
    return () => { requestId.current += 1; clearInterval(timer); window.removeEventListener('focus', focus) }
  }, [refresh, workspaceId, userId])

  const act = useCallback(async (action, values = {}) => {
    try {
      const result = await request(action, values)
      await refresh({ silent: true })
      return result
    } catch (cause) {
      const message = cause?.message || 'Não foi possível salvar o acompanhamento.'
      setError(message)
      throw new Error(message)
    }
  }, [request, refresh])

  return { records, members, loading, error, refresh, act }
}
