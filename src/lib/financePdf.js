import { paymentSummary } from './financePro.js'

const COLORS = {
  blue: '0.141 0.337 0.910', // #2456E8
  black: '0 0 0',
  white: '1 1 1',
  lightBlue: '0.918 0.945 1', // #EAF1FF
  support: '0.969 0.973 0.980', // #F7F8FA
  line: '0.890 0.906 0.933',
  muted: '0.365 0.404 0.467',
}

// Monograma LG aprovado. O path é o mesmo usado pelo ícone oficial do app.
const LG_PATH = 'M56 82.65V428.71H302.55L303.19 428.07 312.82 427.43 313.46 426.79 322.45 425.5 338.5 421.01 340.43 419.72 343.64 419.08 353.27 414.59 354.56 414.59 364.83 409.45 382.16 398.54 391.15 391.47 408.49 374.78 415.55 366.43 426.47 351.02 431.6 341.39 432.89 340.11 441.87 320.85 447.01 306.08 447.01 304.15 448.3 301.59 448.3 299.66 450.86 291.31 452.15 281.68 452.79 281.04 452.79 277.19 453.43 276.55 453.43 272.69 454.07 272.05 454.72 253.43 455.36 252.79V236.74L454.72 236.1H290.35L289.07 239.31 288.42 243.8 287.14 246.37V248.3L285.86 250.86V252.79L284.57 255.36 282.65 264.35 281.36 266.91V268.84L280.08 271.41 278.79 278.47 276.87 283.61H396.29L396.93 284.25 395 293.24 391.79 302.87 387.94 310.57V311.86L379.6 326.63 372.53 336.26 359.69 349.74 347.49 359.37 338.5 365.15 324.38 372.21 317.96 374.14 316.03 375.42H314.11L306.4 377.99 299.98 378.63 299.34 379.27H292.28L291.63 379.92H113.78L112.5 378.63 113.14 377.99 112.5 376.06 113.14 374.14 112.5 372.21V218.76L113.14 218.12 112.5 216.19V187.94L113.14 187.3 112.5 185.37V87.14L113.14 86.5 112.5 85.86V83.93L113.14 83.29 112.5 82.65H56ZM400.78 124.38 392.44 117.32 377.03 106.4 357.77 96.13H356.48L346.85 91.63 343 90.99 334.01 87.78H331.44L328.23 86.5 318.6 85.21 317.96 84.57H314.11L313.46 83.93H307.69L307.04 83.29H282.65L282 83.93H276.22L275.58 84.57 264.03 85.86 263.38 86.5H260.82L260.17 87.14 253.11 88.42 250.54 89.71H248.62L240.91 92.28 238.99 93.56 231.28 96.13 226.79 98.7H225.5L213.3 105.12 198.54 114.75 184.41 126.3 174.14 136.58 167.08 144.92 156.8 159.69 146.53 178.95V180.24L142.68 188.58 136.9 207.2V209.77L136.26 210.41 135.61 216.19 134.97 216.83V220.04L134.33 220.69V224.54L133.69 225.18V230.96L133.05 231.6V256.64L133.69 257.28V263.06L134.33 263.7 134.97 272.05 135.61 272.69 137.54 283.61 142.68 299.66 147.81 310.57V311.86L153.59 322.77 161.94 335.61 172.85 349.1 183.13 359.37H261.46L262.74 360.01V359.37L259.53 358.73 255.04 356.16 252.47 355.52 251.18 354.23 242.84 350.38 237.7 346.53 233.85 344.6 222.29 335.61 210.74 324.06 203.03 314.43 195.97 303.51 190.83 293.24 185.05 277.19V275.26L183.13 269.48V266.91L182.48 266.27V263.06L181.84 262.42 181.2 247.65 180.56 247.01 181.2 233.53 181.84 232.89V229.03L182.48 228.39 183.13 221.97 183.77 221.33 186.98 207.85 194.68 190.51 202.39 178.31 210.09 168.68 219.72 159.05 231.28 150.06 238.34 145.57 256.32 137.22 269.8 133.37H272.37L276.22 132.08H280.72L281.36 131.44H288.42L289.07 130.8 305.76 131.44 306.4 132.08H310.25L310.9 132.73 316.67 133.37 331.44 137.86 340.43 142.36 343 143 356.48 151.35 364.83 157.77 378.31 171.25 383.45 177.67 390.51 188.58 434.17 168.04 426.47 154.56 420.04 145.57 411.06 134.65Z'

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateBr = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '-'
const competenceBr = value => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ''))
  return match ? `${match[2]}/${match[1]}` : (value || '-')
}
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const clientDocument = client => client?.documento || client?.cnpj || client?.cpf || ''
const officeName = office => {
  const configured = office?.settings?.office
  return configured && configured !== 'Meu Escritório' ? configured : 'Contador Luid Gabriel'
}

function safeText(value = '') {
  return String(value)
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x00-\xFF]/g, '?')
}

function escapePdf(value = '') {
  return safeText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function latin1Bytes(value = '') {
  const text = safeText(value)
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 0xff
  return bytes
}

function concatBytes(chunks) {
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(size)
  let offset = 0
  chunks.forEach(chunk => { result.set(chunk, offset); offset += chunk.length })
  return result
}

function wrap(value, max = 78) {
  const words = safeText(value).split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  words.forEach(word => {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= max) current = candidate
    else { if (current) lines.push(current); current = word }
  })
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function hashNumber(value = '') {
  let hash = 2166136261
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0) % 1000000
}

export function financeDocumentNumber(charge = {}, type = 'invoice') {
  const receipt = type === 'receipt'
  const date = receipt
    ? (charge.reciboEmitidoEm || charge.recebidoEm || charge.vencimento || new Date().toISOString().slice(0, 10))
    : (charge.faturaEmitidaEm || charge.vencimento || new Date().toISOString().slice(0, 10))
  const year = String(date).slice(0, 4) || String(new Date().getFullYear())
  const prefix = receipt ? 'REC' : 'FAT'
  return `${prefix}-${year}-${String(hashNumber(charge.id || `${charge.clienteId}-${charge.descricao}-${charge.valor}`)).padStart(6, '0')}`
}

function textWidth(text, size = 10, bold = false) {
  return safeText(text).length * size * (bold ? 0.54 : 0.5)
}

function textCommand({ x = 48, y, text, size = 10, bold = false, color = COLORS.black, right = false, tracking = 0 }) {
  const finalX = right ? x - textWidth(text, size, bold) : x
  return `${color} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf ${tracking || 0} Tc ${finalX.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(text)}) Tj ET\n`
}

function rectCommand({ x, y, width, height, fill = '', stroke = '', lineWidth = 1 }) {
  let command = ''
  if (fill) command += `${fill} rg `
  if (stroke) command += `${stroke} RG ${lineWidth} w `
  command += `${x} ${y} ${width} ${height} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}\n`
  return command
}

function lineCommand({ x1, y1, x2, y2, color = COLORS.line, lineWidth = 1 }) {
  return `${color} RG ${lineWidth} w ${x1} ${y1} m ${x2} ${y2} l S\n`
}

function parseLgPath({ x, y, size, color = COLORS.black }) {
  const tokens = LG_PATH.match(/[MLHVZ]|-?\d*\.?\d+/g) || []
  const scale = size / 512
  const tx = value => x + (25.6 + 0.9 * Number(value)) * scale
  const ty = value => y + size - (25.6 + 0.9 * Number(value)) * scale
  let command = `${color} rg\n`
  let mode = ''
  let cursorX = 0
  let cursorY = 0
  let index = 0
  while (index < tokens.length) {
    const token = tokens[index]
    if (/^[MLHVZ]$/.test(token)) { mode = token; index += 1; if (mode === 'Z') command += 'h\n'; continue }
    if (mode === 'M' || mode === 'L') {
      cursorX = Number(tokens[index]); cursorY = Number(tokens[index + 1]); index += 2
      command += `${tx(cursorX).toFixed(2)} ${ty(cursorY).toFixed(2)} ${mode === 'M' ? 'm' : 'l'}\n`
      mode = 'L'
    } else if (mode === 'H') {
      cursorX = Number(tokens[index]); index += 1
      command += `${tx(cursorX).toFixed(2)} ${ty(cursorY).toFixed(2)} l\n`
    } else if (mode === 'V') {
      cursorY = Number(tokens[index]); index += 1
      command += `${tx(cursorX).toFixed(2)} ${ty(cursorY).toFixed(2)} l\n`
    } else index += 1
  }
  return `${command}f\n`
}

function brandHeader({ title, number, issuedAt, competence }) {
  let content = ''
  content += parseLgPath({ x: 46, y: 744, size: 72, color: COLORS.black })
  content += lineCommand({ x1: 126, y1: 754, x2: 126, y2: 808, color: COLORS.line, lineWidth: 1 })
  content += textCommand({ x: 143, y: 790, text: 'LUID', size: 19, bold: true })
  content += textCommand({ x: 194, y: 790, text: 'GABRIEL', size: 19 })
  content += textCommand({ x: 143, y: 770, text: 'CONTADOR', size: 9, bold: true, color: COLORS.blue, tracking: 2.6 })

  content += textCommand({ x: 548, y: 800, text: title, size: 24, bold: true, right: true })
  content += textCommand({ x: 548, y: 780, text: number, size: 10, bold: true, right: true })
  content += textCommand({ x: 548, y: 764, text: `Emissão: ${dateBr(issuedAt)}`, size: 8.5, color: COLORS.muted, right: true })
  if (competence) content += textCommand({ x: 548, y: 749, text: `Competência: ${competenceBr(competence)}`, size: 8.5, color: COLORS.muted, right: true })
  content += lineCommand({ x1: 46, y1: 729, x2: 549, y2: 729, color: COLORS.blue, lineWidth: 1.6 })
  return content
}

function infoCell({ x, y, width, label, value, strong = false }) {
  let content = rectCommand({ x, y, width, height: 54, fill: COLORS.support, stroke: COLORS.line, lineWidth: 0.7 })
  content += textCommand({ x: x + 12, y: y + 35, text: label.toUpperCase(), size: 7.3, bold: true, color: COLORS.blue })
  content += textCommand({ x: x + 12, y: y + 16, text: value, size: strong ? 12 : 10, bold: strong })
  return content
}

function clientBlock(client) {
  const document = clientDocument(client)
  const contact = client?.email || client?.telefone || client?.phone || ''
  let content = rectCommand({ x: 46, y: 628, width: 503, height: 83, fill: COLORS.white, stroke: COLORS.line, lineWidth: 0.8 })
  content += rectCommand({ x: 46, y: 628, width: 4, height: 83, fill: COLORS.blue })
  content += textCommand({ x: 64, y: 690, text: 'CLIENTE', size: 7.5, bold: true, color: COLORS.blue })
  content += textCommand({ x: 64, y: 670, text: clientName(client), size: 13, bold: true })
  let y = 653
  if (document) { content += textCommand({ x: 64, y, text: `CPF/CNPJ: ${document}`, size: 8.7, color: COLORS.muted }); y -= 14 }
  if (contact) content += textCommand({ x: 64, y, text: contact, size: 8.7, color: COLORS.muted })
  return content
}

function paymentSummaryBlock({ charge, summary, receipt }) {
  let content = ''
  content += textCommand({ x: 46, y: 472, text: receipt ? 'RESUMO DO RECEBIMENTO' : 'RESUMO DA COBRANÇA', size: 9, bold: true })
  content += lineCommand({ x1: 46, y1: 462, x2: 549, y2: 462, color: COLORS.line, lineWidth: 0.8 })
  const rows = [
    ['Valor da cobrança', money(summary.total)],
    ['Valor recebido', money(summary.receivedCash)],
  ]
  if (summary.discounts > 0) rows.push(['Desconto concedido', money(summary.discounts)])
  if (summary.surcharges > 0) rows.push(['Acréscimo recebido', money(summary.surcharges)])
  rows.push([receipt ? 'Saldo remanescente' : 'Saldo a pagar', money(summary.balance)])
  let y = 438
  rows.forEach(([label, value], index) => {
    if (index % 2 === 0) content += rectCommand({ x: 46, y: y - 9, width: 503, height: 27, fill: COLORS.support })
    content += textCommand({ x: 58, y, text: label, size: 9, color: index === rows.length - 1 ? COLORS.black : COLORS.muted, bold: index === rows.length - 1 })
    content += textCommand({ x: 537, y, text: value, size: index === rows.length - 1 ? 12 : 9.5, bold: true, color: index === rows.length - 1 ? COLORS.blue : COLORS.black, right: true })
    y -= 29
  })
  return { content, nextY: y }
}

export function buildFinanceDocumentBytes({ type = 'invoice', charge = {}, client = {}, office = {} } = {}) {
  const receipt = type === 'receipt'
  const summary = paymentSummary(charge)
  const issuedAt = receipt
    ? (charge.reciboEmitidoEm || summary.lastPaymentDate || charge.recebidoEm || new Date().toISOString().slice(0, 10))
    : (charge.faturaEmitidaEm || new Date().toISOString().slice(0, 10))
  const number = financeDocumentNumber({ ...charge, ...(receipt ? { reciboEmitidoEm: issuedAt } : { faturaEmitidaEm: issuedAt }) }, receipt ? 'receipt' : 'invoice')
  const title = receipt ? 'RECIBO' : 'FATURA'

  let content = `${COLORS.white} rg 0 0 595 842 re f\n`
  content += brandHeader({ title, number, issuedAt, competence: charge.competencia })
  content += clientBlock(client)

  content += infoCell({ x: 46, y: 557, width: 116, label: 'Emissão', value: dateBr(issuedAt) })
  content += infoCell({ x: 174, y: 557, width: 116, label: 'Vencimento', value: dateBr(charge.vencimento) })
  content += infoCell({ x: 302, y: 557, width: 116, label: 'Status', value: receipt ? 'RECEBIDO' : (summary.balance <= 0.009 ? 'RECEBIDO' : charge.status || 'PENDENTE'), strong: true })
  content += infoCell({ x: 430, y: 557, width: 119, label: receipt ? 'Recebido' : 'Valor total', value: money(receipt ? summary.receivedCash : summary.total), strong: true })

  content += textCommand({ x: 46, y: 529, text: 'DESCRIÇÃO DO SERVIÇO', size: 9, bold: true, color: COLORS.blue })
  content += lineCommand({ x1: 46, y1: 519, x2: 549, y2: 519, color: COLORS.blue, lineWidth: 1.2 })
  const descriptionLines = wrap(charge.descricao || 'Honorários contábeis', 70).slice(0, 3)
  let descriptionY = 499
  descriptionLines.forEach((line, index) => {
    content += textCommand({ x: 58, y: descriptionY, text: line, size: index === 0 ? 11 : 9.2, bold: index === 0, color: index === 0 ? COLORS.black : COLORS.muted })
    descriptionY -= index === 0 ? 17 : 14
  })
  if (charge.parcelaTotal > 1) content += textCommand({ x: 537, y: 499, text: `Parcela ${charge.parcelaNumero}/${charge.parcelaTotal}`, size: 8.5, color: COLORS.muted, right: true })

  const summaryBlock = paymentSummaryBlock({ charge, summary, receipt })
  content += summaryBlock.content
  let y = summaryBlock.nextY - 4

  if (receipt && summary.payments.length) {
    content += textCommand({ x: 46, y, text: 'BAIXAS REGISTRADAS', size: 8.5, bold: true, color: COLORS.blue }); y -= 18
    summary.payments.slice(-5).forEach(payment => {
      const details = [`${dateBr(payment.data)} - ${money(payment.valorRecebido)}`]
      if (payment.desconto) details.push(`desconto ${money(payment.desconto)}`)
      if (payment.acrescimo) details.push(`acréscimo ${money(payment.acrescimo)}`)
      content += textCommand({ x: 58, y, text: details.join(' - '), size: 8.1, color: COLORS.muted }); y -= 14
    })
    y -= 4
  }

  const note = receipt
    ? 'Recibo emitido pelo controle financeiro interno. Não substitui documento fiscal quando este for exigido.'
    : 'Esta fatura é um documento comercial de cobrança e não substitui nota fiscal.'
  const noteHeight = 54
  const noteY = Math.max(92, y - noteHeight - 12)
  content += rectCommand({ x: 46, y: noteY, width: 503, height: noteHeight, fill: COLORS.lightBlue, stroke: COLORS.line, lineWidth: 0.6 })
  content += rectCommand({ x: 46, y: noteY, width: 4, height: noteHeight, fill: COLORS.blue })
  content += textCommand({ x: 62, y: noteY + 35, text: receipt ? 'DOCUMENTO DE RECEBIMENTO' : 'ESTA FATURA NÃO É NOTA FISCAL', size: 8.2, bold: true, color: COLORS.blue })
  wrap(note, 84).slice(0, 2).forEach((line, index) => { content += textCommand({ x: 62, y: noteY + 19 - index * 12, text: line, size: 7.6, color: COLORS.muted }) })

  content += lineCommand({ x1: 46, y1: 65, x2: 549, y2: 65, color: COLORS.line, lineWidth: 0.8 })
  content += parseLgPath({ x: 46, y: 18, size: 38, color: COLORS.black })
  content += textCommand({ x: 92, y: 42, text: 'LUID', size: 10, bold: true })
  content += textCommand({ x: 120, y: 42, text: 'GABRIEL', size: 10 })
  content += textCommand({ x: 92, y: 29, text: 'CONTADOR', size: 5.7, bold: true, color: COLORS.blue, tracking: 1.5 })
  content += textCommand({ x: 549, y: 39, text: officeName(office), size: 7.4, color: COLORS.muted, right: true })
  content += textCommand({ x: 549, y: 27, text: 'Gerado pelo Meu Escritório Digital', size: 6.5, color: COLORS.muted, right: true })
  content += rectCommand({ x: 0, y: 0, width: 595, height: 6, fill: COLORS.blue })

  const stream = latin1Bytes(content)
  const objects = [
    latin1Bytes('<< /Type /Catalog /Pages 2 0 R >>'),
    latin1Bytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    latin1Bytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>'),
    latin1Bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    latin1Bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
    concatBytes([latin1Bytes(`<< /Length ${stream.length} >>\nstream\n`), stream, latin1Bytes('\nendstream')]),
  ]

  const chunks = [latin1Bytes('%PDF-1.4\n%âãÏÓ\n')]
  const offsets = [0]
  let offset = chunks[0].length
  objects.forEach((object, index) => {
    offsets.push(offset)
    const chunk = concatBytes([latin1Bytes(`${index + 1} 0 obj\n`), object, latin1Bytes('\nendobj\n')])
    chunks.push(chunk)
    offset += chunk.length
  })
  const xrefOffset = offset
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let index = 1; index <= objects.length; index += 1) xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  chunks.push(latin1Bytes(xref))
  return concatBytes(chunks)
}

export function downloadFinanceDocument({ type = 'invoice', charge, client, office } = {}) {
  const bytes = buildFinanceDocumentBytes({ type, charge, client, office })
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const number = financeDocumentNumber(charge, type === 'receipt' ? 'receipt' : 'invoice')
  anchor.href = url
  anchor.download = `${number}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
  return number
}
