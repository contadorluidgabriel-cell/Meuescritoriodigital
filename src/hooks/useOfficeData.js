import { useCallback, useEffect, useRef, useState } from 'react'
import { getLocalUpdatedAt, loadOffice, payloadToOffice, saveOffice } from '../lib/storage.js'
import { buildOfficePatch, hasOfficePatch, isAdminAccess, loadWorkspace, preferredWorkspaceId, saveWorkspace } from '../lib/workspaceSync.js'
import { useTodoistTasks } from './useTodoistTasks.js'

const timeValue = value => {
  const parsed = Date.parse(value || '')
  return Number.isFinite(parsed) ? parsed : 0
}

const storageScope = (userId, workspaceId) => `${String(userId || '')}_ws_${String(workspaceId || '')}`

export function useOfficeData(session) {
  const [office, setOfficeState] = useState(loadOffice)
  const [ready, setReady] = useState(false)
  const [sync, setSync] = useState('Aguardando acesso')
  const [access, setAccess] = useState({ workspace: null, membership: null, workspaces: [] })
  const [workspaceRequest, setWorkspaceRequest] = useState(() => preferredWorkspaceId())
  const hydratedKey = useRef('')
  const cloudWriteAllowed = useRef(false)
  const dirtyVersion = useRef(0)
  const syncedVersion = useRef(0)
  const writeChain = useRef(Promise.resolve())
  const baseOffice = useRef(loadOffice())
  const accessRef = useRef(access)
  const workspaceIdRef = useRef('')
  const storageScopeRef = useRef('')

  useEffect(() => { accessRef.current = access }, [access])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      hydratedKey.current = ''
      cloudWriteAllowed.current = false
      dirtyVersion.current = 0
      syncedVersion.current = 0
      workspaceIdRef.current = ''
      storageScopeRef.current = ''
      setAccess({ workspace: null, membership: null, workspaces: [] })
      setReady(false)
      return
    }

    const requested = workspaceRequest || preferredWorkspaceId()
    const key = `${userId}|${requested}`
    if (hydratedKey.current === key && ready) return

    let active = true
    cloudWriteAllowed.current = false
    dirtyVersion.current = 0
    syncedVersion.current = 0
    setReady(false)
    setSync('Carregando escritório…')

    async function hydrate() {
      const result = await loadWorkspace(requested)
      if (!active) return
      const workspaceId = String(result.workspace?.id || '')
      if (!workspaceId) throw new Error('O workspace não foi identificado.')
      const nextAccess = { workspace: result.workspace || null, membership: result.membership || null, workspaces: result.workspaces || [] }
      const remote = payloadToOffice(result.payload || {})
      const scope = storageScope(userId, workspaceId)
      const scopedLocal = loadOffice(scope)
      const scopedUpdatedAt = getLocalUpdatedAt(scope)

      let local = scopedLocal
      let localUpdatedAt = scopedUpdatedAt
      const owner = String(result.workspace?.owner_user_id || '') === String(userId)
      if (owner && result.membership?.role === 'admin') {
        const legacyUpdatedAt = getLocalUpdatedAt(userId)
        if (timeValue(legacyUpdatedAt) > timeValue(localUpdatedAt)) {
          local = loadOffice(userId)
          localUpdatedAt = legacyUpdatedAt
        }
      }

      let next = remote
      let remoteBase = remote
      const localIsNewer = Boolean(localUpdatedAt) && timeValue(localUpdatedAt) > timeValue(result.updated_at)
      if (localIsNewer) {
        const patch = buildOfficePatch(remote, local, nextAccess)
        if (hasOfficePatch(patch)) {
          try {
            const saved = await saveWorkspace(workspaceId, patch)
            remoteBase = payloadToOffice(saved.payload || {})
            next = remoteBase
          } catch {
            next = local
          }
        }
      }

      hydratedKey.current = `${userId}|${workspaceId}`
      workspaceIdRef.current = workspaceId
      storageScopeRef.current = scope
      baseOffice.current = structuredClone(remoteBase)
      accessRef.current = nextAccess
      saveOffice(next, scope, { touch: false })
      setOfficeState(next)
      setAccess(nextAccess)
      setReady(true)
      cloudWriteAllowed.current = true
      setSync('Sincronizado · equipe')
      if (workspaceRequest !== workspaceId) setWorkspaceRequest(workspaceId)
    }

    hydrate().catch(error => {
      if (!active) return
      const fallbackScope = storageScope(userId, requested || 'local')
      const local = loadOffice(fallbackScope)
      hydratedKey.current = key
      storageScopeRef.current = fallbackScope
      baseOffice.current = structuredClone(local)
      setOfficeState(local)
      setReady(true)
      cloudWriteAllowed.current = false
      setSync(error?.message ? `Modo local · ${error.message}` : 'Modo local · falha na nuvem')
    })

    return () => { active = false }
  }, [session?.user?.id, workspaceRequest])

  useEffect(() => {
    const userId = session?.user?.id
    if (!ready || !userId || !workspaceIdRef.current) return undefined

    let cancelled = false
    async function refresh() {
      if (dirtyVersion.current > syncedVersion.current || !cloudWriteAllowed.current) return
      try {
        const result = await loadWorkspace(workspaceIdRef.current)
        if (cancelled || dirtyVersion.current > syncedVersion.current) return
        const remote = payloadToOffice(result.payload || {})
        baseOffice.current = structuredClone(remote)
        saveOffice(remote, storageScopeRef.current, { touch: false })
        setOfficeState(remote)
        const nextAccess = { workspace: result.workspace || null, membership: result.membership || null, workspaces: result.workspaces || [] }
        accessRef.current = nextAccess
        setAccess(nextAccess)
        setSync('Sincronizado · equipe')
      } catch {
        if (!cancelled) setSync('Conectado · atualização pendente')
      }
    }

    const interval = setInterval(refresh, 45000)
    const onFocus = () => refresh()
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [ready, session?.user?.id])

  useEffect(() => {
    const userId = session?.user?.id
    if (!ready || !userId || !storageScopeRef.current) return undefined

    const version = dirtyVersion.current
    const hasLocalMutation = version > syncedVersion.current
    saveOffice(office, storageScopeRef.current, { touch: hasLocalMutation })
    if (!hasLocalMutation) return undefined

    if (!cloudWriteAllowed.current || !workspaceIdRef.current) {
      setSync('Modo local · alterações salvas neste navegador')
      return undefined
    }

    setSync('Salvando para a equipe…')
    const timer = setTimeout(() => {
      const snapshot = structuredClone(office)
      const patch = buildOfficePatch(baseOffice.current, snapshot, accessRef.current)
      if (!hasOfficePatch(patch)) {
        syncedVersion.current = Math.max(syncedVersion.current, version)
        if (dirtyVersion.current <= syncedVersion.current) setSync('Sincronizado · equipe')
        return
      }

      writeChain.current = writeChain.current.then(async () => {
        if (!cloudWriteAllowed.current) return
        const result = await saveWorkspace(workspaceIdRef.current, patch)
        const remote = payloadToOffice(result.payload || {})
        baseOffice.current = structuredClone(remote)
        syncedVersion.current = Math.max(syncedVersion.current, version)
        if (dirtyVersion.current <= syncedVersion.current) {
          saveOffice(remote, storageScopeRef.current, { touch: false })
          setOfficeState(remote)
          setSync('Sincronizado · equipe')
        }
      }).catch(() => {
        setSync('Falha ao sincronizar · alterações mantidas neste navegador')
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

  const switchWorkspace = useCallback(workspaceId => {
    const id = String(workspaceId || '')
    if (!id || id === workspaceIdRef.current) return
    hydratedKey.current = ''
    setWorkspaceRequest(id)
  }, [])

  const refreshWorkspace = useCallback(async () => {
    if (!workspaceIdRef.current || dirtyVersion.current > syncedVersion.current) return false
    const result = await loadWorkspace(workspaceIdRef.current)
    const remote = payloadToOffice(result.payload || {})
    baseOffice.current = structuredClone(remote)
    saveOffice(remote, storageScopeRef.current, { touch: false })
    setOfficeState(remote)
    const nextAccess = { workspace: result.workspace || null, membership: result.membership || null, workspaces: result.workspaces || [] }
    accessRef.current = nextAccess
    setAccess(nextAccess)
    setSync('Sincronizado · equipe')
    return true
  }, [])

  const todoist = useTodoistTasks({
    enabled: Boolean(ready && session?.user?.id && isAdminAccess(access)),
    tasks: office.tasks || [],
    update,
  })

  return { office, update, ready, sync, todoist, access, switchWorkspace, refreshWorkspace }
}
