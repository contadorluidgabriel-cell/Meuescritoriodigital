import { paymentSummary } from './financePro.js'

const COLORS = {
  blue: '0.141 0.337 0.910', // #2456E8
  navy: '0.071 0.114 0.176', // #121D2D
  ink: '0.094 0.133 0.188', // #182230
  white: '1 1 1',
  soft: '0.969 0.976 0.988', // #F7F9FC
  table: '0.949 0.961 0.976', // #F2F5F9
  line: '0.894 0.914 0.945', // #E4E9F1
  muted: '0.400 0.439 0.522', // #667085
  paleBlue: '0.933 0.953 1',
  amber: '0.635 0.361 0.027',
  paleAmber: '1 0.957 0.882',
  success: '0.086 0.514 0.290',
  paleGreen: '0.922 0.976 0.945',
  danger: '0.706 0.137 0.094',
  paleRed: '0.996 0.925 0.918',
}

const PIX = {
  key: 'contadorluidgabriel@gmail.com',
  name: 'Luid Lira',
  bank: 'Cloudwalk IP (Infinitepay)',
}

// Monograma LG aprovado, igual ao ícone oficial do aplicativo.
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

function textCommand({ x = 48, y, text, size = 10, bold = false, color = COLORS.ink, right = false, tracking = 0 }) {
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

function circleCommand({ cx, cy, r, fill }) {
  const k = 0.5522847498 * r
  return `${fill} rg ${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c f\n`
}

function parseLgPath({ x, y, size, color = COLORS.white }) {
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
    if (/^[MLHVZ]$/.test(token)) {
      mode = token
      index += 1
      if (mode === 'Z') command += 'h\n'
      continue
    }
    if (mode === 'M' || mode === 'L') {
      cursorX = Number(tokens[index])
      cursorY = Number(tokens[index + 1])
      index += 2
      command += `${tx(cursorX).toFixed(2)} ${ty(cursorY).toFixed(2)} ${mode === 'M' ? 'm' : 'l'}\n`
      mode = 'L'
    } else if (mode === 'H') {
      cursorX = Number(tokens[index])
      index += 1
      command += `${tx(cursorX).toFixed(2)} ${ty(cursorY).toFixed(2)} l\n`
    } else if (mode === 'V') {
      cursorY = Number(tokens[index])
      index += 1
      command += `${tx(cursorX).toFixed(2)} ${ty(cursorY).toFixed(2)} l\n`
    } else index += 1
  }
  return `${command}f\n`
}

function brandHeader({ title, number, issuedAt, competence }) {
  let content = ''
  content += rectCommand({ x: 0, y: 716, width: 595, height: 126, fill: COLORS.navy })

  // Bloco de marca: monograma e wordmark tratados como uma única assinatura.
  content += parseLgPath({ x: 40, y: 746, size: 66, color: COLORS.white })
  content += textCommand({ x: 110, y: 792, text: 'LUID', size: 17.5, bold: true, color: COLORS.white })
  content += textCommand({ x: 155, y: 792, text: 'GABRIEL', size: 17.5, color: COLORS.white })
  content += textCommand({ x: 110, y: 771, text: 'CONTADOR', size: 7.3, bold: true, color: COLORS.blue, tracking: 1.25 })

  content += textCommand({ x: 553, y: 797, text: title, size: 21.5, bold: true, color: COLORS.white, right: true })
  content += textCommand({ x: 553, y: 776, text: number, size: 9, bold: true, color: COLORS.white, right: true })

  content += textCommand({ x: 400, y: 749, text: 'EMISSÃO', size: 6.7, bold: true, color: COLORS.line })
  content += textCommand({ x: 400, y: 733, text: dateBr(issuedAt), size: 9, color: COLORS.white })
  content += lineCommand({ x1: 466, y1: 728, x2: 466, y2: 754, color: COLORS.muted, lineWidth: 0.55 })
  content += textCommand({ x: 483, y: 749, text: 'COMPETÊNCIA', size: 6.7, bold: true, color: COLORS.line })
  content += textCommand({ x: 483, y: 733, text: competenceBr(competence), size: 9, color: COLORS.white })

  // Assinatura visual fina — evita a antiga faixa azul pesada.
  content += rectCommand({ x: 0, y: 713, width: 595, height: 3, fill: COLORS.blue })
  return content
}

function clientAddress(client = {}) {
  if (client.endereco && typeof client.endereco === 'string') return client.endereco
  const street = client.logradouro || client.rua || client.address || ''
  const number = client.numero || client.number || ''
  const complement = client.complemento || ''
  const city = client.cidade || client.city || ''
  const state = client.uf || client.estado || client.state || ''
  const first = [street, number].filter(Boolean).join(', ')
  const second = [city, state].filter(Boolean).join('/')
  return [first, complement, second].filter(Boolean).join(' - ')
}

function clientBlock(client, receipt = false) {
  const document = clientDocument(client)
  const address = clientAddress(client)
  const contact = client?.email || client?.telefone || client?.phone || ''
  let content = textCommand({ x: 42, y: 682, text: receipt ? 'RECEBIDO DE' : 'COBRANÇA PARA', size: 7.3, bold: true, color: COLORS.blue, tracking: 0.7 })
  content += textCommand({ x: 42, y: 657, text: clientName(client), size: 15.5, bold: true, color: COLORS.ink })
  let y = 638
  if (document) { content += textCommand({ x: 42, y, text: `CPF/CNPJ ${document}`, size: 8.8, color: COLORS.muted }); y -= 15 }
  if (address) { content += textCommand({ x: 42, y, text: safeText(address).slice(0, 58), size: 8.8, color: COLORS.muted }); y -= 15 }
  if (contact) content += textCommand({ x: 42, y, text: safeText(contact).slice(0, 58), size: 8.8, color: COLORS.muted })
  return content
}

function statusStyle(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('receb') || normalized.includes('quit')) return { text: COLORS.success, fill: COLORS.paleGreen }
  if (normalized.includes('atras') || normalized.includes('venc')) return { text: COLORS.danger, fill: COLORS.paleRed }
  return { text: COLORS.amber, fill: COLORS.paleAmber }
}

function invoiceSummaryBlock({ charge, summary, receipt }) {
  const settled = summary.balance <= 0.009
  const status = receipt || settled ? 'Recebido' : (charge.status || 'Pendente')
  const style = statusStyle(status)
  let content = lineCommand({ x1: 321, y1: 598, x2: 321, y2: 684, color: COLORS.line, lineWidth: 0.8 })
  content += textCommand({ x: 352, y: 682, text: receipt ? 'RESUMO DO RECIBO' : 'RESUMO DA FATURA', size: 7.3, bold: true, color: COLORS.blue, tracking: 0.7 })
  content += textCommand({ x: 352, y: 651, text: 'Vencimento', size: 9, color: COLORS.ink })
  content += textCommand({ x: 548, y: 651, text: dateBr(charge.vencimento), size: 10.5, bold: true, color: COLORS.ink, right: true })
  content += textCommand({ x: 352, y: 624, text: 'Status', size: 9, color: COLORS.ink })
  content += rectCommand({ x: 466, y: 612, width: 82, height: 22, fill: style.fill })
  content += circleCommand({ cx: 477, cy: 623, r: 3, fill: style.text })
  content += textCommand({ x: 487, y: 619, text: status, size: 8.6, bold: true, color: style.text })
  content += textCommand({ x: 352, y: 597, text: 'Competência', size: 9, color: COLORS.ink })
  content += textCommand({ x: 548, y: 597, text: competenceBr(charge.competencia), size: 10.5, bold: true, color: COLORS.ink, right: true })
  return content
}

function normalizeItems(charge, summary) {
  if (Array.isArray(charge.items) && charge.items.length) {
    return charge.items.slice(0, 4).map(item => ({
      description: item.descricao || item.description || 'Serviço',
      quantity: Math.max(1, Number(item.quantidade ?? item.quantity ?? 1) || 1),
      value: Number(item.valor ?? item.value ?? 0) || 0,
    }))
  }
  let description = charge.descricao || 'Honorários contábeis'
  if (charge.competencia && /honor[aá]rios/i.test(description) && !description.includes(competenceBr(charge.competencia))) {
    description = `${description} - Competência ${competenceBr(charge.competencia)}`
  }
  return [{ description, quantity: 1, value: summary.total }]
}

function servicesTable({ charge, summary }) {
  const items = normalizeItems(charge, summary)
  let content = textCommand({ x: 42, y: 557, text: 'SERVIÇOS', size: 10.5, bold: true, color: COLORS.blue, tracking: 1.1 })
  content += rectCommand({ x: 42, y: 514, width: 511, height: 29, fill: COLORS.table })
  content += textCommand({ x: 55, y: 525, text: 'DESCRIÇÃO', size: 7.4, bold: true, color: COLORS.muted })
  content += textCommand({ x: 424, y: 525, text: 'QTD.', size: 7.4, bold: true, color: COLORS.muted, right: true })
  content += textCommand({ x: 541, y: 525, text: 'VALOR', size: 7.4, bold: true, color: COLORS.muted, right: true })

  let y = 491
  items.forEach(item => {
    const lines = wrap(item.description, 58).slice(0, 2)
    content += textCommand({ x: 55, y, text: lines[0], size: 9.6, color: COLORS.ink })
    if (lines[1]) content += textCommand({ x: 55, y: y - 12, text: lines[1], size: 8.1, color: COLORS.muted })
    content += textCommand({ x: 415, y, text: String(item.quantity), size: 9.3, color: COLORS.ink, right: true })
    content += textCommand({ x: 541, y, text: money(item.value * item.quantity), size: 9.6, color: COLORS.ink, right: true })
    content += lineCommand({ x1: 42, y1: y - 18, x2: 553, y2: y - 18, color: COLORS.line, lineWidth: 0.65 })
    y -= lines[1] ? 41 : 34
  })
  return { content, nextY: y }
}

function totalsBlock({ summary, receipt, startY }) {
  let content = ''
  const rightX = 541
  let y = Math.min(startY - 2, 420)
  const rows = [['Subtotal', summary.total]]
  if (summary.discounts > 0) rows.push(['Desconto', -summary.discounts])
  else rows.push(['Desconto', 0])
  if (summary.surcharges > 0) rows.push(['Acréscimo', summary.surcharges])
  if (summary.receivedCash > 0 && !receipt) rows.push(['Recebido', -summary.receivedCash])

  content += lineCommand({ x1: 318, y1: y + 14, x2: 553, y2: y + 14, color: COLORS.line, lineWidth: 0.8 })
  rows.forEach(([label, value]) => {
    content += textCommand({ x: 329, y, text: label, size: 8.7, color: COLORS.ink })
    const formatted = value < 0 ? `- ${money(Math.abs(value))}` : money(value)
    content += textCommand({ x: rightX, y, text: formatted, size: 8.8, color: COLORS.ink, right: true })
    y -= 19
  })

  y -= 8
  const total = receipt ? summary.receivedCash : summary.balance
  const totalBoxY = y - 7
  content += rectCommand({ x: 318, y: totalBoxY, width: 235, height: 32, fill: COLORS.paleBlue })
  content += textCommand({ x: 329, y: totalBoxY + 10, text: receipt ? 'TOTAL RECEBIDO' : 'TOTAL A PAGAR', size: 10.2, bold: true, color: COLORS.blue })
  content += textCommand({ x: rightX, y: totalBoxY + 8, text: money(total), size: 16, bold: true, color: COLORS.blue, right: true })
  return { content, nextY: totalBoxY - 18 }
}

function pixPaymentBlock(startY) {
  const top = Math.min(startY - 20, 300)
  const boxY = top - 112
  let content = textCommand({ x: 42, y: top, text: 'PAGAMENTO', size: 10.5, bold: true, color: COLORS.blue, tracking: 1.1 })
  content += rectCommand({ x: 42, y: boxY, width: 511, height: 94, fill: COLORS.white, stroke: COLORS.line, lineWidth: 0.8 })

  content += textCommand({ x: 64, y: boxY + 56, text: 'PIX', size: 21, bold: true, color: COLORS.blue })
  content += textCommand({ x: 64, y: boxY + 38, text: 'PAGAMENTO INSTANTÂNEO', size: 6.1, bold: true, color: COLORS.muted, tracking: 0.4 })
  content += textCommand({ x: 64, y: boxY + 25, text: 'SEGURO E PRÁTICO', size: 6.1, color: COLORS.muted, tracking: 0.4 })
  content += lineCommand({ x1: 186, y1: boxY + 16, x2: 186, y2: boxY + 78, color: COLORS.line, lineWidth: 0.8 })

  const labelX = 210
  const valueX = 307
  const rows = [
    ['Forma de pagamento', 'PIX'],
    ['Chave Email', PIX.key],
    ['Nome', PIX.name],
    ['Banco', PIX.bank],
  ]
  let y = boxY + 68
  rows.forEach(([label, value], index) => {
    content += textCommand({ x: labelX, y, text: `${label}:`, size: index === 1 ? 7.4 : 8, color: COLORS.muted })
    content += textCommand({ x: valueX, y, text: value, size: index === 1 ? 7.4 : 8.2, bold: true, color: COLORS.ink })
    y -= 17
  })
  return { content, nextY: boxY - 12 }
}

function receiptPaymentBlock({ summary, startY }) {
  const top = Math.min(startY - 20, 300)
  const boxY = Math.max(125, top - 112)
  let content = textCommand({ x: 42, y: top, text: 'BAIXAS REGISTRADAS', size: 9.3, bold: true, color: COLORS.blue, tracking: 0.8 })
  content += rectCommand({ x: 42, y: boxY, width: 511, height: 94, fill: COLORS.soft, stroke: COLORS.line, lineWidth: 0.7 })
  let y = boxY + 68
  if (!summary.payments.length) {
    content += textCommand({ x: 56, y, text: 'Nenhuma baixa detalhada disponível.', size: 8.2, color: COLORS.muted })
  } else {
    summary.payments.slice(-4).forEach(payment => {
      const details = [`${dateBr(payment.data)}`, money(payment.valorRecebido)]
      if (payment.desconto) details.push(`desconto ${money(payment.desconto)}`)
      if (payment.acrescimo) details.push(`acréscimo ${money(payment.acrescimo)}`)
      content += textCommand({ x: 56, y, text: details.join('  ·  '), size: 7.8, color: COLORS.ink })
      y -= 17
    })
  }
  return { content, nextY: boxY - 12 }
}

function footerBlock({ office, number, receipt }) {
  let content = lineCommand({ x1: 42, y1: 86, x2: 553, y2: 86, color: COLORS.line, lineWidth: 0.8 })
  content += textCommand({ x: 42, y: 66, text: 'Documento gerado eletronicamente. Em caso de dúvidas, entre em contato.', size: 7.1, color: COLORS.muted })
  content += textCommand({ x: 42, y: 50, text: officeName(office), size: 8.3, bold: true, color: COLORS.ink })
  content += textCommand({ x: 553, y: 50, text: number, size: 7.3, color: COLORS.muted, right: true })
  if (!receipt) content += textCommand({ x: 42, y: 34, text: 'Esta fatura é um documento comercial de cobrança e não substitui nota fiscal.', size: 6.7, color: COLORS.muted })
  else content += textCommand({ x: 42, y: 34, text: 'Recibo emitido pelo controle financeiro interno.', size: 6.7, color: COLORS.muted })
  return content
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
  content += clientBlock(client, receipt)
  content += invoiceSummaryBlock({ charge, summary, receipt })
  content += lineCommand({ x1: 42, y1: 580, x2: 553, y2: 580, color: COLORS.line, lineWidth: 0.75 })

  const services = servicesTable({ charge, summary })
  content += services.content
  const totals = totalsBlock({ summary, receipt, startY: services.nextY })
  content += totals.content

  const payment = receipt
    ? receiptPaymentBlock({ summary, startY: totals.nextY })
    : pixPaymentBlock(totals.nextY)
  content += payment.content
  content += footerBlock({ office, number, receipt })

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
