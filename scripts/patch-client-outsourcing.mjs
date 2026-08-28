import { readFileSync, writeFileSync } from 'node:fs'

export function applyClientOutsourcingPatch(root) {
  const path = `${root}src/components/ClientsReact.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes("import OutsourcedCompaniesPanel from './OutsourcedCompaniesPanel.jsx'")) return

  const replacements = [
    [
      "import { today, uid } from '../lib/storage.js'",
      "import { today, uid } from '../lib/storage.js'\nimport OutsourcedCompaniesPanel from './OutsourcedCompaniesPanel.jsx'",
      'panel import',
    ],
    [
      "status: 'Ativo', drive: '', observacoes: '', dataEntrada: '', dataSaida: '', motivoSaida: '', comunicacoes: [],",
      "status: 'Ativo', perfilAtendimento: 'Direto', drive: '', observacoes: '', dataEntrada: '', dataSaida: '', motivoSaida: '', comunicacoes: [],",
      'client profile default',
    ],
    [
      "<Field label=\"E-mail\"><input type=\"email\" value={editing.email} onChange={event => setField('email', event.target.value)} /></Field><Field label=\"Relacionamento\"><select value={editing.relacionamento} onChange={event => setField('relacionamento', event.target.value)}><option>Recorrente</option><option>Avulso</option></select></Field>",
      "<Field label=\"E-mail\"><input type=\"email\" value={editing.email} onChange={event => setField('email', event.target.value)} /></Field><Field label=\"Tipo de cliente\"><select value={editing.perfilAtendimento || 'Direto'} onChange={event => setField('perfilAtendimento', event.target.value)}><option value=\"Direto\">Cliente direto</option><option value=\"Terceirizador\">Cliente terceirizador</option></select></Field><Field label=\"Relacionamento\"><select value={editing.relacionamento} onChange={event => setField('relacionamento', event.target.value)}><option>Recorrente</option><option>Avulso</option></select></Field>",
      'client profile field',
    ],
    [
      "    </section>\n\n    {editing ? <Modal",
      "    </section>\n\n    <OutsourcedCompaniesPanel office={office} update={update} />\n\n    {editing ? <Modal",
      'outsourced card',
    ],
  ]

  for (const [from, to, label] of replacements) {
    if (!source.includes(from)) throw new Error(`Client outsourcing patch failed (${label}) in ${path}`)
    source = source.replace(from, to)
  }

  writeFileSync(path, source)
}
