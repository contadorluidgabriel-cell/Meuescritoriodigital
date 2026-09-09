import { readFileSync, writeFileSync } from 'node:fs'

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Invite links patch failed (${label})`)
  return source.replace(from, to)
}

export function applyInviteLinksPatch(root) {
  const teamPath = `${root}src/components/TeamManagement.jsx`
  let team = readFileSync(teamPath, 'utf8')
  if (!team.includes("createWorkspaceInviteLink from '../lib/inviteLinks.js'")) {
    team = replaceOrFail(team,
      "import { inviteWorkspaceMember, listWorkspaceMembers, loadWorkspaceAudit, removeWorkspaceMember, roleLabel, updateWorkspaceMember } from '../lib/workspaceSync.js'",
      "import { inviteWorkspaceMember, listWorkspaceMembers, loadWorkspaceAudit, removeWorkspaceMember, roleLabel, updateWorkspaceMember } from '../lib/workspaceSync.js'\nimport { createWorkspaceInviteLink } from '../lib/inviteLinks.js'",
      'team import')

    team = replaceOrFail(team,
      "  const [invite, setInvite] = useState(defaultInvite)",
      "  const [invite, setInvite] = useState(defaultInvite)\n  const [inviteLinks, setInviteLinks] = useState({})",
      'link state')

    team = replaceOrFail(team,
      "  async function refreshTeam() {\n    const [team, activity] = await Promise.all([listWorkspaceMembers(workspaceId), loadWorkspaceAudit(workspaceId)])\n    setMembers(team.members || []); setAudit(activity.audit || [])\n  }",
      "  async function refreshTeam() {\n    const [team, activity] = await Promise.all([listWorkspaceMembers(workspaceId), loadWorkspaceAudit(workspaceId)])\n    setMembers(team.members || []); setAudit(activity.audit || [])\n  }\n  async function generateInviteLink(member) {\n    setBusy(true); setMessage('')\n    try {\n      const result = await createWorkspaceInviteLink(workspaceId, member.id)\n      setInviteLinks(current => ({ ...current, [String(member.id)]: result }))\n      try {\n        await navigator.clipboard.writeText(result.link)\n        setMessage(`Link de acesso gerado e copiado para ${member.display_name || member.email}.`)\n      } catch {\n        setMessage('Link de acesso gerado. Use o botão Copiar link abaixo.')\n      }\n      await refreshTeam()\n    } catch (error) { setMessage(error?.message || 'Não foi possível gerar o link de acesso.') } finally { setBusy(false) }\n  }\n  async function copyInviteLink(member) {\n    const item = inviteLinks[String(member.id)]\n    if (!item?.link) return generateInviteLink(member)\n    try {\n      await navigator.clipboard.writeText(item.link)\n      setMessage(`Link copiado. Você já pode enviar para ${member.display_name || member.email} pelo WhatsApp.`)\n    } catch { setMessage('Não foi possível copiar automaticamente. Selecione o link e copie manualmente.') }\n  }",
      'link actions')

    team = team.replace("'Configure um SMTP próprio e use Reenviar convite.'", "'Você pode usar Gerar link de acesso e enviar pelo WhatsApp.'")
    team = team.replace("'Configure um SMTP próprio no Supabase e tente novamente.'", "'Use Gerar link de acesso para compartilhar o convite sem e-mail.'")

    team = replaceOrFail(team,
      "        const emailFailed = inviteEmailFailed(member)",
      "        const emailFailed = inviteEmailFailed(member)\n        const generatedInvite = inviteLinks[String(member.id)]",
      'member link lookup')

    team = replaceOrFail(team,
      "{emailFailed ? <small>O acesso foi cadastrado, mas o e-mail de convite não foi aceito pelo serviço de envio.</small> : null}{member.role === 'collaborator' ?",
      "{emailFailed ? <small>O acesso foi cadastrado, mas o e-mail de convite não foi aceito pelo serviço de envio. Você pode compartilhar um link de acesso pelo WhatsApp.</small> : null}{generatedInvite ? <div className=\"team-invite-link\"><input value={generatedInvite.link} readOnly aria-label=\"Link de convite\" /><button type=\"button\" disabled={busy} onClick={() => copyInviteLink(member)}>Copiar link</button><small>Uso único · válido até {dateTime(generatedInvite.expires_at)}</small></div> : null}{member.role === 'collaborator' ?",
      'member link panel')

    team = replaceOrFail(team,
      "{emailFailed ? <button type=\"button\" disabled={busy} onClick={() => resendInvite(member)}>Reenviar convite</button> : null}<button type=\"button\" disabled={busy} onClick={() => toggleMember(member)}>",
      "{member.status === 'invited' ? <button type=\"button\" disabled={busy} onClick={() => generateInviteLink(member)}>{generatedInvite ? 'Gerar novo link' : 'Gerar link de acesso'}</button> : null}{emailFailed ? <button type=\"button\" disabled={busy} onClick={() => resendInvite(member)}>Reenviar e-mail</button> : null}<button type=\"button\" disabled={busy} onClick={() => toggleMember(member)}>",
      'member link button')

    writeFileSync(teamPath, team)
  }

  const appPath = `${root}src/App.jsx`
  let app = readFileSync(appPath, 'utf8')
  if (!app.includes("InviteLinkAccept from './components/InviteLinkAccept.jsx'")) {
    app = replaceOrFail(app,
      "import InviteSetup from './components/InviteSetup.jsx'",
      "import InviteSetup from './components/InviteSetup.jsx'\nimport InviteLinkAccept from './components/InviteLinkAccept.jsx'",
      'app invite link import')

    app = replaceOrFail(app,
      "  const [inviteSetupOpen, setInviteSetupOpen] = useState(() => new URLSearchParams(window.location.search).get('invite') === '1')",
      "  const joinToken = new URLSearchParams(window.location.search).get('join') || ''\n  const [inviteSetupOpen, setInviteSetupOpen] = useState(() => new URLSearchParams(window.location.search).get('invite') === '1')",
      'join token')

    app = replaceOrFail(app,
      "  if (!authReady && !localPreview) return <div className=\"react-loading\"><span>ED</span><b>Verificando acesso…</b></div>",
      "  if (joinToken && !localPreview) return <InviteLinkAccept token={joinToken} session={session} />\n  if (!authReady && !localPreview) return <div className=\"react-loading\"><span>ED</span><b>Verificando acesso…</b></div>",
      'public invite route')

    writeFileSync(appPath, app)
  }
}
