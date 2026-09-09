import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { acceptWorkspaceInviteLink, inspectWorkspaceInviteLink } from '../lib/inviteLinks.js'
import '../invite-links.css'

const roleLabel = role => role === 'partner' ? 'Parceiro' : role === 'admin' ? 'Administrador' : 'Colaborador'
const dateTime = value => value ? new Date(value).toLocaleString('pt-BR') : '—'

function clearInviteToken() {
  const url = new URL(window.location.href)
  url.searchParams.delete('join')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export default function InviteLinkAccept({ token, session }) {
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Carregando convite…')
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    inspectWorkspaceInviteLink(token).then(result => {
      if (!active) return
      setInvite(result.invite || null)
      setMessage('Defina sua senha para ativar este acesso. O link funciona uma única vez.')
    }).catch(error => {
      if (active) setMessage(error?.message || 'Este convite não está disponível.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  async function submit(event) {
    event.preventDefault()
    if (password.length < 6) return setMessage('Use uma senha com pelo menos 6 caracteres.')
    if (password !== confirm) return setMessage('As senhas não coincidem.')
    setBusy(true)
    setMessage('Ativando seu acesso…')
    try {
      const accepted = await acceptWorkspaceInviteLink(token, password)
      const { error: signError } = await supabase.auth.signInWithPassword({ email: accepted.email, password })
      clearInviteToken()
      if (signError) {
        setCompleted(true)
        setMessage('O acesso foi ativado. Entre novamente usando o e-mail e a senha que você acabou de informar.')
        return
      }
      setCompleted(true)
      setMessage(`Acesso ativado em ${accepted.workspace_name || 'Meu Escritório'}. Entrando…`)
      window.setTimeout(() => window.location.assign('/'), 350)
    } catch (error) {
      setMessage(error?.message || 'Não foi possível aceitar o convite.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="invite-link-page"><section className="invite-link-card"><span className="invite-badge">Convite de acesso</span><h1>Verificando convite…</h1><p>{message}</p></section></div>

  if (!invite) return <div className="invite-link-page"><section className="invite-link-card"><span className="invite-badge invite-badge-error">Convite indisponível</span><h1>Não foi possível abrir este acesso</h1><p>{message}</p><button type="button" className="secondary" onClick={() => { clearInviteToken(); window.location.assign('/') }}>Ir para o login</button></section></div>

  if (completed) return <div className="invite-link-page"><section className="invite-link-card"><span className="invite-badge">Acesso ativado</span><h1>Pronto</h1><p>{message}</p><button type="button" className="primary" onClick={() => window.location.assign('/')}>Abrir Meu Escritório Digital</button></section></div>

  return <div className="invite-link-page"><form className="invite-link-card" onSubmit={submit}>
    <span className="invite-badge">Convite de acesso</span>
    <h1>Entrar em {invite.workspace_name || 'Meu Escritório'}</h1>
    <p>Você foi convidado como <b>{roleLabel(invite.role)}</b>. Este acesso está reservado para o e-mail abaixo.</p>
    <div className="invite-link-identity"><strong>{invite.display_name || invite.email}</strong><span>{invite.email}</span></div>
    {session?.user?.email && String(session.user.email).toLowerCase() !== String(invite.email).toLowerCase() ? <div className="invite-link-warning">Este navegador está conectado como <b>{session.user.email}</b>. Ao concluir, o sistema trocará para o acesso convidado.</div> : null}
    <label>Senha<input type="password" minLength="6" required value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" /></label>
    <label>Confirmar senha<input type="password" minLength="6" required value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" /></label>
    <button className="primary" disabled={busy}>{busy ? 'Ativando…' : 'Ativar meu acesso'}</button>
    <p className="form-message">{message}</p>
    <small>Link válido até {dateTime(invite.expires_at)}. Depois de utilizado, ele deixa de funcionar.</small>
  </form></div>
}
