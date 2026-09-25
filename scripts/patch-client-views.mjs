import { readFileSync, writeFileSync } from 'node:fs'

const marker = 'MED_CLIENT_VIEWS_V1'

function replaceRequired(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source
  if (!source.includes(oldValue)) throw new Error('Client views patch: missing ' + label)
  return source.replace(oldValue, newValue)
}

export function applyClientViewsPatch(root) {
  const componentPath = root + 'src/components/ClientsReact.jsx'
  let source = readFileSync(componentPath, 'utf8')
  if (!source.includes(marker)) {
    source = replaceRequired(
      source,
      "const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'\nconst addDays =",
      "const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'\nconst clientViewOf = client => {\n  if (client?.status === 'Inativo') return 'inactive'\n  if (documentType(client?.documento, client?.tipo) === 'PF') return 'person'\n  if (client?.relacionamento === 'Avulso') return 'oneoff'\n  return 'recurring'\n}\nconst clientViewOptions = [\n  ['recurring', 'Recorrentes'],\n  ['oneoff', 'Avulsos'],\n  ['person', 'Pessoa Física'],\n  ['inactive', 'Inativos'],\n]\nconst addDays =",
      'view classifier',
    )
    source = replaceRequired(
      source,
      "  const [query, setQuery] = useState(''), [status, setStatus] = useState(''), [relationship, setRelationship] = useState('')\n  const [editing, setEditing] = useState(null), [details, setDetails] = useState(null), [error, setError] = useState('')",
      "  const [query, setQuery] = useState('')\n  const [clientView, setClientView] = useState('recurring')\n  const [editing, setEditing] = useState(null), [details, setDetails] = useState(null), [error, setError] = useState('')",
      'view state',
    )
    source = replaceRequired(
      source,
      "  const rows = useMemo(() => office.clients.filter(client => {\n    const matchesQuery = !query || normalize(`${clientName(client)} ${client.fantasia || ''} ${client.documento || ''} ${documentDigits(client.documento)} ${client.id}`).includes(normalize(query))\n    return matchesQuery && (!status || client.status === status) && (!relationship || client.relacionamento === relationship)\n  }), [office.clients, query, relationship, status])",
      "  const viewCounts = useMemo(() => office.clients.reduce((counts, client) => { const key = clientViewOf(client); counts[key] = (counts[key] || 0) + 1; return counts }, { recurring: 0, oneoff: 0, person: 0, inactive: 0 }), [office.clients])\n  const rows = useMemo(() => office.clients.filter(client => {\n    const matchesQuery = !query || normalize(`${clientName(client)} ${client.fantasia || ''} ${client.documento || ''} ${documentDigits(client.documento)} ${client.id}`).includes(normalize(query))\n    return matchesQuery && clientViewOf(client) === clientView\n  }), [clientView, office.clients, query])",
      'view-filtered rows',
    )
    source = replaceRequired(
      source,
      "    setEditing(null)\n  }\n\n  return <div className=\"react-module-page\">",
      "    setEditing(null)\n    setClientView(clientViewOf(client))\n  }\n\n  return <div className=\"react-module-page\">",
      'post-save routing',
    )
    source = replaceRequired(
      source,
      "    <section className=\"react-module-card\"><div className=\"client-filters\"><input placeholder=\"Buscar nome, CPF/CNPJ ou ID\" value={query} onChange={event => setQuery(event.target.value)} /><select value={status} onChange={event => setStatus(event.target.value)}><option value=\"\">Ativos e inativos</option><option>Ativo</option><option>Inativo</option></select><select value={relationship} onChange={event => setRelationship(event.target.value)}><option value=\"\">Recorrentes e avulsos</option><option>Recorrente</option><option>Avulso</option></select></div>",
      "    <section className=\"react-module-card\"><div className=\"client-view-tabs\" role=\"tablist\" aria-label=\"Visões de clientes\">{clientViewOptions.map(([id, label]) => <button type=\"button\" role=\"tab\" aria-selected={clientView === id} className={clientView === id ? 'active' : ''} key={id} onClick={() => setClientView(id)}><span>{label}</span><b>{viewCounts[id] || 0}</b></button>)}</div><div className=\"client-filters client-filters-single\"><input placeholder=\"Buscar nesta visão por nome, CPF/CNPJ ou ID\" value={query} onChange={event => setQuery(event.target.value)} /></div>",
      'view tabs',
    )
    source = '// ' + marker + '\n' + source
    writeFileSync(componentPath, source)
  }

  const cssPath = root + 'src/clients-react.css'
  let css = readFileSync(cssPath, 'utf8')
  if (!css.includes(marker)) {
    css += "\n/* " + marker + " */\n.client-view-tabs{display:flex;gap:8px;align-items:center;margin-bottom:14px;padding:4px;border:1px solid #E4E9F1;border-radius:14px;background:#F6F8FC;overflow-x:auto}.client-view-tabs button{border:0;background:transparent;color:#667085;border-radius:10px;padding:10px 14px;display:inline-flex;align-items:center;gap:8px;font:inherit;font-weight:600;white-space:nowrap;cursor:pointer}.client-view-tabs button b{min-width:24px;padding:2px 7px;border-radius:999px;background:#fff;color:#667085;font-size:12px;line-height:18px;text-align:center}.client-view-tabs button.active{background:#fff;color:#182230;box-shadow:0 1px 3px rgba(16,24,40,.08)}.client-view-tabs button.active b{background:#2456E8;color:#fff}.client-filters.client-filters-single{grid-template-columns:minmax(240px,520px)}@media(max-width:720px){.client-view-tabs{margin-left:-2px;margin-right:-2px}.client-view-tabs button{padding:9px 12px}.client-filters.client-filters-single{grid-template-columns:1fr}}\n"
    writeFileSync(cssPath, css)
  }
}
