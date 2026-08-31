import { clientPartnerIds, responsibilityFor } from './sharedWork.js'

export function workResponsibilityFields(record = {}, client = {}, department = '') {
  if (client?.perfilAtendimento !== 'Compartilhado') return { compartilhadoResponsavel: '', compartilhadoParceiroId: '' }
  const ids = clientPartnerIds(client)
  const fallback = responsibilityFor(client, department || record.departamento || record.categoria || '')
  const responsavel = ['Escritorio', 'Parceiro', 'Ambos'].includes(record.compartilhadoResponsavel)
    ? record.compartilhadoResponsavel
    : fallback.responsavel
  let parceiroId = String(record.compartilhadoParceiroId || fallback.parceiroId || ids[0] || '')
  if (!ids.includes(parceiroId)) parceiroId = ids[0] || ''
  return {
    compartilhadoResponsavel: responsavel,
    compartilhadoParceiroId: responsavel === 'Escritorio' ? '' : parceiroId,
  }
}

export function workResponsibilityLabel(record = {}, client = {}, partnersById = new Map(), department = '') {
  if (client?.perfilAtendimento !== 'Compartilhado') return ''
  const fields = workResponsibilityFields(record, client, department)
  if (fields.compartilhadoResponsavel === 'Escritorio') return 'Meu escritório'
  const partner = partnersById.get(String(fields.compartilhadoParceiroId))
  const name = partner?.nome || partner?.razao || 'Parceiro'
  return fields.compartilhadoResponsavel === 'Ambos' ? `Ambos · ${name}` : name
}
