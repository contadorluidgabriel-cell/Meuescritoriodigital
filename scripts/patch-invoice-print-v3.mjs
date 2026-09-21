import { readFileSync, writeFileSync } from 'node:fs'

const MARKER = '// FINANCE_INVOICE_PRINT_V3'

function between(source, start, end, replacement, label) {
  const from = source.indexOf(start)
  const to = from < 0 ? -1 : source.indexOf(end, from + start.length)
  if (from < 0 || to < 0) throw new Error(`Invoice print V3: missing ${label}`)
  return source.slice(0, from) + replacement.trim() + '\n\n' + source.slice(to)
}

function required(source, oldValue, newValue, label) {
  if (!source.includes(oldValue)) throw new Error(`Invoice print V3: missing ${label}`)
  return source.replace(oldValue, newValue)
}

export function applyInvoicePrintV3(root) {
  const path = `${root}src/lib/financePdf.js`
  let pdf = readFileSync(path, 'utf8')
  if (pdf.includes(MARKER)) return
  if (!pdf.includes('// FINANCE_PDF_POLISH_V2')) throw new Error('Invoice print V3 requires PDF polish V2')

  pdf = required(pdf,
    'function textCommand({ x = 48, y, text, size = 10, bold = false, color = COLORS.ink, right = false, tracking = 0 }) {',
    `// FINANCE_INVOICE_PRINT_V3
// Preserve the whole value in data; shorten only the printed text to the available column.
function fitPdfText(value, maxWidth, size, bold = false) {
  const raw = safeText(value)
  if (textWidth(raw, size, bold) <= maxWidth) return raw
  let shortened = raw
  while (shortened.length && textWidth(shortened + '...', size, bold) > maxWidth) shortened = shortened.slice(0, -1)
  return shortened.trimEnd() + '...'
}

function textCommand({ x = 48, y, text, size = 10, bold = false, color = COLORS.ink, right = false, tracking = 0 }) {`,
    'print text fitting')

  pdf = between(pdf,
    'function brandHeader({ title, number, issuedAt, competence }) {',
    'function clientAddress(client = {}) {',
    `function brandHeader({ title, number, issuedAt, competence }) {
  let content = ''
  // White letterhead uses less ink than the former full-width dark banner.
  content += rectCommand({ x: 0, y: 837, width: 595, height: 5, fill: COLORS.blue })
  content += parseLgPath({ x: 31, y: 758, size: 61, color: COLORS.navy })
  content += textCommand({ x: 99, y: 796, text: 'LUID', size: 17, bold: true, color: COLORS.navy })
  content += textCommand({ x: 143, y: 796, text: 'GABRIEL', size: 17, color: COLORS.navy })
  content += textCommand({ x: 99, y: 775, text: 'CONTADOR', size: 7.3, bold: true, color: COLORS.blue, tracking: 1.1 })

  content += textCommand({ x: 544, y: 798, text: title, size: 21, bold: true, color: COLORS.navy, right: true })
  content += textCommand({ x: 544, y: 778, text: number, size: 8.6, color: COLORS.muted, right: true })
  content += textCommand({ x: 367, y: 754, text: 'EMISSÃO', size: 6.5, bold: true, color: COLORS.muted, tracking: 0.25 })
  content += textCommand({ x: 367, y: 739, text: dateBr(issuedAt), size: 8.9, bold: true, color: COLORS.ink })
  content += lineCommand({ x1: 449, y1: 737, x2: 449, y2: 760, color: COLORS.line, lineWidth: 0.65 })
  content += textCommand({ x: 467, y: 754, text: 'COMPETÊNCIA', size: 6.5, bold: true, color: COLORS.muted, tracking: 0.25 })
  content += textCommand({ x: 467, y: 739, text: competenceBr(competence), size: 8.9, bold: true, color: COLORS.ink })
  content += lineCommand({ x1: 34, y1: 728, x2: 544, y2: 728, color: COLORS.line, lineWidth: 0.8 })
  return content
}`,
    'brand header')

  pdf = required(pdf,
    "  content += textCommand({ x: 34, y: 679, text: clientName(client), size: 15.2, bold: true, color: COLORS.ink })\n  let y = 658\n  if (document) { content += textCommand({ x: 34, y, text: documentLabel(document) + ' ' + document, size: 8.6, color: COLORS.muted }); y -= 17 }\n  if (address) { content += textCommand({ x: 34, y, text: safeText(address).slice(0, 56), size: 8.6, color: COLORS.muted }); y -= 17 }\n  if (contact) content += textCommand({ x: 34, y, text: safeText(contact).slice(0, 56), size: 8.6, color: COLORS.muted })",
    `  const nameLines = wrap(clientName(client), 33)
  content += textCommand({ x: 34, y: 679, text: fitPdfText(nameLines[0], 253, 13.5, true), size: 13.5, bold: true, color: COLORS.ink })
  if (nameLines.length > 1) {
    content += textCommand({ x: 34, y: 662, text: fitPdfText(nameLines.slice(1).join(' '), 253, 10.4, true), size: 10.4, bold: true, color: COLORS.ink })
  }
  let y = nameLines.length > 1 ? 641 : 658
  if (document) { content += textCommand({ x: 34, y, text: fitPdfText(documentLabel(document) + ' ' + document, 253, 8.6), size: 8.6, color: COLORS.muted }); y -= 17 }
  if (address) { content += textCommand({ x: 34, y, text: fitPdfText(address, 253, 8.6), size: 8.6, color: COLORS.muted }); y -= 17 }
  if (contact) content += textCommand({ x: 34, y, text: fitPdfText(contact, 253, 8.6), size: 8.6, color: COLORS.muted })`,
    'client name and contact sizing')

  pdf = between(pdf,
    'function totalsBlock({ summary, receipt }) {',
    'function pixLogoCommand({ cx = 76, cy = 187, size = 42 } = {}) {',
    `function totalsBlock({ summary, receipt }) {
  // Four compact rows above the total card keep partial payments and surcharges legible.
  let content = lineCommand({ x1: 301, y1: 378, x2: 544, y2: 378, color: COLORS.line, lineWidth: 0.7 })
  const rows = [
    ['Subtotal', money(summary.total)],
    ['Desconto', money(summary.discounts)],
  ]
  if (summary.surcharges > 0) rows.push(['Acréscimo', money(summary.surcharges)])
  if (!receipt && summary.receivedCash > 0) rows.push(['Já recebido', '- ' + money(summary.receivedCash)])
  rows.forEach(([label, amount], index) => {
    const y = 361 - index * 17
    content += textCommand({ x: 312, y, text: label, size: 8.4, color: COLORS.muted })
    content += textCommand({ x: 532, y, text: amount, size: 8.8, color: COLORS.ink, right: true })
  })
  const total = receipt ? summary.receivedCash : summary.balance
  const totalText = money(total)
  let totalSize = 18.8
  while (totalSize > 13 && textWidth(totalText, totalSize, true) > 213) totalSize -= 0.5
  content += roundedRectCommand({ x: 299, y: 266, width: 245, height: 43, radius: 5, fill: COLORS.paleBlue })
  content += rectCommand({ x: 299, y: 266, width: 3, height: 43, fill: COLORS.blue })
  content += textCommand({ x: 313, y: 290, text: receipt ? 'TOTAL RECEBIDO' : 'TOTAL A PAGAR', size: 8.3, bold: true, color: COLORS.blue, tracking: 0.2 })
  content += textCommand({ x: 531, y: 270, text: totalText, size: totalSize, bold: true, color: COLORS.ink, right: true })
  return content
}`,
    'total payable block')

  // Keep payment details and monetary calculation untouched. Only layout changes here.
  writeFileSync(path, pdf)
}
