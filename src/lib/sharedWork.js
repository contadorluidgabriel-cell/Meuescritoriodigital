const moneyNumber = value => Math.max(0, Number(value) || 0)
const unique = values => [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]

export const RECEIVER_OFFICE = 'Escritorio'
export const RECEIVER_EACH = 'CadaUm'
export const SETTLEMENT_PENDING = 'Pendente'
export const SETTLEMENT_DONE = 'Liquidado'

export function clientPartnerIds(client = {}) {
  const explicit = Array.isArray(client.parceiroIds) ? client.parceiroIds : []
  return unique([...explicit, client.parceiroId])
}

export function partnerShares(record = {}, fallback = {}) {
  const source = Array.isArray(record.compartilhadoPartesParceiros) && record.compartilhadoPartesParceiros.length
    ? record.compartilhadoPartesParceiros
    : Array.isArray(fallback.compartilhadoPartesParceiros) && fallback.compartilhadoPartesParceiros.length
      ? fallback.compartilhadoPartesParceiros
      : []

  if (source.length) {
    const seen = new Set()
    return source
      .map(item => ({ parceiroId: String(item?.parceiroId || ''), valor: moneyNumber(item?.valor) }))
      .filter(item => item.parceiroId && !seen.has(item.parceiroId) && seen.add(item.parceiroId))
  }

  const legacyPartnerId = String(record.parceiroId || fallback.parceiroId || clientPartnerIds(fallback)[0] || '')
  const legacyValue = moneyNumber(record.compartilhadoParceiroParte ?? fallback.compartilhadoParceiroParte)
  return legacyPartnerId ? [{ parceiroId: legacyPartnerId, valor: legacyValue }] : []
}

export function sharedReceiver(record = {}, fallback = {}) {
  const partnerIds = unique([
    ...clientPartnerIds(record),
    ...clientPartnerIds(fallback),
    ...partnerShares(record, fallback).map(item => item.parceiroId),
  ])
  let receiver = String(record.compartilhadoRecebedor || fallback.compartilhadoRecebedor || RECEIVER_OFFICE)
  if (receiver === 'Parceiro') receiver = partnerIds[0] ? `partner:${partnerIds[0]}` : RECEIVER_OFFICE
  if (receiver === RECEIVER_OFFICE || receiver === RECEIVER_EACH) return receiver
  if (receiver.startsWith('partner:')) {
    const id = receiver.slice(8)
    return id ? `partner:${id}` : RECEIVER_OFFICE
  }
  return RECEIVER_OFFICE
}

export function sharedSplit(record = {}, fallback = {}) {
  const total = moneyNumber(record.valor ?? record.mensalidade ?? fallback.valor ?? fallback.mensalidade)
  const mine = moneyNumber(record.compartilhadoMinhaParte ?? fallback.compartilhadoMinhaParte)
  const shares = partnerShares(record, fallback)
  const partnerTotal = shares.reduce((sum, item) => sum + moneyNumber(item.valor), 0)
  const splitTotal = mine + partnerTotal
  return { total, mine, shares, partnerTotal, splitTotal, difference: Math.round((total - splitTotal) * 100) / 100 }
}

export function normalizedSharedClientFields(client = {}) {
  const partnerIds = clientPartnerIds(client)
  const monthly = moneyNumber(client.mensalidade)
  let mine = moneyNumber(client.compartilhadoMinhaParte)
  let shares = partnerShares(client)
    .filter(item => partnerIds.includes(item.parceiroId))
  const known = new Set(shares.map(item => item.parceiroId))
  partnerIds.forEach(id => { if (!known.has(id)) shares.push({ parceiroId: id, valor: 0 }) })

  if (client.perfilAtendimento === 'Compartilhado' && client.relacionamento === 'Recorrente' && monthly > 0 && mine === 0 && shares.every(item => item.valor === 0)) {
    mine = monthly
  }

  const receiver = sharedReceiver({ ...client, parceiroIds, compartilhadoPartesParceiros: shares }, client)
  const responsibilities = {}
  const rawResponsibilities = client.responsabilidadesCompartilhadas && typeof client.responsabilidadesCompartilhadas === 'object'
    ? client.responsabilidadesCompartilhadas
    : {}
  Object.entries(rawResponsibilities).forEach(([department, value]) => {
    const item = typeof value === 'string' ? { responsavel: value, parceiroId: '' } : (value || {})
    const responsavel = ['Escritorio', 'Parceiro', 'Ambos'].includes(item.responsavel) ? item.responsavel : 'Escritorio'
    const parceiroId = partnerIds.includes(String(item.parceiroId || '')) ? String(item.parceiroId) : (partnerIds[0] || '')
    responsibilities[department] = { responsavel, parceiroId: responsavel === 'Escritorio' ? '' : parceiroId }
  })

  return {
    parceiroIds,
    parceiroId: partnerIds[0] || '',
    compartilhadoRecebedor: receiver,
    compartilhadoMinhaParte: mine,
    compartilhadoPartesParceiros: shares,
    compartilhadoParceiroParte: shares[0]?.valor || 0,
    responsabilidadesCompartilhadas: responsibilities,
  }
}

export function sharedClientError(client = {}, office = {}) {
  if (client.perfilAtendimento !== 'Compartilhado') return ''
  const fields = normalizedSharedClientFields(client)
  if (!fields.parceiroIds.length) return 'Selecione pelo menos um parceiro para o cliente compartilhado.'
  const knownPartnerIds = new Set((office.partners || []).map(item => String(item.id)))
  if (fields.parceiroIds.some(id => !knownPartnerIds.has(id))) return 'Um dos parceiros selecionados não existe mais na base.'

  if (client.relacionamento !== 'Recorrente') return ''
  const monthly = moneyNumber(client.mensalidade)
  const split = sharedSplit({
    mensalidade: monthly,
    compartilhadoMinhaParte: fields.compartilhadoMinhaParte,
    compartilhadoPartesParceiros: fields.compartilhadoPartesParceiros,
  })
  if (monthly > 0 && Math.abs(split.difference) > 0.009) return 'No padrão financeiro, sua parte + partes dos parceiros deve ser igual à mensalidade.'
  const receiver = fields.compartilhadoRecebedor
  if (receiver.startsWith('partner:') && !fields.parceiroIds.includes(receiver.slice(8))) return 'O parceiro que recebe precisa estar vinculado ao cliente.'
  return ''
}

export function responsibilityFor(client = {}, department = '') {
  if (client.perfilAtendimento !== 'Compartilhado') return { responsavel: 'Escritorio', parceiroId: '' }
  const ids = clientPartnerIds(client)
  const value = client.responsabilidadesCompartilhadas?.[department]
  if (!value) return { responsavel: 'Escritorio', parceiroId: '' }
  const item = typeof value === 'string' ? { responsavel: value, parceiroId: '' } : value
  const responsavel = ['Escritorio', 'Parceiro', 'Ambos'].includes(item?.responsavel) ? item.responsavel : 'Escritorio'
  const parceiroId = ids.includes(String(item?.parceiroId || '')) ? String(item.parceiroId) : (ids[0] || '')
  return { responsavel, parceiroId: responsavel === 'Escritorio' ? '' : parceiroId }
}

export function responsibilityLabel({ responsavel = 'Escritorio', parceiroId = '' } = {}, partnersById = new Map()) {
  if (responsavel === 'Escritorio') return 'Meu escritório'
  const partner = partnersById.get(String(parceiroId))
  const name = partner?.nome || partner?.razao || 'Parceiro'
  return responsavel === 'Ambos' ? `Ambos · ${name}` : name
}

export function normalizeSharedCharge(charge = {}, client = {}) {
  const clientFields = normalizedSharedClientFields(client)
  const ids = unique([
    ...(Array.isArray(charge.parceiroIds) ? charge.parceiroIds : []),
    charge.parceiroId,
    ...clientFields.parceiroIds,
  ])
  let shares = partnerShares(charge, { ...client, ...clientFields })
  const known = new Set(shares.map(item => item.parceiroId))
  ids.forEach(id => { if (!known.has(id)) shares.push({ parceiroId: id, valor: 0 }) })
  const receiver = sharedReceiver({ ...charge, parceiroIds: ids, compartilhadoPartesParceiros: shares }, { ...client, ...clientFields })
  return {
    ...charge,
    compartilhado: true,
    parceiroIds: ids,
    parceiroId: ids[0] || '',
    compartilhadoRecebedor: receiver,
    compartilhadoMinhaParte: moneyNumber(charge.compartilhadoMinhaParte ?? clientFields.compartilhadoMinhaParte),
    compartilhadoPartesParceiros: shares,
    compartilhadoParceiroParte: shares[0]?.valor || 0,
    compartilhadoAcertoStatus: charge.compartilhadoAcertoStatus || SETTLEMENT_PENDING,
    compartilhadoAcertoEm: charge.compartilhadoAcertoEm || '',
    compartilhadoObservacao: charge.compartilhadoObservacao || '',
    compartilhadoPersonalizado: Boolean(charge.compartilhadoPersonalizado),
  }
}

export function sharedChargeError(charge = {}, client = {}) {
  if (!charge.compartilhado && client.perfilAtendimento !== 'Compartilhado') return ''
  const normalized = normalizeSharedCharge(charge, client)
  const split = sharedSplit(normalized)
  if (split.total <= 0) return 'Informe um valor maior que zero.'
  if (Math.abs(split.difference) > 0.009) return 'Sua parte + partes dos parceiros deve ser igual ao valor total.'
  if (normalized.compartilhadoRecebedor.startsWith('partner:') && !normalized.parceiroIds.includes(normalized.compartilhadoRecebedor.slice(8))) return 'Quem recebeu precisa ser um parceiro vinculado.'
  return ''
}

export function settlementEntries(charge = {}, client = {}) {
  if (!charge.compartilhado && client.perfilAtendimento !== 'Compartilhado') return []
  const normalized = normalizeSharedCharge(charge, client)
  if (normalized.compartilhadoAcertoStatus === SETTLEMENT_DONE) return []
  const split = sharedSplit(normalized)
  const receiver = normalized.compartilhadoRecebedor
  if (receiver === RECEIVER_EACH) return []
  if (receiver === RECEIVER_OFFICE) {
    return split.shares
      .filter(item => item.valor > 0)
      .map(item => ({ parceiroId: item.parceiroId, tipo: 'aPagar', valor: item.valor, chargeId: normalized.id }))
  }
  if (receiver.startsWith('partner:') && split.mine > 0) {
    return [{ parceiroId: receiver.slice(8), tipo: 'aReceber', valor: split.mine, chargeId: normalized.id }]
  }
  return []
}

export function partnerBalance(finance = [], clients = [], partnerId = '') {
  const id = String(partnerId || '')
  const clientsById = new Map((clients || []).map(client => [String(client.id), client]))
  return (finance || []).reduce((result, charge) => {
    const client = clientsById.get(String(charge.clienteId)) || {}
    settlementEntries(charge, client).forEach(entry => {
      if (entry.parceiroId !== id) return
      result[entry.tipo] += moneyNumber(entry.valor)
    })
    return result
  }, { aPagar: 0, aReceber: 0 })
}

export function allPartnerBalances(finance = [], clients = [], partners = []) {
  return (partners || []).map(partner => {
    const balance = partnerBalance(finance, clients, partner.id)
    return { ...partner, ...balance, saldo: Math.round((balance.aReceber - balance.aPagar) * 100) / 100 }
  })
}
