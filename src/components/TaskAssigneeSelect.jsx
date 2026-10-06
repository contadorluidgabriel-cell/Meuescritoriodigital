import { useEffect, useMemo, useState } from 'react'
import { listWorkspaceMembers } from '../lib/workspaceSync.js'

const labelOf = member => member?.display_name || member?.email || 'Usuário'

export default function TaskAssigneeSelect({
  access,
  value = '',
  currentUserId = '',
  currentUserName = '',
  onChange,
}) {
  const workspaceId = String(access?.workspace?.id || '')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(Boolean(workspaceId))

  useEffect(() => {
    let active = true
    if (!workspaceId) {
      setMembers([])
      setLoading(false)
      return undefined
    }

    setLoading(true)
    listWorkspaceMembers(workspaceId)
      .then(result => {
        if (!active) return
        setMembers(Array.isArray(result?.members) ? result.members : [])
      })
      .catch(() => {
        if (active) setMembers([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [workspaceId])

  const choices = useMemo(() => {
    const rows = (members || [])
      .filter(member => member?.status === 'active' && member?.user_id && member?.role !== 'partner')
      .map(member => ({
        userId: String(member.user_id),
        name: labelOf(member),
        email: String(member.email || ''),
      }))

    const current = String(currentUserId || '')
    if (current && !rows.some(item => item.userId === current)) {
      rows.unshift({
        userId: current,
        name: currentUserName || 'Você',
        email: '',
      })
    }

    return rows.sort((a, b) => {
      if (a.userId === current) return -1
      if (b.userId === current) return 1
      return a.name.localeCompare(b.name, 'pt-BR')
    })
  }, [currentUserId, currentUserName, members])

  function change(event) {
    const userId = String(event.target.value || '')
    const selected = choices.find(item => item.userId === userId)
    onChange?.(selected || { userId: '', name: '', email: '' })
  }

  return <select value={String(value || '')} onChange={change} disabled={loading && !choices.length}>
    <option value="">{loading && !choices.length ? 'Carregando usuários…' : 'Selecione…'}</option>
    {choices.map(item => <option key={item.userId} value={item.userId}>{item.name}{item.userId === String(currentUserId || '') ? ' (você)' : ''}</option>)}
  </select>
}
