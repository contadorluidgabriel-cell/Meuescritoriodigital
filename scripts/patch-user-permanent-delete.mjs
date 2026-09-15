import { readFileSync, writeFileSync } from 'node:fs'

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`User permanent delete patch failed (${label})`)
  return source.replace(from, to)
}

export function applyUserPermanentDeletePatch(root) {
  const syncPath = `${root}src/lib/workspaceSync.js`
  let sync = readFileSync(syncPath, 'utf8')
  if (!sync.includes('export async function deleteWorkspaceUser')) {
    sync = replaceOrFail(
      sync,
      "export const removeWorkspaceMember = (workspaceId, memberId) => invoke('remove_member', { workspace_id: workspaceId, member_id: memberId })",
      "export const removeWorkspaceMember = (workspaceId, memberId) => invoke('remove_member', { workspace_id: workspaceId, member_id: memberId })\nexport async function deleteWorkspaceUser(workspaceId, memberId, confirmation) {\n  const { data: sessionData } = await supabase.auth.getSession()\n  const token = sessionData.session?.access_token\n  if (!token) throw new Error('Sua sessão expirou. Entre novamente.')\n  const { data, error } = await supabase.functions.invoke('office-user-admin', {\n    body: { action: 'delete_user', workspace_id: workspaceId, member_id: memberId, confirmation },\n    headers: { Authorization: `Bearer ${token}` },\n  })\n  if (error) throw new Error(error.message || 'Falha ao excluir o usuário.')\n  if (data?.error) throw new Error(data.message || 'Falha ao excluir o usuário.')\n  return data\n}",
      'workspace sync action',
    )
    writeFileSync(syncPath, sync)
  }

  const usersPath = `${root}src/components/UserAccessManager.jsx`
  let users = readFileSync(usersPath, 'utf8')
  if (users.includes('async function deleteUserPermanently(member)')) return

  users = replaceOrFail(
    users,
    '  inviteWorkspaceMember,\n  listWorkspaceMembers,',
    '  inviteWorkspaceMember,\n  deleteWorkspaceUser,\n  listWorkspaceMembers,',
    'delete action import',
  )

  users = replaceOrFail(
    users,
    "  async function activateV2(member) {",
    "  async function deleteUserPermanently(member) {\n    if (!member || !actorOwner || ownerSelected || member.status !== 'disabled' || !member.user_id) return\n    if (selectedAssignments.length) {\n      setDetailTab('responsibilities')\n      setMessage(`Antes da exclusão definitiva, redistribua ${selectedAssignments.length} responsabilidade(s) ativa(s) deste usuário.`)\n      return\n    }\n    const confirmation = window.prompt(`Excluir definitivamente ${member.display_name || member.email}?\\n\\nA conta de login será apagada e não poderá ser reativada.\\nDigite EXCLUIR para confirmar.`)\n    if (confirmation == null) return\n    if (confirmation !== 'EXCLUIR') { setMessage('Exclusão cancelada: a confirmação deve ser exatamente EXCLUIR.'); return }\n    setBusy(true); setMessage('')\n    try {\n      await deleteWorkspaceUser(workspaceId, member.id, confirmation)\n      await refreshTeam('')\n      setMessage('Usuário e conta de login excluídos definitivamente.')\n    } catch (error) {\n      const text = error?.message || 'Não foi possível excluir o usuário.'\n      setMessage(text)\n      if (/redistribua|responsabil/i.test(text)) setDetailTab('responsibilities')\n    } finally { setBusy(false) }\n  }\n\n  async function activateV2(member) {",
    'delete function',
  )

  const actionAnchor = "{selected.status === 'invited' ? <button type=\"button\" className=\"danger\" disabled={busy} onClick={() => removeMember(selected)}>Remover convite</button> : null}</div>"
  users = replaceOrFail(
    users,
    actionAnchor,
    "{selected.status === 'invited' ? <button type=\"button\" className=\"danger\" disabled={busy} onClick={() => removeMember(selected)}>Remover convite</button> : null}{selected.status === 'disabled' ? <button type=\"button\" disabled={busy} onClick={() => removeMember(selected)}>Remover do escritório</button> : null}{actorOwner && selected.status === 'disabled' && selected.user_id ? <button type=\"button\" className=\"danger\" disabled={busy} onClick={() => deleteUserPermanently(selected)}>Excluir definitivamente</button> : null}</div>",
    'user actions',
  )

  writeFileSync(usersPath, users)
}
