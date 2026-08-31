import { clientPartnerIds, partnerShares, responsibilityFor, sharedReceiver } from '../lib/sharedWork.js'

const partnerName = partner => partner?.nome || partner?.razao || 'Parceiro'
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function SharedClientFields({ editing, setField, office }) {
  if (editing?.perfilAtendimento !== 'Compartilhado') return null

  const partners = office.partners || []
  const selectedIds = clientPartnerIds(editing)
  const selectedSet = new Set(selectedIds)
  const partnerChoices = partners.filter(partner => partner.status !== 'Inativo' || selectedSet.has(String(partner.id)))
  const selectedPartners = selectedIds
    .map(id => partners.find(partner => String(partner.id) === id))
    .filter(Boolean)
  const shares = partnerShares(editing)
  const shareMap = new Map(shares.map(item => [String(item.parceiroId), Number(item.valor) || 0]))
  const departmentNames = [...new Set([
    ...(editing.departamentos || []).map(String),
    ...Object.keys(editing.responsabilidadesCompartilhadas || {}),
  ])]

  function togglePartner(id) {
    const key = String(id)
    const nextIds = selectedSet.has(key) ? selectedIds.filter(item => item !== key) : [...selectedIds, key]
    const nextShares = nextIds.map(partnerId => ({ parceiroId: partnerId, valor: shareMap.get(partnerId) || 0 }))
    const nextResponsibilities = structuredClone(editing.responsabilidadesCompartilhadas || {})
    Object.entries(nextResponsibilities).forEach(([department, rule]) => {
      if (String(rule?.parceiroId || '') === key && !nextIds.includes(key)) nextResponsibilities[department] = { responsavel: 'Escritorio', parceiroId: '' }
    })
    let receiver = sharedReceiver(editing, editing)
    if (receiver.startsWith('partner:') && !nextIds.includes(receiver.slice(8))) receiver = 'Escritorio'
    setField('parceiroIds', nextIds)
    setField('parceiroId', nextIds[0] || '')
    setField('compartilhadoPartesParceiros', nextShares)
    setField('compartilhadoParceiroParte', nextShares[0]?.valor || 0)
    setField('responsabilidadesCompartilhadas', nextResponsibilities)
    setField('compartilhadoRecebedor', receiver)
  }

  function setPartnerShare(id, value) {
    const key = String(id)
    const next = selectedIds.map(partnerId => ({ parceiroId: partnerId, valor: partnerId === key ? Math.max(0, Number(value) || 0) : (shareMap.get(partnerId) || 0) }))
    setField('compartilhadoPartesParceiros', next)
    setField('compartilhadoParceiroParte', next[0]?.valor || 0)
  }

  function setResponsibility(department, name, value) {
    const current = responsibilityFor(editing, department)
    const next = { ...current, [name]: value }
    if (name === 'responsavel' && value === 'Escritorio') next.parceiroId = ''
    if (name === 'responsavel' && value !== 'Escritorio' && !next.parceiroId) next.parceiroId = selectedIds[0] || ''
    setField('responsabilidadesCompartilhadas', {
      ...(editing.responsabilidadesCompartilhadas || {}),
      [department]: next,
    })
  }

  const monthly = Number(editing.mensalidade) || 0
  const mine = Number(editing.compartilhadoMinhaParte) || 0
  const partnerTotal = selectedIds.reduce((sum, id) => sum + (shareMap.get(id) || 0), 0)
  const difference = Math.round((monthly - mine - partnerTotal) * 100) / 100
  const receiver = sharedReceiver(editing, editing)

  return <>
    <label className="client-field full shared-client-box">
      <span>Parceiros envolvidos *</span>
      <div className="choice-list">
        {partnerChoices.map(partner => <label key={partner.id}><input type="checkbox" checked={selectedSet.has(String(partner.id))} onChange={() => togglePartner(partner.id)} /> {partnerName(partner)}{partner.status === 'Inativo' ? ' (inativo)' : ''}</label>)}
      </div>
      {!partnerChoices.length ? <small>Cadastre primeiro um parceiro no bloco “Parceiros de trabalho”.</small> : <small>Você pode vincular mais de um parceiro ao mesmo cliente.</small>}
    </label>

    {selectedIds.length && departmentNames.length ? <div className="client-field full shared-responsibility-box">
      <span>Responsabilidade por área</span>
      <div className="shared-responsibility-list">
        {departmentNames.map(department => {
          const rule = responsibilityFor(editing, department)
          return <div className="shared-responsibility-row" key={department}>
            <strong>{department}</strong>
            <select value={rule.responsavel} onChange={event => setResponsibility(department, 'responsavel', event.target.value)}>
              <option value="Escritorio">Meu escritório</option>
              <option value="Parceiro">Parceiro</option>
              <option value="Ambos">Ambos</option>
            </select>
            {rule.responsavel !== 'Escritorio' ? <select value={rule.parceiroId || selectedIds[0] || ''} onChange={event => setResponsibility(department, 'parceiroId', event.target.value)}>{selectedPartners.map(partner => <option key={partner.id} value={partner.id}>{partnerName(partner)}</option>)}</select> : <span className="shared-responsibility-office">Responsabilidade interna</span>}
          </div>
        })}
      </div>
      <small>Essa configuração será sugerida nas tarefas, processos e obrigações; cada trabalho poderá ser alterado individualmente.</small>
    </div> : null}

    {editing.relacionamento === 'Recorrente' && selectedIds.length ? <div className="client-field full shared-finance-default-box">
      <span>Padrão financeiro recorrente</span>
      <div className="shared-finance-default-grid">
        <label><span>Quem normalmente recebe</span><select value={receiver} onChange={event => setField('compartilhadoRecebedor', event.target.value)}><option value="Escritorio">Meu escritório</option>{selectedPartners.map(partner => <option key={partner.id} value={`partner:${partner.id}`}>{partnerName(partner)}</option>)}<option value="CadaUm">Cada um recebe sua parte</option></select></label>
        <label><span>Minha parte padrão</span><input type="number" min="0" step="0.01" value={editing.compartilhadoMinhaParte ?? ''} onChange={event => setField('compartilhadoMinhaParte', event.target.value)} /></label>
        {selectedPartners.map(partner => <label key={partner.id}><span>Parte de {partnerName(partner)}</span><input type="number" min="0" step="0.01" value={shareMap.get(String(partner.id)) ?? 0} onChange={event => setPartnerShare(partner.id, event.target.value)} /></label>)}
      </div>
      <div className={`shared-finance-check ${Math.abs(difference) > 0.009 ? 'invalid' : ''}`}><span>Mensalidade: <b>{money(monthly)}</b></span><span>Divisão: <b>{money(mine + partnerTotal)}</b></span><span>Diferença: <b>{money(difference)}</b></span></div>
      <small>Este é só o padrão. Cada competência mensal poderá ser alterada sem modificar os próximos meses.</small>
    </div> : null}
  </>
}
