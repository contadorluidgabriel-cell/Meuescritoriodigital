import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { ACTIVE_USER_KEY, getLocalUpdatedAt, loadOffice, officePayload, payloadToOffice, saveOffice, userStoragePrefix } from '../lib/storage.js'

const timeValue = value => {
  const parsed = Date.parse(value || '')
  return Number.isFinite(parsed) ? parsed : 0
}

export function useOfficeData(session) {
  const [office, setOfficeState] = useState(loadOffice)
  const [ready, setReady] = useState(false)
  const [sync, setSync] = useState('Aguardando acesso')
  const hydratedUser = useRef(null)
  const cloudWriteAllowed = useRef(false)
  const dirtyVersion = useRef(0)
  const syncedVersion = useRef(0)
  const writeChain = useRef(Promise.resolve())

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      hydratedUser.current = null
      cloudWriteAllowed.current = false
      dirtyVersion.current = 0
      syncedVersion.current = 0
      setReady(false)
      return
    }
    if (hydratedUser.current === userId) return

    let active = true
    cloudWriteAllowed.current = false
    dirtyVersion.current = 0
    syncedVersion.current = 0
    setReady(false)
    setSync('Carregando…')

    async function hydrate() {
      const local = loadOffice(userId)
      const localUpdatedAt = getLocalUpdatedAt(userId)
      const timeout = new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 12000))
      const request = supabase.from('office_snapshots').select('payload,updated_at').eq('user_id', userId).maybeSingle()
      const result = await Promise.race([request, timeout])
      if (!active) return

      if (result?.timedOut || result?.error) {
        hydratedUser.current = userId
        saveOffice(local, userId, { touch: false })
        setOfficeState(local)
        setReady(true)
        setSync(result?.timedOut ? 'Modo local · conexão lenta' : 'Modo local · falha na nuvem')
        return
      }

      const hasRemote = Boolean(result.data?.payload)
      const remoteUpdatedAt = result.data?.updated_at || ''
      const localIsNewer = Boolean(localUpdatedAt) && timeValue(localUpdatedAt) > timeValue(remoteUpdatedAt)
      const next = hasRemote && !localIsNewer ? payloadToOffice(result.data.payload) : local

      hydratedUser.current = userId
      saveOffice(next, userId, { touch: false })
      setOfficeState(next)
      setReady(true)
      cloudWriteAllowed.current = true

      if (!hasRemote || localIsNewer) {
        const { error } = await supabase.from('office_snapshots').upsert({
          user_id: userId,
          payload: officePayload(next, userId),
          app_version: '11.1',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        if (!active) return
        if (error) {
          cloudWriteAllowed.current = false
          setSync('Modo local · falha ao reconciliar nuvem')
          return
        }
      }

      setSync('Sincronizado')
    }

    hydrate().catch(() => {
      if (!active) return
      const local = loadOffice(userId)
      hydratedUser.current = userId
      saveOffice(local, userId, { touch: false })
      setOfficeState(local)
      setReady(true)
      cloudWriteAllowed.current = false
      setSync('Modo local · falha na nuvem')
    })

    return () => { active = false }
  }, [session?.user?.id])

  useEffect(() => {
    const userId = session?.user?.id
    if (!ready || !userId) return undefined
    const prefix = userStoragePrefix(userId)
    const refresh = event => {
      if (!event.key) return
      const activeUser = localStorage.getItem(ACTIVE_USER_KEY)
      const isScoped = event.key.startsWith(prefix)
      const isActiveLegacyMirror = activeUser === String(userId) && event.key.startsWith('med_') && !event.key.startsWith('med_user_')
      if (isScoped || isActiveLegacyMirror) setOfficeState(loadOffice(userId))
    }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [ready, session?.user?.id])

  useEffect(() => {
    const userId = session?.user?.id
    if (!ready || !userId) return undefined

    const version = dirtyVersion.current
    const hasLocalMutation = version > syncedVersion.current
    saveOffice(office, userId, { touch: hasLocalMutation })
    if (!hasLocalMutation) return undefined

    if (!cloudWriteAllowed.current) {
      setSync('Modo local · alterações salvas neste navegador')
      return undefined
    }

    setSync('Salvando…')
    const timer = setTimeout(() => {
      const snapshot = structuredClone(office)
      writeChain.current = writeChain.current.then(async () => {
        if (!cloudWriteAllowed.current) return
        const { error } = await supabase.from('office_snapshots').upsert({
          user_id: userId,
          payload: officePayload(snapshot, userId),
          app_version: '11.1',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

        if (error) {
          cloudWriteAllowed.current = false
          setSync('Falha ao salvar · dados mantidos neste navegador')
          return
        }
        syncedVersion.current = Math.max(syncedVersion.current, version)
        if (dirtyVersion.current <= syncedVersion.current) setSync('Sincronizado')
      }).catch(() => {
        cloudWriteAllowed.current = false
        setSync('Falha ao salvar · dados mantidos neste navegador')
      })
    }, 650)

    return () => clearTimeout(timer)
  }, [office, ready, session?.user?.id])

  const update = useCallback(recipe => setOfficeState(current => {
    const draft = structuredClone(current)
    recipe(draft)
    dirtyVersion.current += 1
    return draft
  }), [])

  return { office, update, ready, sync }
}
