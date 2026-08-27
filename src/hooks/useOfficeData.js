import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { loadOffice, officePayload, payloadToOffice, saveOffice } from '../lib/storage.js'

export function useOfficeData(session) {
  const [office, setOfficeState] = useState(loadOffice)
  const [ready, setReady] = useState(false)
  const [sync, setSync] = useState('Aguardando acesso')
  const hydratedUser = useRef(null)

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) { hydratedUser.current = null; setReady(false); return }
    if (hydratedUser.current === userId) return
    let active = true
    setReady(false)
    setSync('Carregando…')

    async function hydrate() {
      const timeout = new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), 12000))
      const request = supabase.from('office_snapshots').select('payload').eq('user_id', userId).maybeSingle()
      const result = await Promise.race([request, timeout])
      if (!active) return
      if (result?.timedOut || result?.error) {
        const local = loadOffice()
        hydratedUser.current = userId
        setOfficeState(local)
        setReady(true)
        setSync(result?.timedOut ? 'Modo local · conexão lenta' : 'Modo local · falha na nuvem')
        return
      }
      const next = result.data?.payload ? payloadToOffice(result.data.payload) : loadOffice()
      hydratedUser.current = userId
      saveOffice(next)
      setOfficeState(next)
      setReady(true)
      setSync('Sincronizado')
    }

    hydrate()
    return () => { active = false }
  }, [session?.user?.id])

  useEffect(() => {
    const refresh = event => { if (ready && event.key?.startsWith('med_')) setOfficeState(loadOffice()) }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [ready])

  useEffect(() => {
    const userId = session?.user?.id
    if (!ready || !userId) return
    saveOffice(office)
    setSync('Salvando…')
    const timer = setTimeout(async () => {
      const { error } = await supabase.from('office_snapshots').upsert({ user_id: userId, payload: officePayload(office), app_version: '11.1', updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      setSync(error ? 'Falha ao salvar · dados mantidos neste navegador' : 'Sincronizado')
    }, 650)
    return () => clearTimeout(timer)
  }, [office, ready, session?.user?.id])

  const update = useCallback(recipe => setOfficeState(current => { const draft = structuredClone(current); recipe(draft); return draft }), [])
  return { office, update, ready, sync }
}
