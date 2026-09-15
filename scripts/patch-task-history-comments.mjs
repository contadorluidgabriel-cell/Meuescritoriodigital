import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label, path) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`Task history patch failed (${label}) in ${path}`)
  return source.replace(from, to)
}

function insertBefore(source, marker, content, label, path) {
  if (source.includes(content.trim())) return source
  const index = source.indexOf(marker)
  if (index < 0) throw new Error(`Task history patch failed (${label}) in ${path}`)
  return source.slice(0, index) + content + source.slice(index)
}

export function applyTaskHistoryCommentsPatch(root) {
  const taskPath = `${root}src/components/TasksReactBase.jsx`
  let source = readFileSync(taskPath, 'utf8')
  if (!source.includes('task-history-panel')) {
    source = replaceRequired(
      source,
      "  const [editing, setEditing] = useState(null)",
      "  const [editing, setEditing] = useState(null)\n  const [historyOpen, setHistoryOpen] = useState(false)\n  const [historyQuery, setHistoryQuery] = useState('')\n  const [historyClient, setHistoryClient] = useState('')\n  const [historyPeriod, setHistoryPeriod] = useState('90')\n  const [commentTaskId, setCommentTaskId] = useState('')\n  const [commentDraft, setCommentDraft] = useState('')",
      'history state',
      taskPath,
    )

    source = insertBefore(
      source,
      "  function commitTasks(nextTasks) {",
      `  function taskCompletedAt(task) {\n    return task?.concluidoEm || task?.completedAt || task?.updatedAt || ''\n  }\n\n  function taskComments(task) {\n    return Array.isArray(task?.comentarios) ? task.comentarios : []\n  }\n\n  function taskCommentAuthor() {\n    return session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email || 'Usuário'\n  }\n\n  function addTaskComment(taskId, text = commentDraft) {\n    const body = String(text || '').trim()\n    if (!body) return\n    const stamp = new Date().toISOString()\n    const comment = { id: 'com_' + Math.random().toString(36).slice(2, 10), texto: body, criadoEm: stamp, autor: taskCommentAuthor() }\n    update(draft => {\n      const task = (draft.tasks || []).find(item => String(item.id) === String(taskId))\n      if (!task) return\n      task.comentarios = [...(Array.isArray(task.comentarios) ? task.comentarios : []), comment]\n      task.updatedAt = stamp\n    })\n    if (editing?.id && String(editing.id) === String(taskId)) setEditing(current => ({ ...current, comentarios: [...taskComments(current), comment], updatedAt: stamp }))\n    setCommentDraft('')\n  }\n\n  function removeTaskComment(taskId, commentId) {\n    update(draft => {\n      const task = (draft.tasks || []).find(item => String(item.id) === String(taskId))\n      if (!task) return\n      task.comentarios = (Array.isArray(task.comentarios) ? task.comentarios : []).filter(item => String(item.id) !== String(commentId))\n      task.updatedAt = new Date().toISOString()\n    })\n    if (editing?.id && String(editing.id) === String(taskId)) setEditing(current => ({ ...current, comentarios: taskComments(current).filter(item => String(item.id) !== String(commentId)) }))\n  }\n\n  function completedWithinPeriod(task) {\n    if (!isDone(task.status)) return false\n    const days = Number(historyPeriod || 0)\n    if (!days) return true\n    const value = Date.parse(taskCompletedAt(task))\n    if (!Number.isFinite(value)) return true\n    return value >= Date.now() - days * 86400000\n  }\n\n`,
      'history helpers',
      taskPath,
    )

    source = replaceRequired(
      source,
      "  const filtered = useMemo(() => office.tasks.filter(task => {",
      "  const filtered = useMemo(() => office.tasks.filter(task => {\n    if (isDone(task.status)) return false",
      'hide completed from main list',
      taskPath,
    )

    source = insertBefore(
      source,
      "  return <div className=\"react-module-page",
      `  const completedTasks = useMemo(() => (office.tasks || []).filter(task => {\n    if (!completedWithinPeriod(task)) return false\n    const needle = historyQuery.trim().toLowerCase()\n    const client = (office.clients || []).find(item => String(item.id) === String(task.clientId))\n    const searchable = [task.titulo, task.descricao, task.observacao, clientName(client), ...taskComments(task).map(item => item.texto)].filter(Boolean).join(' ').toLowerCase()\n    if (needle && !searchable.includes(needle)) return false\n    if (historyClient && String(task.clientId || '') !== String(historyClient)) return false\n    return true\n  }).sort((a, b) => String(taskCompletedAt(b)).localeCompare(String(taskCompletedAt(a)))), [historyClient, historyPeriod, historyQuery, office.clients, office.tasks])\n  const completedCount = useMemo(() => (office.tasks || []).filter(task => isDone(task.status)).length, [office.tasks])\n\n`,
      'completed history memo',
      taskPath,
    )

    source = replaceRequired(
      source,
      "<div className=\"react-module-actions\"><span className=\"sync-indicator\">{sync}</span><button className=\"primary\" onClick={openNew}>+ Nova tarefa</button></div>",
      "<div className=\"react-module-actions\"><span className=\"sync-indicator\">{sync}</span><button type=\"button\" className=\"task-history-link\" onClick={() => setHistoryOpen(current => !current)}>Histórico {completedCount ? `(${completedCount})` : ''}</button><button className=\"primary\" onClick={openNew}>+ Nova tarefa</button></div>",
      'history top action',
      taskPath,
    )

    source = replaceRequired(
      source,
      "{!filtered.length ? <div className=\"empty\">Nenhuma tarefa encontrada.</div> : null}",
      "{!filtered.length ? <div className=\"empty\">Nenhuma tarefa em aberto encontrada.</div> : null}",
      'main empty message',
      taskPath,
    )

    source = insertBefore(
      source,
      "    {editing ?",
      `    {historyOpen ? <section className="task-history-panel">\n      <header><div><span>ARQUIVO OPERACIONAL</span><h2>Histórico de tarefas</h2><p>Tarefas concluídas ficam fora da operação diária, mas continuam disponíveis para consulta, comentários e reabertura.</p></div><button type="button" onClick={() => setHistoryOpen(false)}>Fechar</button></header>\n      <div className="task-history-filters"><input value={historyQuery} onChange={event => setHistoryQuery(event.target.value)} placeholder="Buscar tarefa, cliente ou comentário" /><select value={historyClient} onChange={event => setHistoryClient(event.target.value)}><option value="">Todos os clientes</option>{(office.clients || []).map(client => <option key={client.id} value={String(client.id)}>{clientName(client)}</option>)}</select><select value={historyPeriod} onChange={event => setHistoryPeriod(event.target.value)}><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Último ano</option><option value="0">Todo o histórico</option></select></div>\n      <div className="task-history-list">{completedTasks.map(task => { const client = (office.clients || []).find(item => String(item.id) === String(task.clientId)); const comments = taskComments(task); return <article key={task.id} className="task-history-card"><div className="task-history-main"><div className="task-history-title"><span>Concluída</span><strong>{task.titulo || 'Tarefa'}</strong></div><small>{clientName(client)} · concluída em {taskCompletedAt(task) ? new Date(taskCompletedAt(task)).toLocaleString('pt-BR') : 'data não registrada'}</small>{task.observacao ? <p className="task-history-observation">{task.observacao}</p> : null}{comments.length ? <div className="task-comments-list">{comments.map(comment => <div key={comment.id || comment.criadoEm}><div><strong>{comment.autor || 'Usuário'}</strong><small>{comment.criadoEm ? new Date(comment.criadoEm).toLocaleString('pt-BR') : ''}</small></div><p>{comment.texto}</p><button type="button" onClick={() => removeTaskComment(task.id, comment.id)}>Remover</button></div>)}</div> : null}<div className="task-comment-compose"><input value={commentTaskId === String(task.id) ? commentDraft : ''} onFocus={() => { if (commentTaskId !== String(task.id)) { setCommentTaskId(String(task.id)); setCommentDraft('') } }} onChange={event => { setCommentTaskId(String(task.id)); setCommentDraft(event.target.value) }} placeholder="Adicionar comentário ao histórico…" /><button type="button" disabled={commentTaskId !== String(task.id) || !commentDraft.trim()} onClick={() => addTaskComment(task.id)}>Comentar</button></div></div><div className="task-history-actions"><button type="button" onClick={() => toggleTask(task.id)}>Reabrir</button><button type="button" onClick={() => openEdit(task)}>Abrir</button></div></article>})}{!completedTasks.length ? <div className="empty">Nenhuma tarefa concluída encontrada neste período.</div> : null}</div>\n    </section> : null}\n\n`,
      'history panel',
      taskPath,
    )

    source = replaceRequired(
      source,
      "<Field label=\"Descrição\" full><textarea value={editing.descricao} onChange={event => setField('descricao', event.target.value)} /></Field>",
      "<Field label=\"Descrição\" full><textarea value={editing.descricao} onChange={event => setField('descricao', event.target.value)} /></Field><Field label=\"Observação\" full><textarea value={editing.observacao || ''} onChange={event => setField('observacao', event.target.value)} placeholder=\"Registre contexto, resultado, protocolo ou detalhe importante da execução.\" /></Field>{editing.id ? <Field label=\"Comentários\" full><div className=\"task-comments-editor\">{taskComments(editing).map(comment => <article key={comment.id || comment.criadoEm}><div><strong>{comment.autor || 'Usuário'}</strong><small>{comment.criadoEm ? new Date(comment.criadoEm).toLocaleString('pt-BR') : ''}</small></div><p>{comment.texto}</p><button type=\"button\" onClick={() => removeTaskComment(editing.id, comment.id)}>Remover</button></article>)}<div className=\"task-comment-compose\"><input value={commentTaskId === String(editing.id) ? commentDraft : ''} onFocus={() => { if (commentTaskId !== String(editing.id)) { setCommentTaskId(String(editing.id)); setCommentDraft('') } }} onChange={event => { setCommentTaskId(String(editing.id)); setCommentDraft(event.target.value) }} placeholder=\"Adicionar comentário…\" /><button type=\"button\" disabled={commentTaskId !== String(editing.id) || !commentDraft.trim()} onClick={() => addTaskComment(editing.id)}>Comentar</button></div></div></Field> : null}",
      'observation and comments fields',
      taskPath,
    )

    source = replaceRequired(
      source,
      "status: editing.status, recorrencia: editing.recorrencia,",
      "status: editing.status, recorrencia: editing.recorrencia, observacao: String(editing.observacao || '').trim(), comentarios: taskComments(editing),",
      'save notes and comments',
      taskPath,
    )

    writeFileSync(taskPath, source)
  }

  const cssPath = `${root}src/tasks-react.css`
  let css = readFileSync(cssPath, 'utf8')
  if (!css.includes('.task-history-panel')) {
    css += `\n.task-history-link{border:0;background:transparent;color:#667085;padding:8px 10px;font-size:12px;font-weight:700;cursor:pointer}.task-history-link:hover{color:#2456e8}.task-history-panel{display:grid;gap:16px;margin-top:16px;padding:20px;border:1px solid #e4e9f1;border-radius:18px;background:#fff}.task-history-panel>header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.task-history-panel>header span{display:block;margin-bottom:4px;color:#667085;font-size:10px;font-weight:800;letter-spacing:.12em}.task-history-panel>header h2{margin:0;color:#182230;font-size:18px}.task-history-panel>header p{max-width:720px;margin:6px 0 0;color:#667085;font-size:13px;line-height:1.45}.task-history-panel>header>button{border:1px solid #e4e9f1;border-radius:10px;background:#fff;padding:8px 12px;color:#344054;font-weight:700;cursor:pointer}.task-history-filters{display:grid;grid-template-columns:minmax(240px,1fr) minmax(180px,.55fr) minmax(150px,.35fr);gap:10px}.task-history-filters input,.task-history-filters select{min-height:40px;border:1px solid #e4e9f1;border-radius:10px;background:#fff;padding:8px 10px;color:#182230}.task-history-list{display:grid;gap:10px}.task-history-card{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:15px 16px;border:1px solid #edf0f5;border-radius:14px;background:#fbfcfe}.task-history-main{min-width:0;flex:1}.task-history-title{display:flex;align-items:center;gap:9px}.task-history-title span{border-radius:999px;background:#ecfdf3;padding:4px 8px;color:#16834a;font-size:10px;font-weight:800;text-transform:uppercase}.task-history-title strong{color:#182230;font-size:14px}.task-history-main>small{display:block;margin-top:5px;color:#667085;font-size:11px}.task-history-observation{margin:10px 0 0;padding:10px 12px;border-left:3px solid #2456e8;border-radius:0 8px 8px 0;background:#f6f8fc;color:#344054;font-size:12px;line-height:1.45}.task-history-actions{display:flex;gap:7px}.task-history-actions button{border:1px solid #e4e9f1;border-radius:9px;background:#fff;padding:7px 10px;color:#344054;font-size:11px;font-weight:700;cursor:pointer}.task-comments-list,.task-comments-editor{display:grid;gap:8px;margin-top:10px}.task-comments-list>div,.task-comments-editor>article{position:relative;padding:10px 70px 10px 12px;border:1px solid #e8ecf2;border-radius:10px;background:#fff}.task-comments-list>div>div,.task-comments-editor article>div{display:flex;gap:8px;align-items:center}.task-comments-list strong,.task-comments-editor strong{font-size:11px;color:#344054}.task-comments-list small,.task-comments-editor small{font-size:10px;color:#98a2b3}.task-comments-list p,.task-comments-editor p{margin:5px 0 0;color:#475467;font-size:12px;line-height:1.4}.task-comments-list>div>button,.task-comments-editor article>button{position:absolute;right:9px;top:8px;border:0;background:transparent;color:#98a2b3;font-size:10px;cursor:pointer}.task-comment-compose{display:flex;gap:8px;margin-top:10px}.task-comment-compose input{flex:1;min-height:38px;border:1px solid #e4e9f1;border-radius:9px;padding:8px 10px}.task-comment-compose button{border:0;border-radius:9px;background:#2456e8;padding:8px 12px;color:#fff;font-size:11px;font-weight:800;cursor:pointer}.task-comment-compose button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:760px){.task-history-filters{grid-template-columns:1fr}.task-history-card{flex-direction:column}.task-history-actions{width:100%}.task-history-actions button{flex:1}.task-comment-compose{flex-direction:column}}\n`
    writeFileSync(cssPath, css)
  }
}
