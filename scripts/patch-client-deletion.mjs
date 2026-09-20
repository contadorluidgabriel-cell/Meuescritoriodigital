import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Não foi possível aplicar exclusão de clientes: ${label}`)
  return source.replace(before, after)
}

export function applyClientDeletionPatch(root) {
  const clientPath = resolve(root, 'src/components/ClientsReact.jsx')
  let client = readFileSync(clientPath, 'utf8')
  if (!client.includes("import { deleteClientFromWorkspace, clientDependencies, clientHasEmbeddedHistory } from '../lib/clientDeletion.js'")) {
    client = replaceOnce(client,
      "import { today, uid } from '../lib/storage.js'",
      "import { today, uid } from '../lib/storage.js'\nimport { deleteClientFromWorkspace, clientDependencies, clientHasEmbeddedHistory } from '../lib/clientDeletion.js'\nimport '../client-deletion.css'", 'importações')
    const signature = client.match(/export default function ClientsReact\(\{[^\n]*\}\) \{/)
    if (!signature) throw new Error('Não foi possível localizar assinatura da tela de clientes.')
    let nextSignature = signature[0]
    if (!nextSignature.includes('access,')) nextSignature = nextSignature.replace('sync, ', 'sync, access, ')
    if (!nextSignature.includes('refreshWorkspace,')) nextSignature = nextSignature.replace('access, ', 'access, refreshWorkspace, ')
    client = replaceOnce(client, signature[0], nextSignature, 'propriedades')
    client = replaceOnce(client,
      "  const [selectedTemplates, setSelectedTemplates] = useState(new Set())",
      `  const [selectedTemplates, setSelectedTemplates] = useState(new Set())
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteNotice, setDeleteNotice] = useState('')
  const isOwner = Boolean(access?.workspace?.owner_user_id && String(access.workspace.owner_user_id) === String(access?.membership?.user_id))
  const canDelete = access?.membership?.role === 'admin' && (isOwner || (access?.membership?.permissions?.delete_records === true && access?.membership?.permissions?.clients === true && access?.membership?.permissions?.manage_clients === true))
  const deleteBlockers = deleteTarget ? clientDependencies(office, deleteTarget.id) : []
  if (deleteTarget && clientHasEmbeddedHistory(deleteTarget) && !deleteBlockers.some(item => item.key === 'embedded')) deleteBlockers.push({ key: 'embedded', label: 'histórico do cliente', count: 1 })`, 'estado e permissão')
    client = replaceOnce(client,
      '  function saveClient(event) {',
      `  function openDelete(client) {
    if (!canDelete || !client?.id) return
    setDeleteTarget(client)
    setDeleteConfirmation('')
    setDeleteError('')
    setDeleteNotice('')
  }

  async function confirmDelete() {
    const id = String(deleteTarget?.id || '')
    if (!canDelete || !id || deleting || deleteConfirmation !== 'EXCLUIR') return
    if (sync !== 'Sincronizado · equipe') { setDeleteError('Aguarde a sincronização do escritório antes de excluir. No modo local, a exclusão está indisponível.'); return }
    const current = (office.clients || []).find(item => String(item.id) === id)
    if (!current) { setDeleteError('Cadastro não encontrado. Atualize a página.'); return }
    const blockers = clientDependencies(office, id)
    if (clientHasEmbeddedHistory(current)) blockers.push({ key: 'embedded', label: 'histórico do cliente', count: 1 })
    if (blockers.length) { setDeleteError('Este cadastro possui vínculos ou histórico. Altere o status para Inativo.'); return }
    if (!access?.workspace?.id || typeof refreshWorkspace !== 'function') { setDeleteError('Não foi possível confirmar o escritório atual.'); return }
    setDeleting(true)
    setDeleteError('')
    try {
      const result = await deleteClientFromWorkspace(access.workspace.id, id, deleteConfirmation)
      if (!result?.ok || String(result.client_id) !== id) throw new Error('O servidor não confirmou a exclusão.')
      setDeleteTarget(null)
      setDetails(null)
      setEditing(null)
      try {
        const refreshed = await refreshWorkspace()
        setDeleteNotice(refreshed ? 'Cadastro excluído do escritório. Documentos do Google Drive não foram apagados.' : 'Cadastro excluído no servidor. Aguarde a sincronização e atualize a página para conferir a lista.')
      } catch {
        setDeleteNotice('Cadastro excluído no servidor, mas a atualização da lista falhou. Atualize a página após sincronizar.')
      }
    } catch (error) {
      setDeleteError(error?.message || 'Não foi possível excluir o cadastro.')
    } finally {
      setDeleting(false)
    }
  }

  function saveClient(event) {`, 'ações de exclusão')
    client = replaceOnce(client,
      '<button className="primary" onClick={openNew}>+ Novo cliente</button></div></div>',
      '<button className="primary" onClick={openNew}>+ Novo cliente</button></div></div>{deleteNotice ? <p className="client-delete-notice" role="status">{deleteNotice}</p> : null}', 'aviso de resultado')
    client = replaceOnce(client,
      '<button onClick={() => openEdit(client)}>Editar</button></div></div>)}</div>',
      '<button onClick={() => openEdit(client)}>Editar</button>{canDelete ? <button type="button" className="client-delete-trigger" onClick={() => openDelete(client)}>Excluir</button> : null}</div></div>)}</div>', 'ação na lista')
    client = replaceOnce(client,
      '<button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary">Salvar cliente</button></footer>',
      '<button type="button" onClick={() => setEditing(null)}>Cancelar</button>{editing.id && canDelete ? <button type="button" className="client-delete-trigger" onClick={() => { const current = (office.clients || []).find(item => String(item.id) === String(editing.id)); if (current) { setEditing(null); openDelete(current) } }}>Excluir cadastro</button> : null}<button className="primary">Salvar cliente</button></footer>', 'ação na edição')
    client = replaceOnce(client,
      "    {details ? <ClientDetails client={details}",
      `    {deleteTarget ? <Modal title="Excluir cadastro" subtitle="Exclusão permanente somente para cadastros sem vínculos." onClose={() => { if (!deleting) setDeleteTarget(null) }}>
      <div className="client-delete-dialog">
        <p>Cliente: <strong>{clientName(deleteTarget)}</strong></p>
        <p>Esta ação não pode ser desfeita. Ela não exclui documentos no Google Drive.</p>
        {deleteBlockers.length ? <p role="alert" className="client-delete-warning">Exclusão bloqueada: {deleteBlockers.map(item => item.label).join(', ')}. Para encerrar o atendimento, edite o cadastro e selecione Inativo.</p> : <label className="client-field"><span>Digite EXCLUIR para confirmar</span><input autoComplete="off" value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} disabled={deleting} /></label>}
        {deleteError ? <p className="client-delete-warning" role="alert">{deleteError}</p> : null}
        <footer className="client-form-actions"><button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancelar</button>{!deleteBlockers.length ? <button type="button" className="client-delete-confirm" disabled={deleting || deleteConfirmation !== 'EXCLUIR' || sync !== 'Sincronizado · equipe'} onClick={confirmDelete}>{deleting ? 'Excluindo…' : 'Excluir definitivamente'}</button> : null}</footer>
      </div>
    </Modal> : null}
    {details ? <ClientDetails client={details}`, 'confirmação')
    writeFileSync(clientPath, client)
  }

  const appPath = resolve(root, 'src/App.jsx')
  let app = readFileSync(appPath, 'utf8')
  if (!app.includes('refreshWorkspace={refreshWorkspace}')) {
    if (!app.includes('refreshWorkspace } = useOfficeData(session)')) {
      app = replaceOnce(app,
        '  const { office, update, ready, sync } = useOfficeData(session)',
        '  const { office, update, ready, sync, access, refreshWorkspace } = useOfficeData(session)', 'acesso no App')
    }
    if (app.includes('onRefresh={refreshWorkspace} onOpenTasks=')) {
      app = replaceOnce(app,
        'onRefresh={refreshWorkspace} onOpenTasks=',
        'onRefresh={refreshWorkspace} refreshWorkspace={refreshWorkspace} onOpenTasks=', 'acesso na tela V12')
    } else {
      app = replaceOnce(app,
        '<ClientsReact office={office} update={update} sync={sync} onOpenTasks=',
        '<ClientsReact office={office} update={update} sync={sync} access={access} refreshWorkspace={refreshWorkspace} onOpenTasks=', 'acesso na tela original')
    }
    writeFileSync(appPath, app)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  applyClientDeletionPatch(resolve(fileURLToPath(new URL('../', import.meta.url))))
  console.log('Exclusão segura de clientes integrada ao build do MED.')
}
