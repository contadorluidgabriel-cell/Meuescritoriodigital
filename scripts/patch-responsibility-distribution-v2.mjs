import { readFileSync, writeFileSync } from 'node:fs'

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Responsibility Distribution V2 patch failed (${label})`)
  return source.replace(from, to)
}

export function applyResponsibilityDistributionV2Patch(root) {
  const officePath = `${root}src/hooks/useOfficeData.js`
  let office = readFileSync(officePath, 'utf8')
  if (!office.includes("applyPrimaryResponsibilityInheritance from '../lib/responsibility.js'")) {
    office = replaceOrFail(
      office,
      "import { useTodoistTasks } from './useTodoistTasks.js'",
      "import { useTodoistTasks } from './useTodoistTasks.js'\nimport { applyPrimaryResponsibilityInheritance } from '../lib/responsibility.js'",
      'office inheritance import',
    )
    office = replaceOrFail(
      office,
      "    recipe(draft)\n    dirtyVersion.current += 1",
      "    recipe(draft)\n    applyPrimaryResponsibilityInheritance(current, draft)\n    dirtyVersion.current += 1",
      'office inheritance application',
    )
    writeFileSync(officePath, office)
  }

  const clientsPath = `${root}src/components/ClientsReact.jsx`
  let clients = readFileSync(clientsPath, 'utf8')
  if (!clients.includes("ClientPrimaryResponsible from './ClientPrimaryResponsible.jsx'")) {
    clients = replaceOrFail(
      clients,
      "import { today, uid } from '../lib/storage.js'",
      "import { today, uid } from '../lib/storage.js'\nimport ClientPrimaryResponsible from './ClientPrimaryResponsible.jsx'",
      'client responsibility import',
    )
    clients = replaceOrFail(
      clients,
      "export default function ClientsReact({ office, update, sync, onOpenTasks, onOpenProcesses, onOpenFinance, initialClientId = '', openClientRequest = 0 })",
      "export default function ClientsReact({ office, update, sync, access, onRefresh, onOpenTasks, onOpenProcesses, onOpenFinance, initialClientId = '', openClientRequest = 0 })",
      'client access props',
    )
    clients = replaceOrFail(
      clients,
      "  }, [initialClientId, office.clients, openClientRequest])\n\n  function openNew()",
      "  }, [initialClientId, office.clients, openClientRequest])\n\n  useEffect(() => {\n    if (!details?.id) return\n    const current = (office.clients || []).find(item => String(item.id) === String(details.id))\n    if (current) setDetails(current)\n  }, [details?.id, office.clients])\n\n  function openNew()",
      'client detail refresh',
    )
    clients = replaceOrFail(
      clients,
      "{details ? <ClientDetails client={details} office={office} onClose={() => setDetails(null)}",
      "{details ? <ClientDetails client={details} office={office} access={access} onRefresh={onRefresh} onClose={() => setDetails(null)}",
      'client detail props',
    )
    clients = replaceOrFail(
      clients,
      "function ClientDetails({ client, office, onClose, onEdit, onOpenTasks, onNewProcess, onOpenProcess, onOpenFinance })",
      "function ClientDetails({ client, office, access, onRefresh, onClose, onEdit, onOpenTasks, onNewProcess, onOpenProcess, onOpenFinance })",
      'client detail signature',
    )
    clients = replaceOrFail(
      clients,
      "    <div className=\"details-actions\"><button onClick={onOpenTasks}>",
      "    <ClientPrimaryResponsible client={client} office={office} access={access} onRefresh={onRefresh} />\n    <div className=\"details-actions\"><button onClick={onOpenTasks}>",
      'client responsibility card',
    )
    writeFileSync(clientsPath, clients)
  }

  const usersPath = `${root}src/components/UserAccessManager.jsx`
  let users = readFileSync(usersPath, 'utf8')
  if (!users.includes('onOpenDistribution })')) {
    users = replaceOrFail(
      users,
      'export default function UserAccessManager({ office, update, access, onRefresh })',
      'export default function UserAccessManager({ office, update, access, onRefresh, onOpenDistribution })',
      'user manager distribution prop',
    )
    users = replaceOrFail(
      users,
      "            {!ownerSelected ? <div className=\"user-access-detail-actions\"><button type=\"button\" disabled={busy} onClick={() => mutateMember(selected, { status: selected.status === 'disabled' ? 'active' : 'disabled' }, selected.status === 'disabled' ? 'Acesso reativado.' : 'Acesso desativado.')}>{selected.status === 'disabled' ? 'Reativar' : 'Desativar'}</button><button type=\"button\" className=\"danger\" disabled={busy} onClick={() => removeMember(selected)}>Remover</button></div> : null}",
      "            {!ownerSelected ? <div className=\"user-access-detail-actions\">{selected.status === 'disabled' ? <button type=\"button\" disabled={busy} onClick={() => mutateMember(selected, { status: 'active' }, 'Acesso reativado.')}>Reativar</button> : selected.status === 'active' && selected.user_id ? <button type=\"button\" disabled={busy} onClick={() => onOpenDistribution?.(selected.user_id, 'deactivate')}>Desativar</button> : <button type=\"button\" disabled={busy} onClick={() => mutateMember(selected, { status: 'disabled' }, 'Convite desativado.')}>Desativar convite</button>}{selected.status === 'invited' ? <button type=\"button\" className=\"danger\" disabled={busy} onClick={() => removeMember(selected)}>Remover convite</button> : null}</div> : null}",
      'assisted deactivation action',
    )
    writeFileSync(usersPath, users)
  }
}
