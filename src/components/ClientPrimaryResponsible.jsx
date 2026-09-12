import { useEffect, useMemo, useState } from 'react'
import { listWorkspaceMembers } from '../lib/workspaceSync.js'
import { countClientOpenWorkForResponsible } from '../lib/responsibility.js'
import { setClientPrimaryResponsible } from '../lib/distributionSync.js'
import '../client-primary-responsible.css'

const memberName = member => member?.display_name || member?.email || 'Usuário'

export default function ClientPrimaryResponsible({ client, office, access, onRefresh }) {
  const workspaceId = String(access?.workspace?.id || '')
  const role = String(access?.membership?.role || '')
  const canManage = role === 'admin'
  const currentId = String(client?.responsavelPrincipalUserId || '')
  const currentStoredName = String(client?.responsavelPrincipalNome || '')
  const [members, setMembers] = useState([])
  const [selectedId, setSelectedId] = useState(currentId)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { setSelectedId(currentId); setMessage('') }, [currentId, client?.id])
  useEffect(() => {
    let active = true
    if (!workspaceId || !canManage) return undefined
    listWorkspaceMembers(workspaceId).then(result => {
      if (active) setMembers(result.members || [])
    }).catch(() => { if (active) setMembers([]) })
    return () => { active = false }
  }, [canManage, workspaceId])

  const activeMembers = useMemo(() => members
    .filter(member => member.status === 'active' && member.user_id && ['admin', 'collaborator'].includes(String(member.role || '')))
    .sort((a, b) => memberName(a).localeCompare(memberName(b), 'pt-BR')), [members])
  const memberByUserId = useMemo(() => new Map(members.filter(member => member.user_id).map(member => [String(member.user_id), member])), [members])
  const currentName = memberName(memberByUserId.get(currentId)) || currentStoredName
  const actualCurrentName = currentId ? (memberByUserId.has(currentId) ? memberName(memberByUserId.get(currentId)) : currentStoredName || 'Usuário inativo') : 'Não atribuído'
  const pendingName = selectedId ? memberName(memberByUserId.get(selectedId)) : 'Não atribuído'
  const changed = selectedId !== currentId
  const open = useMemo(() => countClientOpenWorkForResponsible(office || {}, client?.id, currentId), [client?.id, currentId, office])

  async function apply(transferOpen) {
    if (!workspaceId || !client?.id || !changed) return
    setBusy(true); setMessage('')
    try {
      const result = await setClientPrimaryResponsible(workspaceId, client.id, selectedId, transferOpen)
      const moved = Number(result?.transferred?.total || 0)
      setMessage(transferOpen ? `Responsável atualizado. ${moved} trabalho(s) aberto(s) transferido(s).` : 'Responsável atualizado apenas para novos trabalhos.')
      await onRefresh?.()
    } catch (error) {
      setMessage(error?.message || 'Não foi possível atualizar o responsável principal.')
    } finally { setBusy(false) }
  }

  return <section className="client-primary-responsible">
    <div className="client-primary-copy">
      <span>Responsabilidade</span>
      <strong>Responsável principal</strong>
      <small>Novos trabalhos da empresa usam este responsável como padrão quando não houver uma regra mais específica.</small>
    </div>
    {!canManage ? <div className="client-primary-current"><b>{currentStoredName || (currentId ? 'Responsável definido' : 'Não atribuído')}</b><small>Somente Proprietário ou Administrador altera esta responsabilidade.</small></div> : <div className="client-primary-control">
      <select value={selectedId} disabled={busy} onChange={event => { setSelectedId(event.target.value); setMessage('') }}>
        <option value="">Não atribuído</option>
        {currentId && !activeMembers.some(member => String(member.user_id) === currentId) ? <option value={currentId}>{actualCurrentName} · inativo/indisponível</option> : null}
        {activeMembers.map(member => <option key={member.id} value={String(member.user_id)}>{memberName(member)}</option>)}
      </select>
      {changed ? <div className="client-primary-change">
        <p><b>{actualCurrentName}</b> → <b>{pendingName}</b>{open.total ? ` · ${open.total} trabalho(s) aberto(s) atualmente com ${currentId ? 'o responsável anterior' : 'ninguém'}.` : ' · sem trabalhos abertos para transferir.'}</p>
        <div><button type="button" disabled={busy} onClick={() => apply(false)}>Só novos trabalhos</button><button type="button" className="primary" disabled={busy} onClick={() => apply(true)}>Transferir também os abertos</button></div>
      </div> : <small className="client-primary-status">Atual: {actualCurrentName}</small>}
      {message ? <p className="client-primary-message">{message}</p> : null}
    </div>}
  </section>
}
