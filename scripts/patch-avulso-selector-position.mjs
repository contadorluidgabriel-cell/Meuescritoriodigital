import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(path, from, to, label) {
  const source = readFileSync(path, 'utf8')
  if (source.includes(to)) return
  if (!source.includes(from)) throw new Error(`Avulso selector patch failed (${label}) in ${path}`)
  writeFileSync(path, source.replace(from, to))
}

export function applyAvulsoSelectorPositionPatch(root) {
  replaceOnce(
    `${root}src/components/TasksReactBase.jsx`,
    '<Field label="Título *" full><input value={editing.titulo} onChange={event => setField(\'titulo\', event.target.value)} /></Field><Field label="Cliente"><select value={editing.clientId} onChange={event => setField(\'clientId\', event.target.value)}><option value="">Tarefa interna</option>{clientChoices.map(client => <option value={client.id} key={client.id}>{clientName(client)}{client.status === \'Inativo\' ? \' (inativo)\' : client.relacionamento === \'Avulso\' ? \' (avulso)\' : \'\'}</option>)}</select></Field><Field label="Clientes avulsos" full><div className="third-party-toggle"><label><input type="checkbox" checked={includeAvulsos} onChange={event => setIncludeAvulsos(event.target.checked)} /> Incluir clientes avulsos nesta lista</label></div></Field><Field label="Departamento">',
    '<Field label="Título *" full><input value={editing.titulo} onChange={event => setField(\'titulo\', event.target.value)} /></Field><Field label="Clientes avulsos" full><div className="third-party-toggle"><label><input type="checkbox" checked={includeAvulsos} onChange={event => setIncludeAvulsos(event.target.checked)} /> Mostrar clientes avulsos</label></div></Field><Field label="Cliente"><select value={editing.clientId} onChange={event => setField(\'clientId\', event.target.value)}><option value="">Tarefa interna</option>{clientChoices.map(client => <option value={client.id} key={client.id}>{clientName(client)}{client.status === \'Inativo\' ? \' (inativo)\' : client.relacionamento === \'Avulso\' ? \' (avulso)\' : \'\'}</option>)}</select></Field><Field label="Departamento">',
    'tasks selector position',
  )

  replaceOnce(
    `${root}src/components/ProcessesReact.jsx`,
    '<Field label="Cliente principal *"><select value={draft.clientId} onChange={event => setDraft(current => ({ ...current, clientId: event.target.value, relacionados: current.relacionados.filter(id => id !== event.target.value) }))}><option value="">Selecione</option>{clientChoices.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}{client.status === \'Inativo\' ? \' (Inativo)\' : client.relacionamento === \'Avulso\' ? \' (Avulso)\' : \'\'}</option>)}</select></Field><Field label="Clientes avulsos" full><div className="third-party-toggle"><label><input type="checkbox" checked={includeAvulsos} onChange={event => setIncludeAvulsos(event.target.checked)} /> Incluir clientes avulsos neste processo</label></div></Field><Field label="Modelo">',
    '<Field label="Clientes avulsos" full><div className="third-party-toggle"><label><input type="checkbox" checked={includeAvulsos} onChange={event => setIncludeAvulsos(event.target.checked)} /> Mostrar clientes avulsos</label></div></Field><Field label="Cliente principal *"><select value={draft.clientId} onChange={event => setDraft(current => ({ ...current, clientId: event.target.value, relacionados: current.relacionados.filter(id => id !== event.target.value) }))}><option value="">Selecione</option>{clientChoices.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}{client.status === \'Inativo\' ? \' (Inativo)\' : client.relacionamento === \'Avulso\' ? \' (Avulso)\' : \'\'}</option>)}</select></Field><Field label="Modelo">',
    'process selector position',
  )

  replaceOnce(
    `${root}src/components/ObligationsReact.jsx`,
    '<div className="obligation-picker-tools"><input value={clientQuery} onChange={event => setClientQuery(event.target.value)} placeholder="Buscar cliente" /><button type="button" onClick={toggleVisibleClients}>{visiblePickerSelected ? \'Desmarcar visíveis\' : \'Selecionar visíveis\'}</button><label className="third-party-toggle"><input type="checkbox" checked={includeAvulsos} onChange={event => setIncludeAvulsos(event.target.checked)} /> Incluir clientes avulsos nesta obrigação</label></div>',
    '<label className="third-party-toggle"><input type="checkbox" checked={includeAvulsos} onChange={event => setIncludeAvulsos(event.target.checked)} /> Mostrar clientes avulsos</label><div className="obligation-picker-tools"><input value={clientQuery} onChange={event => setClientQuery(event.target.value)} placeholder="Buscar cliente" /><button type="button" onClick={toggleVisibleClients}>{visiblePickerSelected ? \'Desmarcar visíveis\' : \'Selecionar visíveis\'}</button></div>',
    'obligation selector position',
  )
}
