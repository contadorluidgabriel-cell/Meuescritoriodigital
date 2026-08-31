import { readFileSync, writeFileSync } from 'node:fs'

export function applyFinanceEditingPatch(root) {
  const path = `${root}src/components/FinanceProReact.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes("FeeAdjustmentModal } from './FinanceEditModals.jsx'")) return

  const replacements = [
    [
      "import PaymentEditor from './PaymentEditor.jsx'",
      "import PaymentEditor from './PaymentEditor.jsx'\nimport { ChargeEditModal, FeeAdjustmentModal } from './FinanceEditModals.jsx'",
      'modal imports',
    ],
    [
      "  const [creating, setCreating] = useState(false), [notice, setNotice] = useState(''), [editingShared, setEditingShared] = useState(''), [paymentChargeId, setPaymentChargeId] = useState('')",
      "  const [creating, setCreating] = useState(false), [notice, setNotice] = useState(''), [editingShared, setEditingShared] = useState(''), [paymentChargeId, setPaymentChargeId] = useState(''), [editingChargeId, setEditingChargeId] = useState(''), [adjustingFeeClientId, setAdjustingFeeClientId] = useState('')",
      'editing state',
    ],
    [
      "  const paymentCharge = useMemo(() => finance.find(charge => String(charge.id) === String(paymentChargeId)) || null, [finance, paymentChargeId])",
      "  const paymentCharge = useMemo(() => finance.find(charge => String(charge.id) === String(paymentChargeId)) || null, [finance, paymentChargeId])\n  const editingCharge = useMemo(() => finance.find(charge => String(charge.id) === String(editingChargeId)) || null, [editingChargeId, finance])\n  const adjustingFeeClient = useMemo(() => clients.find(client => String(client.id) === String(adjustingFeeClientId)) || null, [adjustingFeeClientId, clients])",
      'selected editing records',
    ],
    [
      "{shared ? <button type=\"button\" onClick={() => setEditingShared(String(charge.id))}>Divisão</button> : null}<button type=\"button\" className=\"danger\" onClick={() => deleteCharge(charge.id)} aria-label={`Excluir cobrança ${charge.descricao}`}>×</button>",
      "<button type=\"button\" onClick={() => setEditingChargeId(String(charge.id))}>Editar</button>{charge.origem === 'recorrente' && client?.relacionamento === 'Recorrente' ? <button type=\"button\" onClick={() => setAdjustingFeeClientId(String(charge.clienteId))}>Reajustar honorário</button> : null}{shared ? <button type=\"button\" onClick={() => setEditingShared(String(charge.id))}>Divisão</button> : null}<button type=\"button\" className=\"danger\" onClick={() => deleteCharge(charge.id)} aria-label={`Excluir cobrança ${charge.descricao}`}>×</button>",
      'row edit actions',
    ],
    [
      "    {paymentCharge ? <PaymentEditor charge={paymentCharge} onClose={() => setPaymentChargeId('')} onSave={registerPayment} onRemove={removePayment} /> : null}",
      "    {paymentCharge ? <PaymentEditor charge={paymentCharge} onClose={() => setPaymentChargeId('')} onSave={registerPayment} onRemove={removePayment} /> : null}\n    {editingCharge ? <ChargeEditModal charge={editingCharge} finance={finance} day={day} onClose={() => setEditingChargeId('')} onSave={({ finance: nextFinance, count }) => { update(draft => { draft.finance = nextFinance }); setEditingChargeId(''); setNotice(count > 1 ? `${count} parcelas corrigidas. Baixas e histórico foram preservados.` : 'Cobrança corrigida. Baixas e histórico foram preservados.') }} /> : null}\n    {adjustingFeeClient ? <FeeAdjustmentModal client={adjustingFeeClient} finance={finance} day={day} competence={competence || currentCompetence()} onClose={() => setAdjustingFeeClientId('')} onSave={({ client: nextClient, finance: nextFinance, updated, blocked, competence: adjustedCompetence }) => { update(draft => { draft.clients = (draft.clients || []).map(item => String(item.id) === String(nextClient.id) ? nextClient : item); draft.finance = nextFinance }); setAdjustingFeeClientId(''); setNotice(blocked ? `Honorário reajustado a partir de ${adjustedCompetence}. A cobrança já gerada não foi alterada porque possui baixa ou está cancelada.` : updated ? `Honorário reajustado a partir de ${adjustedCompetence} e cobrança da competência atualizada.` : `Honorário reajustado a partir de ${adjustedCompetence}.`) }} /> : null}",
      'edit modals render',
    ],
  ]

  for (const [from, to, label] of replacements) {
    if (!source.includes(from)) throw new Error(`Finance editing patch failed (${label}) in ${path}`)
    source = source.replace(from, to)
  }
  writeFileSync(path, source)
}
