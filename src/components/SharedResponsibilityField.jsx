import { clientPartnerIds } from '../lib/sharedWork.js'
import { workResponsibilityFields } from '../lib/sharedResponsibility.js'

const partnerName = partner => partner?.nome || partner?.razao || 'Parceiro'

export default function SharedResponsibilityField({ record, setRecord, client, office, department = '' }) {
  if (client?.perfilAtendimento !== 'Compartilhado') return null
  const partnerIds = clientPartnerIds(client)
  const partners = partnerIds.map(id => (office.partners || []).find(partner => String(partner.id) === id)).filter(Boolean)
  const fields = workResponsibilityFields(record, client, department)

  function patch(next) {
    setRecord(current => ({ ...current, ...next }))
  }

  return <div className="shared-work-responsibility">
    <span>Responsabilidade do compartilhamento</span>
    <div>
      <select value={fields.compartilhadoResponsavel || 'Escritorio'} onChange={event => {
        const value = event.target.value
        patch({
          compartilhadoResponsavel: value,
          compartilhadoParceiroId: value === 'Escritorio' ? '' : (fields.compartilhadoParceiroId || partnerIds[0] || ''),
        })
      }}>
        <option value="Escritorio">Meu escritório</option>
        <option value="Parceiro">Parceiro</option>
        <option value="Ambos">Ambos</option>
      </select>
      {fields.compartilhadoResponsavel !== 'Escritorio' ? <select value={fields.compartilhadoParceiroId || partnerIds[0] || ''} onChange={event => patch({ compartilhadoParceiroId: event.target.value })}>{partners.map(partner => <option value={partner.id} key={partner.id}>{partnerName(partner)}{partner.status === 'Inativo' ? ' (inativo)' : ''}</option>)}</select> : null}
    </div>
    <small>O cadastro do cliente é apenas o padrão. Esta escolha vale somente para este trabalho.</small>
  </div>
}

export function SharedResponsibilityBadge({ record, client, office, department = '' }) {
  if (client?.perfilAtendimento !== 'Compartilhado') return null
  const partnersById = new Map((office.partners || []).map(partner => [String(partner.id), partner]))
  const fields = workResponsibilityFields(record, client, department)
  if (fields.compartilhadoResponsavel === 'Escritorio') return <small>Compartilhado · Meu escritório</small>
  const partner = partnersById.get(String(fields.compartilhadoParceiroId))
  const name = partnerName(partner)
  return <small>Compartilhado · {fields.compartilhadoResponsavel === 'Ambos' ? `Ambos · ${name}` : name}</small>
}
