import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [mode, setMode] = useState('login'), [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [message, setMessage] = useState('Entre para carregar o seu escritório e as permissões deste acesso.'), [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage(mode === 'login' ? 'Entrando…' : 'Criando acesso…')
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (result.error) return setMessage(result.error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : result.error.message)
    if (mode === 'signup' && !result.data.session) setMessage('Acesso criado. Confirme o e-mail recebido e depois entre. Se você foi convidado por um escritório, o vínculo será reconhecido pelo seu e-mail.')
  }
  return <div className="login-page"><form className="login-card" onSubmit={submit}>
    <div className="login-brand"><span>ED</span><div><h1>Meu Escritório Digital</h1><p>V11.1 · acesso seguro na nuvem</p></div></div>
    <label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" /></label>
    <label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength="6" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
    <button className="primary" disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar acesso'}</button>
    <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Criar novo acesso' : 'Já tenho acesso'}</button>
    <p className="form-message">{message}</p>
    <p className="login-security">Os dados pertencem ao escritório. O backend aplica o perfil Administrador, Colaborador ou Parceiro antes de liberar cada informação.</p>
  </form></div>
}
