import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const LEGACY_AUTH_KEY = 'ed_cloud_session'

function readLegacySession() {
  try {
    const value = JSON.parse(localStorage.getItem(LEGACY_AUTH_KEY) || 'null')
    return value?.access_token && value?.refresh_token ? value : null
  } catch {
    return null
  }
}

function saveLegacySession(session) {
  if (session) localStorage.setItem(LEGACY_AUTH_KEY, JSON.stringify(session))
  else localStorage.removeItem(LEGACY_AUTH_KEY)
}

export function useAuthSession() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    let active = true

    async function restoreSession() {
      const { data } = await supabase.auth.getSession()
      let nextSession = data.session
      if (!nextSession) {
        const legacy = readLegacySession()
        if (legacy) {
          const restored = await supabase.auth.setSession({ access_token: legacy.access_token, refresh_token: legacy.refresh_token })
          nextSession = restored.data.session
        }
      }
      if (!active) return
      setSession(nextSession || null)
      saveLegacySession(nextSession || null)
      setAuthReady(true)
    }

    restoreSession().catch(() => {
      if (!active) return
      setSession(null)
      setAuthReady(true)
    })

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      saveLegacySession(nextSession)
      if (event === 'SIGNED_OUT') saveLegacySession(null)
      setAuthReady(true)
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  async function signOut() {
    saveLegacySession(null)
    await supabase.auth.signOut()
  }

  return { session, authReady, signOut }
}
