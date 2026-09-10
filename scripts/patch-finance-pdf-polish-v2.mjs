import { readFileSync, writeFileSync } from 'node:fs'

const MARKER = '// FINANCE_PDF_POLISH_V2'

function replaceSection(source, start, end, replacement, label, path) {
  const from = source.indexOf(start)
  if (from < 0) throw new Error(`Finance PDF polish failed (${label}: start) in ${path}`)
  const to = source.indexOf(end, from)
  if (to < 0) throw new Error(`Finance PDF polish failed (${label}: end) in ${path}`)
  return source.slice(0, from) + replacement.trim() + '\n\n' + source.slice(to)
}

export function applyFinancePdfPolishV2(root) {
  const path = `${root}src/lib/financePdf.js`
  let source = readFileSync(path, 'utf8')
  if (source.includes(MARKER)) return

  source = source.replace(
    "import { paymentSummary } from './financePro.js'",
    "import { paymentSummary } from './financePro.js'\n\n" + MARKER,
  )

  source = replaceSection(
    source,
    'function clientAndSummary({ client, charge, summary, receipt }) {',
    'function normalizeItems(charge, summary) {',
    `function clientAndSummary({ client, charge, summary, receipt }) {
  const document = clientDocument(client)
  const address = clientAddress(client)
  const contact = client?.email || client?.telefone || client?.phone || ''
  const settled = summary.balance <= 0.009
  const now = new Date()
  const todayIso = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  const rawStatus = String(charge.status || '').toLowerCase()
  const overdueByStatus = rawStatus.includes('atras') || rawStatus.includes('venc')
  const overdueByDate = !receipt && !settled && Boolean(charge.vencimento) && String(charge.vencimento) < todayIso
  const overdue = overdueByStatus || overdueByDate
  const status = receipt || settled ? 'Recebido' : overdue ? 'Vencida' : (charge.status || 'Pendente')
  const style = statusStyle(status)
  const statusWidth = Math.min(110, Math.max(66, textWidth(status, 8.2, true) + 26))

  let content = textCommand({ x: 34, y: 704, text: receipt ? 'RECEBIDO DE' : 'COBRANÇA PARA', size: 7.2, bold: true, color: COLORS.blue, tracking: 0.8 })
  content += textCommand({ x: 34, y: 679, text: clientName(client), size: 15.2, bold: true, color: COLORS.ink })
  let y = 658
  if (document) { content += textCommand({ x: 34, y, text: documentLabel(document) + ' ' + document, size: 8.6, color: COLORS.muted }); y -= 17 }
  if (address) { content += textCommand({ x: 34, y, text: safeText(address).slice(0, 56), size: 8.6, color: COLORS.muted }); y -= 17 }
  if (contact) content += textCommand({ x: 34, y, text: safeText(contact).slice(0, 56), size: 8.6, color: COLORS.muted })

  content += lineCommand({ x1: 301, y1: 610, x2: 301, y2: 708, color: COLORS.line, lineWidth: 0.7 })
  content += textCommand({ x: 334, y: 704, text: receipt ? 'RESUMO DO RECIBO' : 'RESUMO DA FATURA', size: 7.2, bold: true, color: COLORS.blue, tracking: 0.8 })

  content += textCommand({ x: 334, y: 674, text: 'VENCIMENTO', size: 6.4, bold: true, color: COLORS.muted, tracking: 0.35 })
  content += textCommand({ x: 538, y: 656, text: dateBr(charge.vencimento), size: 12.1, bold: true, color: overdue ? COLORS.danger : COLORS.ink, right: true })

  content += textCommand({ x: 334, y: 635, text: 'STATUS', size: 6.4, bold: true, color: COLORS.muted, tracking: 0.35 })
  content += roundedRectCommand({ x: 544 - statusWidth, y: 621, width: statusWidth, height: 21, radius: 5, fill: style.fill })
  content += circleCommand({ cx: 555 - statusWidth, cy: 631.5, r: 2.6, fill: style.text })
  content += textCommand({ x: 566 - statusWidth, y: 627.5, text: status, size: 8.2, bold: true, color: style.text })

  content += textCommand({ x: 334, y: 603, text: 'COMPETÊNCIA', size: 6.4, bold: true, color: COLORS.muted, tracking: 0.35 })
  content += textCommand({ x: 538, y: 600, text: competenceBr(charge.competencia), size: 10.2, bold: true, color: COLORS.ink, right: true })
  content += lineCommand({ x1: 34, y1: 584, x2: 544, y2: 584, color: COLORS.line, lineWidth: 0.7 })
  return content
}`,
    'client summary',
    path,
  )

  source = replaceSection(
    source,
    'function normalizeItems(charge, summary) {',
    'function totalsBlock({ summary, receipt }) {',
    `function normalizeItems(charge, summary) {
  if (Array.isArray(charge.items) && charge.items.length) {
    const items = charge.items.map(item => ({
      description: item.descricao || item.description || 'Serviço',
      quantity: Math.max(1, Number(item.quantidade ?? item.quantity ?? 1) || 1),
      value: Number(item.valor ?? item.value ?? 0) || 0,
    }))
    if (items.length <= 3) return items
    const firstItems = items.slice(0, 2)
    const remaining = items.slice(2)
    const remainingValue = remaining.reduce((sum, item) => sum + (item.value * item.quantity), 0)
    return [
      ...firstItems,
      { description: 'Outros serviços (' + remaining.length + ' itens)', quantity: 1, value: remainingValue },
    ]
  }
  let description = charge.descricao || 'Honorários contábeis'
  if (charge.competencia && /honor[aá]rios/i.test(description) && !description.includes(competenceBr(charge.competencia))) {
    description = description + ' - Competência ' + competenceBr(charge.competencia)
  }
  return [{ description, quantity: 1, value: summary.total }]
}

function servicesTable({ charge, summary }) {
  const items = normalizeItems(charge, summary)
  let content = textCommand({ x: 34, y: 554, text: 'SERVIÇOS', size: 10.4, bold: true, color: COLORS.blue, tracking: 1.05 })
  content += roundedRectCommand({ x: 34, y: 507, width: 510, height: 31, radius: 3, fill: COLORS.table })
  content += textCommand({ x: 48, y: 519, text: 'DESCRIÇÃO', size: 7.2, bold: true, color: COLORS.muted, tracking: 0.2 })
  content += textCommand({ x: 411, y: 519, text: 'QTD.', size: 7.2, bold: true, color: COLORS.muted, right: true })
  content += textCommand({ x: 532, y: 519, text: 'VALOR', size: 7.2, bold: true, color: COLORS.muted, right: true })

  const baselines = [478, 445, 412]
  const separators = [459, 426, 393]
  items.forEach((item, index) => {
    const y = baselines[index]
    const lines = wrap(item.description, 55).slice(0, 2)
    content += textCommand({ x: 48, y, text: lines[0], size: 9.6, color: COLORS.ink })
    if (lines[1]) content += textCommand({ x: 48, y: y - 11.5, text: lines[1], size: 7.9, color: COLORS.muted })
    content += textCommand({ x: 407, y, text: String(item.quantity), size: 9.1, color: COLORS.ink, right: true })
    content += textCommand({ x: 532, y, text: money(item.value * item.quantity), size: 9.7, bold: true, color: COLORS.ink, right: true })
    content += lineCommand({ x1: 34, y1: separators[index], x2: 544, y2: separators[index], color: COLORS.line, lineWidth: 0.5 })
  })
  return content
}`,
    'services table',
    path,
  )

  source = replaceSection(
    source,
    'function totalsBlock({ summary, receipt }) {',
    'function pixLogoCommand({ cx = 76, cy = 187, size = 42 } = {}) {',
    `function totalsBlock({ summary, receipt }) {
  let content = lineCommand({ x1: 301, y1: 378, x2: 544, y2: 378, color: COLORS.line, lineWidth: 0.7 })
  content += textCommand({ x: 312, y: 357, text: 'Subtotal', size: 8.6, color: COLORS.muted })
  content += textCommand({ x: 532, y: 357, text: money(summary.total), size: 9.1, color: COLORS.ink, right: true })
  content += textCommand({ x: 312, y: 337, text: 'Desconto', size: 8.6, color: COLORS.muted })
  content += textCommand({ x: 532, y: 337, text: money(summary.discounts), size: 9.1, color: COLORS.ink, right: true })

  let detailY = 317
  if (summary.surcharges > 0) {
    content += textCommand({ x: 312, y: detailY, text: 'Acréscimo', size: 8.4, color: COLORS.muted })
    content += textCommand({ x: 532, y: detailY, text: money(summary.surcharges), size: 8.8, color: COLORS.ink, right: true })
    detailY -= 18
  }
  if (!receipt && summary.receivedCash > 0) {
    content += textCommand({ x: 312, y: detailY, text: 'Já recebido', size: 8.4, color: COLORS.muted })
    content += textCommand({ x: 532, y: detailY, text: '- ' + money(summary.receivedCash), size: 8.8, color: COLORS.ink, right: true })
  }

  const total = receipt ? summary.receivedCash : summary.balance
  content += roundedRectCommand({ x: 299, y: 276, width: 245, height: 47, radius: 5, fill: COLORS.paleBlue })
  content += rectCommand({ x: 299, y: 276, width: 3, height: 47, fill: COLORS.blue })
  content += textCommand({ x: 314, y: 296, text: receipt ? 'TOTAL RECEBIDO' : 'TOTAL A PAGAR', size: 9.8, bold: true, color: COLORS.blue, tracking: 0.2 })
  content += textCommand({ x: 531, y: 291, text: money(total), size: 19.2, bold: true, color: COLORS.ink, right: true })
  return content
}`,
    'totals',
    path,
  )

  source = replaceSection(
    source,
    'function pixPaymentBlock() {',
    'function receiptPaymentBlock(summary) {',
    `function pixPaymentBlock() {
  let content = lineCommand({ x1: 34, y1: 260, x2: 544, y2: 260, color: COLORS.line, lineWidth: 0.7 })
  content += textCommand({ x: 34, y: 237, text: 'PAGAMENTO', size: 10.4, bold: true, color: COLORS.blue, tracking: 1.05 })
  content += roundedRectCommand({ x: 34, y: 132, width: 510, height: 91, radius: 7, fill: COLORS.white, stroke: COLORS.line, lineWidth: 0.7 })

  content += pixLogoCommand({ cx: 69, cy: 180, size: 31 })
  content += textCommand({ x: 93, y: 179, text: 'pix', size: 22, color: COLORS.pixGray })
  content += textCommand({ x: 93, y: 163, text: 'PAGAMENTO INSTANTÂNEO', size: 4.4, bold: true, color: COLORS.muted, tracking: 0.16 })
  content += lineCommand({ x1: 181, y1: 145, x2: 181, y2: 210, color: COLORS.line, lineWidth: 0.65 })

  content += textCommand({ x: 205, y: 205, text: 'CHAVE PIX · E-MAIL', size: 6.2, bold: true, color: COLORS.blue, tracking: 0.32 })
  content += textCommand({ x: 205, y: 185, text: PIX.key, size: 10.1, bold: true, color: COLORS.ink })
  content += lineCommand({ x1: 205, y1: 174, x2: 522, y2: 174, color: COLORS.line, lineWidth: 0.5 })
  content += textCommand({ x: 205, y: 157, text: PIX.name + '  ·  ' + PIX.bank, size: 7.5, color: COLORS.muted })
  content += textCommand({ x: 205, y: 143, text: 'Use esta chave no aplicativo do seu banco para concluir o pagamento.', size: 6.4, color: COLORS.muted })
  return content
}`,
    'pix payment',
    path,
  )

  source = source.replace(
    "content += receipt ? receiptPaymentBlock(summary) : pixPaymentBlock()",
    "content += receipt ? receiptPaymentBlock(summary) : pixPaymentBlock()",
  )

  writeFileSync(path, source)
}
