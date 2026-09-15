import { useEffect, useMemo, useState } from 'react'
import { uid } from '../lib/storage.js'
import { listWorkspaceMembers, updateWorkspaceMember } from '../lib/workspaceSync.js'
import { allPartnerBalances, clientPartnerIds } from '../lib/sharedWork.js'

const partnerName = partner => partner?.nome || partner?.razao || 'Parceiro'
const memberName = member => member?.display_name || member?.email || 'Usuário'
const memberStatus = member => member?.status === 'active' ? 'Ativo' : member?.status === 'disabled' ? 'Desativado' : 'Convite pendente'
const digits = value => String(value || '').replace(/\D/g, '')
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function formatDocument(value) {
  const number = digits(value).slice(0, 14)
  if (!number) return ''
  if (number.length <= 11) {
    let formatted = number.slice(0, 3)
    if (number.length > 3) formatted += `.${number.slice(3, 6)}`
    if (number.length > 6) formatted += `.${number.slice(6, 9)}`
    if (number.length > 9) formatted += `-${number.slice(9, 11)}`
    return formatted
  }
  let formatted = number.slice(0, 2)
  if (number.length > 2) formatted += `.${number.slice(2, 5)}`
  if (number.length > 5) formatted += `.${number.slice(5, 8)}`
  if (number.length > 8) formatted += `/${number.slice(8, 12)}`
  if (number.length > 12) formatted += `-${number.slice(12, 14)}`
  return formatted
}

export default function PartnersPanel({ office, update, access, onRefresh }) {
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [members, setMembers] = useState([])
  const [memberTargetId, setMemberTargetId] = useState('')
  const [memberBusy, setMemberBusy] = useState(false)
  const [memberLoading, setMemberLoading] = useState(false)
  const [memberMessage, setMemberMessage] = useState('')

  const workspaceId = String(access?.workspace?.id || '')
  const actorMembership = access?.membership || {}
  const ownerUserId = String(access?.workspace?.owner_user_id || '')
  const actorOwner = Boolean(actorMembership.user_id && String(actorMembership.user_id) === ownerUserId)
  const canManagePartnerUsers = actorMembership.role === 'admin' && (actorOwner || actorMembership.permissions?.access_v2 !== true)

  const balances = useMemo(() => new Map(allPartnerBalances(office.finance || [], office.clients || [], office.partners || []).map(item => [String(item.id), item])), [office.clients, office.finance, office.partners])
  const partners = useMemo(() => (office.partners || [])
    .slice()
    .sort((a, b) => partnerName(a).localeCompare(partnerName(b), 'pt-BR')), [office.partners])
  const linkedCount = useMemo(() => {
    const counts = new Map()
    ;(office.clients || []).forEach(client => clientPartnerIds(client).forEach(id => counts.set(id, (counts.get(id) || 0) + 1)))
    return counts
  }, [office.clients])
  const partnerMembers = useMemo(() => members.filter(member => member.role === 'partner'), [members])
  const membersByPartner = useMemo(() => {
    const map = new Map()
    partnerMembers.forEach(member => {
      const partnerId = String(member.partner_id || '')
      if (!partnerId) return
      if (!map.has(partnerId)) map.set(partnerId, [])
      map.get(partnerId).push(member)
    })
    for (const rows of map.values()) rows.sort((a, b) => memberName(a).localeCompare(memberName(b), 'pt-BR'))
    return map
  }, [partnerMembers])
  const availablePartnerMembers = useMemo(() => {
    if (!editing?.id) return []
    return partnerMembers.filter(member => String(member.partner_id || '') !== String(editing.id))
  }, [editing?.id, partnerMembers])

  async function refreshPartnerMembers() {
    if (!workspaceId || !canManagePartnerUsers) return
    setMemberLoading(true)
    try {
      const result = await listWorkspaceMembers(workspaceId)
      setMembers(result.members || [])
    } catch (memberError) {
      setMemberMessage(memberError?.message || 'Não foi possível carregar os usuários parceiros.')
    } finally {
      setMemberLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    if (!workspaceId || !canManagePartnerUsers) return undefined
    setMemberLoading(true)
    listWorkspaceMembers(workspaceId)
      .then(result => { if (active) setMembers(result.members || []) })
      .catch(memberError => { if (active) setMemberMessage(memberError?.message || 'Não foi possível carregar os usuários parceiros.') })
      .finally(() => { if (active) setMemberLoading(false) })
    return () => { active = false }
  }, [canManagePartnerUsers, workspaceId])

  function openNew() {
    setEditing({ id: '', nome: '', tipo: 'Contador', documento: '', telefone: '', email: '', observacoes: '', status: 'Ativo' })
    setError('')
    setMemberTargetId('')
    setMemberMessage('')
  }

  function openEdit(partner) {
    setEditing({
      id: partner.id,
      nome: partner.nome || '',
      tipo: partner.tipo || 'Contador',
      documento: formatDocument(partner.documento || ''),
      telefone: partner.telefone || '',
      email: partner.email || '',
      observacoes: partner.observacoes || '',
      status: partner.status || 'Ativo',
    })
    setError('')
    setMemberTargetId('')
    setMemberMessage('')
  }

  function save(event) {
    event.preventDefault()
    const nome = String(editing.nome || '').trim()
    const documentDigits = digits(editing.documento)
    if (!nome) { setError('Informe o nome do parceiro.'); return }
    if (documentDigits && ![11, 14].includes(documentDigits.length)) { setError('CPF/CNPJ deve ter 11 ou 14 dígitos.'); return }
    if (documentDigits && (office.partners || []).some(item => item.id !== editing.id && digits(item.documento) === documentDigits)) { setError('Este CPF/CNPJ já está cadastrado em outro parceiro.'); return }

    const existing = (office.partners || []).find(item => item.id === editing.id)
    const record = {
      ...(existing || {}),
      id: editing.id || uid('par'),
      nome,
      tipo: editing.tipo || 'Contador',
      documento: formatDocument(documentDigits),
      telefone: String(editing.telefone || '').trim(),
      email: String(editing.email || '').trim(),
      observacoes: String(editing.observacoes || '').trim(),
      status: editing.status || 'Ativo',
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    }

    update(draft => {
      const current = draft.partners || []
      draft.partners = current.some(item => item.id === record.id)
        ? current.map(item => item.id === record.id ? record : item)
        : [...current, record]
    })
    setEditing(null)
  }

  async function linkMemberToPartner() {
    if (!editing?.id || !memberTargetId || !canManagePartnerUsers) return
    const member = partnerMembers.find(item => String(item.id) === String(memberTargetId))
    if (!member) return
    const previousPartnerId = String(member.partner_id || '')
    if (previousPartnerId && previousPartnerId !== String(editing.id)) {
      const previous = (office.partners || []).find(item => String(item.id) === previousPartnerId)
      const previousName = previous ? partnerName(previous) : 'outro parceiro'
      if (!window.confirm(`${memberName(member)} está vinculado a ${previousName}. Mover este usuário para ${editing.nome}?`)) return
    }
    setMemberBusy(true); setMemberMessage('')
    try {
      await updateWorkspaceMember(workspaceId, { member_id: member.id, role: 'partner', partner_id: editing.id })
      await refreshPartnerMembers()
      await onRefresh?.()
      setMemberTargetId('')
      setMemberMessage(`${memberName(member)} vinculado a ${editing.nome}.`)
    } catch (memberError) {
      setMemberMessage(memberError?.message || 'Não foi possível vincular o usuário ao parceiro.')
    } finally {
      setMemberBusy(false)
    }
  }

  async function toggleMemberStatus(member) {
    if (!member || !canManagePartnerUsers || member.status === 'invited') return
    const nextStatus = member.status === 'disabled' ? 'active' : 'disabled'
    const action = nextStatus === 'disabled' ? 'desativar' : 'reativar'
    if (!window.confirm(`${action === 'desativar' ? 'Desativar' : 'Reativar'} o acesso de ${memberName(member)}?\n\nAs responsabilidades continuam vinculadas ao parceiro.`)) return
    setMemberBusy(true); setMemberMessage('')
    try {
      await updateWorkspaceMember(workspaceId, { member_id: member.id, status: nextStatus, role: 'partner', partner_id: member.partner_id })
      await refreshPartnerMembers()
      setMemberMessage(`Acesso de ${memberName(member)} ${nextStatus === 'disabled' ? 'desativado' : 'reativado'}.`)
    } catch (memberError) {
      setMemberMessage(memberError?.message || `Não foi possível ${action} o acesso.`)
    } finally {
      setMemberBusy(false)
    }
  }

  return <>
    <section className="react-module-card outsourced-section partner-section">
      <div className="outsourced-section-head">
        <div>
          <span className="outsourced-eyebrow">PARCERIAS</span>
          <h2>Parceiros de trabalho</h2>
          <p>Pessoas ou escritórios com quem você divide clientes, responsabilidades e repasses.</p>
        </div>
        <button className="primary" type="button" onClick={openNew}>+ Parceiro</button>
      </div>

      {partners.length ? <div className="outsourced-grid partner-grid">
        {partners.map(partner => {
          const balance = balances.get(String(partner.id)) || { aPagar: 0, aReceber: 0, saldo: 0 }
          const count = linkedCount.get(String(partner.id)) || 0
          const linkedUsers = membersByPartner.get(String(partner.id)) || []
          return <article className={`outsourced-company-card partner-card ${partner.status === 'Inativo' ? 'partner-inactive' : ''}`} key={partner.id}>
            <div className="outsourced-company-field"><small>Parceiro</small><strong>{partnerName(partner)}</strong><span>{partner.tipo || '—'}{partner.status === 'Inativo' ? ' · Inativo' : ''}</span></div>
            <div className="outsourced-company-field"><small>Clientes compartilhados</small><strong>{count}</strong></div>
            <div className="outsourced-company-field"><small>Usuários vinculados</small><strong>{canManagePartnerUsers ? linkedUsers.length : '—'}</strong><span>{canManagePartnerUsers ? (linkedUsers.length ? linkedUsers.map(memberName).join(', ') : 'Nenhum acesso') : 'Gestão restrita'}</span></div>
            <div className="outsourced-company-field"><small>A pagar</small><strong>{money(balance.aPagar)}</strong></div>
            <div className="outsourced-company-field"><small>A receber</small><strong>{money(balance.aReceber)}</strong></div>
            <div className="outsourced-company-field"><small>Saldo</small><strong>{money(balance.saldo)}</strong></div>
            <div className="outsourced-company-field"><small>Contato</small><strong>{partner.telefone || partner.email || '—'}</strong></div>
            <button className="outsourced-edit" type="button" onClick={() => openEdit(partner)}>Editar</button>
          </article>
        })}
      </div> : <div className="outsourced-empty">Nenhum parceiro de trabalho cadastrado.</div>}
    </section>

    {editing ? <div className="outsourced-modal" role="dialog" aria-modal="true" aria-label={editing.id ? 'Editar parceiro' : 'Novo parceiro'} onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null) }}>
      <div className="outsourced-modal-card">
        <header>
          <div><h2>{editing.id ? 'Editar parceiro' : 'Novo parceiro'}</h2><p>Parceiros inativos permanecem no histórico, mas não aparecem em novos vínculos.</p></div>
          <button type="button" onClick={() => setEditing(null)} aria-label="Fechar">×</button>
        </header>
        <form onSubmit={save}>
          <label><span>Nome *</span><input value={editing.nome} onChange={event => setEditing(current => ({ ...current, nome: event.target.value }))} /></label>
          <label><span>Tipo</span><select value={editing.tipo} onChange={event => setEditing(current => ({ ...current, tipo: event.target.value }))}><option>Contador</option><option>Escritório</option><option>Outro</option></select></label>
          <label><span>CPF/CNPJ</span><input inputMode="numeric" maxLength={18} value={formatDocument(editing.documento)} onChange={event => setEditing(current => ({ ...current, documento: formatDocument(event.target.value) }))} /></label>
          <label><span>Telefone / WhatsApp</span><input value={editing.telefone} onChange={event => setEditing(current => ({ ...current, telefone: event.target.value }))} /></label>
          <label><span>E-mail</span><input type="email" value={editing.email} onChange={event => setEditing(current => ({ ...current, email: event.target.value }))} /></label>
          <label><span>Status</span><select value={editing.status} onChange={event => setEditing(current => ({ ...current, status: event.target.value }))}><option>Ativo</option><option>Inativo</option></select></label>

          <div className="partner-user-manager full">
            <div className="partner-user-manager-head"><div><span>Acessos do parceiro</span><strong>Usuários vinculados</strong><small>Um parceiro pode ter vários usuários. Todos herdam o escopo operacional definido para esta parceria.</small></div>{memberLoading ? <em>Atualizando…</em> : null}</div>
            {!canManagePartnerUsers ? <p className="outsourced-helper">Somente o proprietário ou um administrador integral pode alterar usuários de parceiros.</p> : !editing.id ? <p className="outsourced-helper">Salve o parceiro antes de vincular usuários.</p> : <>
              <div className="partner-user-list">{(membersByPartner.get(String(editing.id)) || []).map(member => <article key={member.id}><div><strong>{memberName(member)}</strong><small>{member.email} · {memberStatus(member)}</small></div>{member.status !== 'invited' ? <button type="button" disabled={memberBusy} onClick={() => toggleMemberStatus(member)}>{member.status === 'disabled' ? 'Reativar' : 'Desativar'}</button> : <span>Convite pendente</span>}</article>)}{!(membersByPartner.get(String(editing.id)) || []).length ? <p>Nenhum usuário vinculado a este parceiro.</p> : null}</div>
              <div className="partner-user-link-row"><select value={memberTargetId} disabled={memberBusy || !availablePartnerMembers.length} onChange={event => setMemberTargetId(event.target.value)}><option value="">Vincular usuário parceiro…</option>{availablePartnerMembers.map(member => { const currentPartner = (office.partners || []).find(item => String(item.id) === String(member.partner_id || '')); return <option key={member.id} value={member.id}>{memberName(member)}{currentPartner ? ` · atualmente em ${partnerName(currentPartner)}` : ''}</option> })}</select><button type="button" className="primary" disabled={memberBusy || !memberTargetId} onClick={linkMemberToPartner}>{memberBusy ? 'Aguarde…' : 'Vincular'}</button></div>
              {!availablePartnerMembers.length ? <p className="outsourced-helper">Para criar um novo acesso, convide o usuário com perfil Parceiro na área Usuários. Depois ele poderá ser movido entre parceiros por aqui.</p> : null}
              {memberMessage ? <p className="partner-user-message">{memberMessage}</p> : null}
            </>}
          </div>

          <label className="full"><span>Observações</span><textarea value={editing.observacoes} onChange={event => setEditing(current => ({ ...current, observacoes: event.target.value }))} /></label>
          {error ? <p className="outsourced-error">{error}</p> : null}
          <footer><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary">Salvar</button></footer>
        </form>
      </div>
    </div> : null}
  </>
}
