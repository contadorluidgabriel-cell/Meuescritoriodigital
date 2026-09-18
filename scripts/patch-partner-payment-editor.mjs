import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, before, after, label, path) {
  if (source.includes(after)) return source
  if (!source.includes(before)) throw new Error(`Partner payment editor patch failed (${label}) in ${path}`)
  return source.replace(before, after)
}

export function applyPartnerPaymentEditorPatch(root) {
  const path = `${root}src/components/PaymentEditor.jsx`
  let source = readFileSync(path, 'utf8')
  source = replaceRequired(source,
    "import { paymentError, paymentSummary } from '../lib/financePro.js'",
    "import { paymentError, paymentSummary } from '../lib/financePro.js'\nimport { partnerAllocation } from '../lib/partnerAccounting.js'",
    'partner payment allocation import', path)
  source = replaceRequired(source,
    "export default function PaymentEditor({ charge, accounts = [], defaultAccountId = '', onClose, onSave, onRemove }) {",
    "export default function PaymentEditor({ charge, client = {}, accounts = [], defaultAccountId = '', onClose, onSave, onRemove }) {",
    'client for receiver detection', path)
  source = replaceRequired(source,
    "  const current = useMemo(() => paymentSummary(charge), [charge])\n  const [draft, setDraft]",
    "  const current = useMemo(() => paymentSummary(charge), [charge])\n  const receivedByPartner = partnerAllocation(charge, client).receiver.startsWith('partner:')\n  const [draft, setDraft]",
    'partner payment custody detection', path)
  source = replaceRequired(source,
    "      contaId: String(draft.contaId || ''),",
    "      contaId: receivedByPartner ? '' : String(draft.contaId || ''),",
    'never assign partner receipt to office account', path)
  source = replaceRequired(source,
    '      {current.balance > 0.009 ? <form className="finance-form payment-entry-form" onSubmit={submit}>',
    '      {receivedByPartner ? <p className="finance-field full">O parceiro é o recebedor desta cobrança. A baixa quita o débito do cliente, mas não constitui entrada no caixa do escritório. Registre o repasse recebido em Divisão, informando data e conta reais.</p> : null}\n      {current.balance > 0.009 ? <form className="finance-form payment-entry-form" onSubmit={submit}>',
    'partner receipt guidance', path)
  source = replaceRequired(source,
    '<label className="finance-field"><span>Conta de entrada</span><select value={draft.contaId} onChange={event => change(\'contaId\', event.target.value)}><option value="">Sem conta</option>{accounts.filter(item => item.ativo !== false).map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label>',
    '{!receivedByPartner ? <label className="finance-field"><span>Conta de entrada do escritório</span><select value={draft.contaId} onChange={event => change(\'contaId\', event.target.value)}><option value="">Sem conta</option>{accounts.filter(item => item.ativo !== false).map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label> : null}',
    'hide office bank selector for partner receipt', path)
  writeFileSync(path, source)

  const financePath = `${root}src/components/FinanceProReact.jsx`
  let finance = readFileSync(financePath, 'utf8')
  finance = replaceRequired(finance,
    '<PaymentEditor charge={paymentCharge} accounts={office.financeAccounts || []}',
    '<PaymentEditor charge={paymentCharge} client={clientsById.get(String(paymentCharge.clienteId)) || {}} accounts={office.financeAccounts || []}',
    'client passed to payment modal', financePath)
  finance = replaceRequired(finance,
    '<article><small>Recebido</small><strong>{money(metrics.received)}</strong>',
    '<article><small>Quitado pelo cliente</small><strong>{money(metrics.received)}</strong>',
    'customer settlement versus office bank terminology', financePath)
  writeFileSync(financePath, finance)
}
