import { useEffect, useState } from 'react'

const defaults = { office: 'Meu Escritório', system: 'Meu Escritório Digital', user: 'Usuário', role: 'Administrador', initials: 'ME' }

function readIdentity() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('med_configuracoes') || '{}') } }
  catch { return defaults }
}

export function useLegacyIdentity() {
  const [identity, setIdentity] = useState(readIdentity)
  useEffect(() => {
    const refresh = event => { if (!event || event.key === 'med_configuracoes') setIdentity(readIdentity()) }
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh) }
  }, [])
  return identity
}
