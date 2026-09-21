import './follow-up-linked.css'

const formatDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—'

export default function FollowUpLinked({ records = [], clientId = '', sourceType = '', sourceId = '', onOpen }) {
  const linked = records.filter(record => sourceId ? record.sourceType === sourceType && String(record.sourceId) === String(sourceId) : clientId && String(record.clientId) === String(clientId))
  if (!linked.length) return null
  const sorted = [...linked].sort((a,b) => Number(b.status === 'active') - Number(a.status === 'active') || String(a.checkDate).localeCompare(String(b.checkDate)))
  return <section className="follow-linked" aria-label="Acompanhamentos vinculados"><header><strong>Acompanhamentos</strong><small>{sorted.filter(record => record.status === 'active').length} ativo(s) · {sorted.filter(record => record.status === 'confirmed').length} encerrado(s)</small></header><div>{sorted.map(record => <button type="button" key={record.id} onClick={() => onOpen?.(record.id)}><span><b>{record.title}</b><small>{record.status === 'active' ? `Conferir em ${formatDate(record.checkDate)}` : 'Resultado confirmado'}</small></span><span aria-hidden="true">›</span></button>)}</div></section>
}
