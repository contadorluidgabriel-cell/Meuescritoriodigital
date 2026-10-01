import { readFileSync, writeFileSync } from 'node:fs'

export function applyClientOutsourcingPatch(root) {
  const path = `${root}src/components/ClientsReact.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes("import OutsourcedCompaniesPanel from './OutsourcedCompaniesPanel.jsx'")) return

  const replacements = [
    [
      "import { today, uid } from '../lib/storage.js'",
      "import { today, uid } from '../lib/storage.js'\nimport OutsourcedCompaniesPanel from './OutsourcedCompaniesPanel.jsx'\nimport { outsourcingPortfolio } from '../lib/outsourcingPortfolio.js'",
      'panel import',
    ],
    [
      "status: 'Ativo', drive: '', observacoes: '', dataEntrada: '', dataSaida: '', motivoSaida: '', comunicacoes: [],",
      "status: 'Ativo', perfilAtendimento: 'Direto', drive: '', observacoes: '', dataEntrada: '', dataSaida: '', motivoSaida: '', comunicacoes: [],",
      'client profile default',
    ],
    [
      "<Field label=\"E-mail\"><input type=\"email\" value={editing.email} onChange={event => setField('email', event.target.value)} /></Field><Field label=\"Relacionamento\"><select value={editing.relacionamento} onChange={event => setField('relacionamento', event.target.value)}><option>Recorrente</option><option>Avulso</option></select></Field>",
      "<Field label=\"E-mail\"><input type=\"email\" value={editing.email} onChange={event => setField('email', event.target.value)} /></Field><Field label=\"Relacionamento\"><select value={editing.relacionamento} onChange={event => setField('relacionamento', event.target.value)}><option>Recorrente</option><option>Avulso</option></select></Field><Field label=\"Forma de atendimento\"><select value={editing.perfilAtendimento || 'Direto'} onChange={event => setField('perfilAtendimento', event.target.value)}><option value=\"Direto\">Direto</option><option value=\"Terceirizador\">Terceirizador</option><option value=\"Compartilhado\">Compartilhado</option></select></Field>",
      'client service profile field',
    ],
    [
      "    </section>\n\n    {editing ? <Modal",
      "    </section>\n\n    <OutsourcedCompaniesPanel office={office} update={update} />\n\n    {editing ? <Modal",
      'outsourced card',
    ],
    [
      "function ClientDetails({ client, office, onClose, onEdit, onOpenTasks, onNewProcess, onOpenProcess, onOpenFinance }) {\n  const [tab, setTab] = useState('overview')\n  const clientId = String(client.id)",
      "function ClientDetails({ client, office, onClose, onEdit, onOpenTasks, onNewProcess, onOpenProcess, onOpenFinance }) {\n  const [tab, setTab] = useState('overview')\n  const clientId = String(client.id)\n  const outsourcing = outsourcingPortfolio(office, clientId)\n  const hasOutsourcing = outsourcing.companyCount > 0",
      'outsourcing portfolio summary state',
    ],
    [
      "{tab === 'overview' ? <div className=\"overview-grid\"><article><small>Tarefas abertas</small><strong>{tasks.filter(item => !/conclu/i.test(item.status)).length}</strong></article><article><small>Processos ativos</small><strong>{processes.filter(item => !/conclu/i.test(item.status)).length}</strong></article><article><small>Obrigações</small><strong>{obligations.length}</strong></article><p>{client.observacoes || 'Nenhuma observação.'}</p></div> : null}",
      "{tab === 'overview' ? <><div className=\"overview-grid\"><article><small>Tarefas abertas</small><strong>{tasks.filter(item => !/conclu/i.test(item.status)).length}</strong></article><article><small>Processos ativos</small><strong>{processes.filter(item => !/conclu/i.test(item.status)).length}</strong></article><article><small>Obrigações</small><strong>{obligations.length}</strong></article><p>{client.observacoes || 'Nenhuma observação.'}</p></div>{hasOutsourcing ? <section className=\"outsourcing-portfolio-summary\"><header><div><span>Operação terceirizada</span><strong>{outsourcing.companyCount} empresa(s) vinculada(s)</strong></div><small>{outsourcing.openObligationCount} obrigação(ões) em andamento</small></header><div className=\"outsourcing-portfolio-kpis\"><article><small>Empresas</small><strong>{outsourcing.companyCount}</strong></article><article><small>Obrigações abertas</small><strong>{outsourcing.openObligationCount}</strong></article><article><small>Pessoas</small><strong>{outsourcing.totalPeople}</strong></article><article><small>Progresso</small><strong>{outsourcing.peoplePercent}%</strong></article></div>{outsourcing.totalPeople ? <div className=\"outsourcing-portfolio-progress\"><span><i style={{ width: String(outsourcing.peoplePercent) + '%' }} /></span><b>{outsourcing.completedPeople} de {outsourcing.totalPeople} pessoas concluídas</b></div> : null}</section> : null}</> : null}",
      'outsourcing portfolio overview',
    ],
    [
      "{tab === 'tasks' ? <DetailList rows={tasks} title=\"titulo\" /> : null}{tab === 'processes' ? <DetailList rows={processes} title=\"tipo\" onOpen={item => onOpenProcess(item.id)} /> : null}{tab === 'obligations' ? <DetailList rows={obligations} title=\"nome\" /> : null}",
      "{tab === 'tasks' ? <DetailList rows={tasks} title=\"titulo\" /> : null}{tab === 'processes' ? <DetailList rows={processes} title=\"tipo\" onOpen={item => onOpenProcess(item.id)} /> : null}{tab === 'obligations' ? <>{hasOutsourcing ? <div className=\"outsourcing-obligation-list\"><header><div><span>Operação terceirizada</span><strong>{outsourcing.openLinkCount} vínculo(s) pendente(s)</strong></div><small>{outsourcing.companyCount} empresa(s)</small></header>{outsourcing.obligations.length ? outsourcing.obligations.map(row => <article key={row.obligationId + '-' + row.companyId}><div><b>{row.obligationName}</b><small>{row.companyName}{row.competence ? ' · ' + row.competence : ''}</small></div><span>{row.quantitative ? row.completedPeople + '/' + row.totalPeople + ' pessoas' : row.status}</span></article>) : <div className=\"empty\">Nenhuma obrigação vinculada às empresas terceirizadas.</div>}</div> : null}<DetailList rows={obligations} title=\"nome\" /></> : null}",
      'outsourcing obligation list',
    ],
  ]

  for (const [from, to, label] of replacements) {
    if (!source.includes(from)) throw new Error(`Client outsourcing patch failed (${label}) in ${path}`)
    source = source.replace(from, to)
  }

  writeFileSync(path, source)
}
