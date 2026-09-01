import { readFileSync, writeFileSync } from 'node:fs'

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Finance complete patch failed (${label})`)
  return source.replace(from, to)
}

export function applyFinanceCompletePatch(root) {
  const libPath = `${root}src/lib/financePro.js`
  let lib = readFileSync(libPath, 'utf8')
  if (!lib.includes("contaId: String(payment.contaId || '')")) {
    lib = replaceOrFail(
      lib,
      "    acrescimo: money(payment.acrescimo),\n    observacao: String(payment.observacao || '').trim(),",
      "    acrescimo: money(payment.acrescimo),\n    contaId: String(payment.contaId || ''),\n    formaPagamento: String(payment.formaPagamento || ''),\n    observacao: String(payment.observacao || '').trim(),",
      'preserve receipt account',
    )
    writeFileSync(libPath, lib)
  }

  const paymentPath = `${root}src/components/PaymentEditor.jsx`
  let payment = readFileSync(paymentPath, 'utf8')
  if (!payment.includes('accounts = [], defaultAccountId')) {
    payment = replaceOrFail(
      payment,
      "export default function PaymentEditor({ charge, onClose, onSave, onRemove }) {",
      "export default function PaymentEditor({ charge, accounts = [], defaultAccountId = '', onClose, onSave, onRemove }) {",
      'payment props',
    )
    payment = replaceOrFail(
      payment,
      "  const [draft, setDraft] = useState({ data: today(), valorRecebido: current.balance, desconto: 0, acrescimo: 0, observacao: '' })",
      "  const [draft, setDraft] = useState({ data: today(), valorRecebido: current.balance, desconto: 0, acrescimo: 0, contaId: defaultAccountId || accounts[0]?.id || '', formaPagamento: 'Pix', observacao: '' })",
      'payment state',
    )
    payment = replaceOrFail(
      payment,
      "      acrescimo: Number(draft.acrescimo) || 0,\n      observacao: String(draft.observacao || '').trim(),",
      "      acrescimo: Number(draft.acrescimo) || 0,\n      contaId: String(draft.contaId || ''),\n      formaPagamento: String(draft.formaPagamento || ''),\n      observacao: String(draft.observacao || '').trim(),",
      'payment payload',
    )
    payment = replaceOrFail(
      payment,
      "        <label className=\"finance-field full\"><span>Observação</span><input value={draft.observacao} onChange={event => change('observacao', event.target.value)} placeholder=\"Ex.: pagamento parcial via Pix\" /></label>",
      "        <label className=\"finance-field\"><span>Conta de entrada</span><select value={draft.contaId} onChange={event => change('contaId', event.target.value)}><option value=\"\">Sem conta</option>{accounts.filter(item => item.ativo !== false).map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label>\n        <label className=\"finance-field\"><span>Forma de recebimento</span><select value={draft.formaPagamento} onChange={event => change('formaPagamento', event.target.value)}><option>Pix</option><option>Transferência</option><option>Boleto</option><option>Cartão</option><option>Dinheiro</option><option>Outro</option></select></label>\n        <label className=\"finance-field full\"><span>Observação</span><input value={draft.observacao} onChange={event => change('observacao', event.target.value)} placeholder=\"Ex.: pagamento parcial via Pix\" /></label>",
      'payment account fields',
    )
    payment = replaceOrFail(
      payment,
      "<small>{payment.desconto ? `Desconto ${money(payment.desconto)} · ` : ''}{payment.acrescimo ? `Acréscimo ${money(payment.acrescimo)} · ` : ''}{payment.observacao || (payment.legacy ? 'Recebimento legado' : 'Sem observação')}</small>",
      "<small>{payment.desconto ? `Desconto ${money(payment.desconto)} · ` : ''}{payment.acrescimo ? `Acréscimo ${money(payment.acrescimo)} · ` : ''}{accounts.find(account => String(account.id) === String(payment.contaId))?.nome ? `${accounts.find(account => String(account.id) === String(payment.contaId))?.nome} · ` : ''}{payment.formaPagamento ? `${payment.formaPagamento} · ` : ''}{payment.observacao || (payment.legacy ? 'Recebimento legado' : 'Sem observação')}</small>",
      'payment history account',
    )
    writeFileSync(paymentPath, payment)
  }

  const financePath = `${root}src/components/FinanceProReact.jsx`
  let finance = readFileSync(financePath, 'utf8')
  if (!finance.includes("categoriaId: 'rec-servicos'")) {
    finance = replaceOrFail(
      finance,
      "    clienteId: defaultClient ? String(defaultClient.id) : '',\n    descricao: '', valor: '', vencimento: today(), competencia: competence || currentCompetence(), sourceRef: '', parcelas: 1,",
      "    clienteId: defaultClient ? String(defaultClient.id) : '',\n    descricao: '', categoriaId: 'rec-servicos', valor: '', vencimento: today(), competencia: competence || currentCompetence(), sourceRef: '', parcelas: 1,",
      'charge category state',
    )
    finance = replaceOrFail(
      finance,
      "  const selectedClient = clients.find(item => String(item.id) === String(draft.clienteId)) || null",
      "  const selectedClient = clients.find(item => String(item.id) === String(draft.clienteId)) || null\n  const incomeCategories = (office.financeCategories || []).filter(item => item.tipo === 'receita' && item.ativo !== false)",
      'income categories',
    )
    finance = replaceOrFail(
      finance,
      "      competencia: draft.competencia || draft.vencimento.slice(0, 7), vencimento: draft.vencimento, valor: value,\n      status: 'Pendente'",
      "      competencia: draft.competencia || draft.vencimento.slice(0, 7), vencimento: draft.vencimento, valor: value, categoriaId: draft.categoriaId || 'rec-servicos',\n      status: 'Pendente'",
      'charge category save',
    )
    finance = replaceOrFail(
      finance,
      "    <Field label=\"Descrição *\" full><input value={draft.descricao} onChange={event => setField('descricao', event.target.value)} placeholder=\"Ex.: Alteração contratual\" /></Field>\n    {sourceChoices.length ?",
      "    <Field label=\"Descrição *\" full><input value={draft.descricao} onChange={event => setField('descricao', event.target.value)} placeholder=\"Ex.: Alteração contratual\" /></Field>\n    {incomeCategories.length ? <Field label=\"Categoria\"><select value={draft.categoriaId} onChange={event => setField('categoriaId', event.target.value)}>{incomeCategories.map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></Field> : null}\n    {sourceChoices.length ?",
      'charge category field',
    )
  }
  if (!finance.includes('accounts={office.financeAccounts || []}')) {
    finance = replaceOrFail(
      finance,
      "<PaymentEditor charge={paymentCharge} onClose={() => setPaymentChargeId('')} onSave={registerPayment} onRemove={removePayment} />",
      "<PaymentEditor charge={paymentCharge} accounts={office.financeAccounts || []} defaultAccountId={office.financeConfig?.defaultAccountId || ''} onClose={() => setPaymentChargeId('')} onSave={registerPayment} onRemove={removePayment} />",
      'payment editor accounts',
    )
  }
  writeFileSync(financePath, finance)
}
