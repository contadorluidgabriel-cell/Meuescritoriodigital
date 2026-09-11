export function canonicalEntityType(value) {
  return value === 'linkedCompany' ? 'linkedCompany' : 'client'
}

export function entityDisplayName(entity, fallback = 'Empresa') {
  return entity?.razao || entity?.nome || entity?.fantasia || fallback
}

export function entityDocument(entity) {
  return entity?.documento || entity?.cnpj || ''
}

export function obligationLinkEntityType(link = {}, clientsById, linkedCompaniesById) {
  const id = String(link?.clienteId || '')
  if (link?.entityType === 'linkedCompany' || link?.entidadeTipo === 'terceirizado') return 'linkedCompany'
  if (clientsById instanceof Map && linkedCompaniesById instanceof Map && !clientsById.has(id) && linkedCompaniesById.has(id)) return 'linkedCompany'
  return 'client'
}

export function entityKey(entityType, id) {
  return `${canonicalEntityType(entityType)}|${String(id || '')}`
}

export function splitEntityKey(key) {
  const [entityType, ...parts] = String(key || '').split('|')
  return { entityType: canonicalEntityType(entityType), entityId: parts.join('|') }
}
