import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [mode, setMode] = useState('login'), [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [message, setMessage] = useState('Entre para carregar os dados do escritório.'), [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage(mode === 'login' ? 'Entrando…' : 'Criando acesso…')
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (result.error) return setMessage(result.error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : result.error.message)
    if (mode === 'signup' && !result.data.session) setMessage('Acesso criado. Confirme o e-mail recebido e depois entre.')
  }
  return <div className="login-page"><form className="login-card" onSubmit={submit}>
    <div className="login-brand"><span>ED</span><div><h1>Meu Escritório Digital</h1><p>V11.1 · acesso seguro na nuvem</p></div></div>
    <label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" /></label>
    <label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength="6" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
    <button className="primary" disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar acesso'}</button>
    <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Criar novo acesso' : 'Já tenho acesso'}</button>
    <p className="form-message">{message}</p>
    <p className="login-security">Os dados ficam no Supabase e são isolados por usuário. Esta página utiliza somente a chave pública permitida para navegadores.</p>
  </form></div>
}
