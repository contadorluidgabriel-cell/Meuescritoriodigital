import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function InviteSetup({ session, access, onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Defina uma senha para acessar o escritório novamente sem depender do link do convite.')

  async function submit(event) {
    event.preventDefault()
    if (password.length < 6) return setMessage('Use uma senha com pelo menos 6 caracteres.')
    if (password !== confirm) return setMessage('As senhas não coincidem.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setMessage(error.message || 'Não foi possível definir a senha.')
    const url = new URL(window.location.href)
    url.searchParams.delete('invite')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    onDone?.()
  }

  return <div className="invite-setup-backdrop"><form className="invite-setup-card" onSubmit={submit}>
    <span className="invite-badge">Convite aceito</span>
    <h1>Bem-vindo ao {access?.workspace?.name || 'escritório'}</h1>
    <p>Seu acesso está vinculado como <b>{access?.membership?.role === 'partner' ? 'Parceiro' : access?.membership?.role === 'admin' ? 'Administrador' : 'Colaborador'}</b>.</p>
    <label>Nova senha<input type="password" minLength="6" required value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" /></label>
    <label>Confirmar senha<input type="password" minLength="6" required value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" /></label>
    <button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Concluir acesso'}</button>
    <small>{message}</small>
    <em>{session?.user?.email || ''}</em>
  </form></div>
}
