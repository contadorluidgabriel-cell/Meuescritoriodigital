import { today } from './storage.js'

const normalized = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const settled = status => normalized(status) === 'concluida' || normalized(status) === 'nao se aplica'

export function completeObligationLink(obligations = [], obligationId = '', clientId = '', completedAt = today()) {
  const targetObligationId = String(obligationId || '')
  const targetClientId = String(clientId || '')
  if (!targetObligationId || !targetClientId) return { changed: false, obligations, error: 'CNPJ pendente não identificado.' }

  let changed = false
  let completedLink = null
  const next = (Array.isArray(obligations) ? obligations : []).map(obligation => {
    if (String(obligation?.id || '') !== targetObligationId) return obligation
    const links = (Array.isArray(obligation.clientes) ? obligation.clientes : []).map(link => {
      if (changed || String(link?.clienteId || '') !== targetClientId || settled(link?.status)) return link
      changed = true
      completedLink = { ...link, status: 'Concluída', concluidoEm: completedAt || today() }
      return completedLink
    })
    return changed ? { ...obligation, clientes: links } : obligation
  })

  if (!changed) return { changed: false, obligations, error: 'Este CNPJ já foi concluído ou não está mais pendente.' }
  return { changed: true, obligations: next, link: completedLink }
}
