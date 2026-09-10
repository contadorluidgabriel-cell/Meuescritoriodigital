import { paymentSummary } from './financePro.js'

const COLORS = {
  blue: '0.141 0.337 0.910', // #2456E8
  navy: '0.071 0.114 0.176', // #121D2D
  ink: '0.094 0.133 0.188', // #182230
  white: '1 1 1',
  table: '0.949 0.961 0.976',
  line: '0.894 0.914 0.945',
  muted: '0.400 0.439 0.522',
  paleBlue: '0.933 0.953 1',
  amber: '0.635 0.361 0.027',
  paleAmber: '1 0.957 0.882',
  success: '0.086 0.514 0.290',
  paleGreen: '0.922 0.976 0.945',
  danger: '0.706 0.137 0.094',
  paleRed: '0.996 0.925 0.918',
  pixTeal: '0.000 0.690 0.650',
  pixGray: '0.380 0.410 0.480',
}

const PIX = {
  key: 'contadorluidgabriel@gmail.com',
  name: 'Luid Lira',
  bank: 'Cloudwalk IP (Infinitepay)',
}

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

function roundedRectCommand({ x, y, width, height, radius = 5, fill = '', stroke = '', lineWidth = 1 }) {
  const r = Math.min(radius, width / 2, height / 2)
  const k = r * 0.5522847498
  let command = ''
  if (fill) command += `${fill} rg `
  if (stroke) command += `${stroke} RG ${lineWidth} w `
  command += `${x + r} ${y} m ${x + width - r} ${y} l `
  command += `${x + width - r + k} ${y} ${x + width} ${y + r - k} ${x + width} ${y + r} c `
  command += `${x + width} ${y + height - r} l ${x + width} ${y + height - r + k} ${x + width - r + k} ${y + height} ${x + width - r} ${y + height} c `
  command += `${x + r} ${y + height} l ${x + r - k} ${y + height} ${x} ${y + height - r + k} ${x} ${y + height - r} c `
  command += `${x} ${y + r} l ${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y} c h ${fill && stroke ? 'B' : fill ? 'f' : 'S'}\n`
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
  content += rectCommand({ x: 0, y: 734, width: 595, height: 108, fill: COLORS.navy })

  // Marca mais compacta e alinhada como um único bloco institucional.
  content += parseLgPath({ x: 29, y: 759, size: 60, color: COLORS.white })
  content += textCommand({ x: 92, y: 795, text: 'LUID', size: 17, bold: true, color: COLORS.white })
  content += textCommand({ x: 136, y: 795, text: 'GABRIEL', size: 17, color: COLORS.white })
  content += textCommand({ x: 92, y: 775, text: 'CONTADOR', size: 7.1, bold: true, color: COLORS.blue, tracking: 1.05 })

  content += textCommand({ x: 532, y: 800, text: title, size: 21, bold: true, color: COLORS.white, right: true })
  content += textCommand({ x: 546, y: 780, text: number, size: 8.6, bold: false, color: COLORS.line, right: true })

  content += textCommand({ x: 391, y: 754, text: 'EMISSÃO', size: 6.4, bold: true, color: COLORS.line, tracking: 0.25 })
  content += textCommand({ x: 391, y: 739, text: dateBr(issuedAt), size: 8.8, color: COLORS.white })
  content += lineCommand({ x1: 463, y1: 738, x2: 463, y2: 760, color: COLORS.muted, lineWidth: 0.45 })
  content += textCommand({ x: 483, y: 754, text: 'COMPETÊNCIA', size: 6.4, bold: true, color: COLORS.line, tracking: 0.25 })
  content += textCommand({ x: 483, y: 739, text: competenceBr(competence), size: 8.8, color: COLORS.white })

  content += rectCommand({ x: 0, y: 731, width: 595, height: 3, fill: COLORS.blue })
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

function documentLabel(document = '') {
  const digits = String(document).replace(/\D/g, '')
  return digits.length > 11 ? 'CNPJ' : digits.length ? 'CPF' : 'CPF/CNPJ'
}

function statusStyle(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('receb') || normalized.includes('quit')) return { text: COLORS.success, fill: COLORS.paleGreen }
  if (normalized.includes('atras') || normalized.includes('venc')) return { text: COLORS.danger, fill: COLORS.paleRed }
  return { text: COLORS.amber, fill: COLORS.paleAmber }
}

function clientAndSummary({ client, charge, summary, receipt }) {
  const document = clientDocument(client)
  const address = clientAddress(client)
  const contact = client?.email || client?.telefone || client?.phone || ''
  const settled = summary.balance <= 0.009
  const status = receipt || settled ? 'Recebido' : (charge.status || 'Pendente')
  const style = statusStyle(status)
  const statusWidth = Math.min(112, Math.max(70, textWidth(status, 8.4, true) + 28))

  let content = textCommand({ x: 34, y: 704, text: receipt ? 'RECEBIDO DE' : 'COBRANÇA PARA', size: 7.2, bold: true, color: COLORS.blue, tracking: 0.8 })
  content += textCommand({ x: 34, y: 679, text: clientName(client), size: 15.2, bold: true, color: COLORS.ink })
  let y = 658
  if (document) { content += textCommand({ x: 34, y, text: `${documentLabel(document)} ${document}`, size: 8.6, color: COLORS.muted }); y -= 17 }
  if (address) { content += textCommand({ x: 34, y, text: safeText(address).slice(0, 56), size: 8.6, color: COLORS.muted }); y -= 17 }
  if (contact) content += textCommand({ x: 34, y, text: safeText(contact).slice(0, 56), size: 8.6, color: COLORS.muted })

  content += lineCommand({ x1: 301, y1: 610, x2: 301, y2: 708, color: COLORS.line, lineWidth: 0.7 })
  content += textCommand({ x: 334, y: 704, text: receipt ? 'RESUMO DO RECIBO' : 'RESUMO DA FATURA', size: 7.2, bold: true, color: COLORS.blue, tracking: 0.8 })
  content += textCommand({ x: 334, y: 671, text: 'Vencimento', size: 8.8, color: COLORS.muted })
  content += textCommand({ x: 538, y: 670, text: dateBr(charge.vencimento), size: 10.5, bold: true, color: COLORS.ink, right: true })
  content += textCommand({ x: 334, y: 643, text: 'Status', size: 8.8, color: COLORS.muted })
  content += roundedRectCommand({ x: 544 - statusWidth, y: 630, width: statusWidth, height: 22, radius: 5, fill: style.fill })
  content += circleCommand({ cx: 555 - statusWidth, cy: 641, r: 2.7, fill: style.text })
  content += textCommand({ x: 566 - statusWidth, y: 637, text: status, size: 8.3, bold: true, color: style.text })
  content += textCommand({ x: 334, y: 615, text: 'Competência', size: 8.8, color: COLORS.muted })
  content += textCommand({ x: 538, y: 614, text: competenceBr(charge.competencia), size: 10.5, bold: true, color: COLORS.ink, right: true })
  content += lineCommand({ x1: 34, y1: 584, x2: 544, y2: 584, color: COLORS.line, lineWidth: 0.7 })
  return content
}

function normalizeItems(charge, summary) {
  if (Array.isArray(charge.items) && charge.items.length) {
    return charge.items.slice(0, 2).map(item => ({
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
  let content = textCommand({ x: 34, y: 554, text: 'SERVIÇOS', size: 10.4, bold: true, color: COLORS.blue, tracking: 1.05 })
  content += roundedRectCommand({ x: 34, y: 507, width: 510, height: 31, radius: 3, fill: COLORS.table })
  content += textCommand({ x: 48, y: 519, text: 'DESCRIÇÃO', size: 7.2, bold: true, color: COLORS.muted, tracking: 0.2 })
  content += textCommand({ x: 411, y: 519, text: 'QTD.', size: 7.2, bold: true, color: COLORS.muted, right: true })
  content += textCommand({ x: 532, y: 519, text: 'VALOR', size: 7.2, bold: true, color: COLORS.muted, right: true })

  const baselines = [478, 435]
  const separators = [456, 413]
  items.forEach((item, index) => {
    const y = baselines[index]
    const lines = wrap(item.description, 55).slice(0, 2)
    content += textCommand({ x: 48, y, text: lines[0], size: 9.7, bold: false, color: COLORS.ink })
    if (lines[1]) content += textCommand({ x: 48, y: y - 13, text: lines[1], size: 8.1, color: COLORS.muted })
    content += textCommand({ x: 407, y, text: String(item.quantity), size: 9.3, color: COLORS.ink, right: true })
    content += textCommand({ x: 532, y, text: money(item.value * item.quantity), size: 9.7, bold: true, color: COLORS.ink, right: true })
  })
  separators.slice(0, items.length).forEach(y => {
    content += lineCommand({ x1: 34, y1: y, x2: 544, y2: y, color: COLORS.line, lineWidth: 0.55 })
  })
  return content
}

function totalsBlock({ summary, receipt }) {
  let content = lineCommand({ x1: 301, y1: 397, x2: 544, y2: 397, color: COLORS.line, lineWidth: 0.7 })
  content += textCommand({ x: 312, y: 374, text: 'Subtotal', size: 8.7, color: COLORS.muted })
  content += textCommand({ x: 532, y: 374, text: money(summary.total), size: 9.1, color: COLORS.ink, right: true })
  content += textCommand({ x: 312, y: 352, text: 'Desconto', size: 8.7, color: COLORS.muted })
  content += textCommand({ x: 532, y: 352, text: money(summary.discounts), size: 9.1, color: COLORS.ink, right: true })
  if (summary.surcharges > 0) {
    content += textCommand({ x: 312, y: 331, text: 'Acréscimo', size: 8.4, color: COLORS.muted })
    content += textCommand({ x: 532, y: 331, text: money(summary.surcharges), size: 8.8, color: COLORS.ink, right: true })
  }

  const total = receipt ? summary.receivedCash : summary.balance
  content += roundedRectCommand({ x: 299, y: 296, width: 245, height: 43, radius: 5, fill: COLORS.paleBlue })
  content += rectCommand({ x: 299, y: 296, width: 3, height: 43, fill: COLORS.blue })
  content += textCommand({ x: 314, y: 315, text: receipt ? 'TOTAL RECEBIDO' : 'TOTAL', size: 10.2, bold: true, color: COLORS.blue, tracking: 0.25 })
  content += textCommand({ x: 531, y: 311, text: money(total), size: 18, bold: true, color: COLORS.blue, right: true })
  return content
}

function pixLogoCommand({ cx = 76, cy = 187, size = 42 } = {}) {
  const r = size / 2
  const q = r * 0.34
  let content = `${COLORS.pixTeal} rg `
  content += `${cx} ${cy + r} m `
  content += `${cx + q} ${cy + r} ${cx + r} ${cy + q} ${cx + r} ${cy} c `
  content += `${cx + r} ${cy - q} ${cx + q} ${cy - r} ${cx} ${cy - r} c `
  content += `${cx - q} ${cy - r} ${cx - r} ${cy - q} ${cx - r} ${cy} c `
  content += `${cx - r} ${cy + q} ${cx - q} ${cy + r} ${cx} ${cy + r} c f\n`
  content += `${COLORS.white} RG 2.0 w 1 J ${cx - 14} ${cy + 4.5} m ${cx - 7} ${cy + 4.5} ${cx - 6} ${cy - 4.5} ${cx} ${cy - 4.5} c ${cx + 6} ${cy - 4.5} ${cx + 7} ${cy + 4.5} ${cx + 14} ${cy + 4.5} c S\n`
  content += `${COLORS.white} RG 2.0 w 1 J ${cx - 14} ${cy - 4.5} m ${cx - 7} ${cy - 4.5} ${cx - 6} ${cy + 4.5} ${cx} ${cy + 4.5} c ${cx + 6} ${cy + 4.5} ${cx + 7} ${cy - 4.5} ${cx + 14} ${cy - 4.5} c S\n`
  return content
}

function pixPaymentBlock() {
  let content = lineCommand({ x1: 34, y1: 279, x2: 544, y2: 279, color: COLORS.line, lineWidth: 0.7 })
  content += textCommand({ x: 34, y: 254, text: 'PAGAMENTO', size: 10.4, bold: true, color: COLORS.blue, tracking: 1.05 })
  content += roundedRectCommand({ x: 34, y: 139, width: 510, height: 101, radius: 7, fill: COLORS.white, stroke: COLORS.line, lineWidth: 0.75 })

  // O PIX vira um cartão de pagamento: marca à esquerda, chave como informação principal.
  content += pixLogoCommand({ cx: 70, cy: 192, size: 34 })
  content += textCommand({ x: 96, y: 190, text: 'pix', size: 24, color: COLORS.pixGray })
  content += textCommand({ x: 96, y: 173, text: 'PAGAMENTO INSTANTÂNEO', size: 4.6, bold: true, color: COLORS.muted, tracking: 0.18 })
  content += textCommand({ x: 96, y: 163, text: 'SEGURO E PRÁTICO', size: 4.4, color: COLORS.muted, tracking: 0.18 })
  content += lineCommand({ x1: 184, y1: 153, x2: 184, y2: 226, color: COLORS.line, lineWidth: 0.7 })

  content += textCommand({ x: 207, y: 216, text: 'CHAVE PIX · E-MAIL', size: 6.4, bold: true, color: COLORS.blue, tracking: 0.35 })
  content += textCommand({ x: 207, y: 197, text: PIX.key, size: 9.4, bold: true, color: COLORS.ink })
  content += lineCommand({ x1: 207, y1: 186, x2: 522, y2: 186, color: COLORS.line, lineWidth: 0.55 })

  content += textCommand({ x: 207, y: 169, text: 'Titular', size: 7.1, color: COLORS.muted })
  content += textCommand({ x: 250, y: 169, text: PIX.name, size: 8.1, bold: true, color: COLORS.ink })
  content += textCommand({ x: 354, y: 169, text: 'Banco', size: 7.1, color: COLORS.muted })
  content += textCommand({ x: 393, y: 169, text: PIX.bank, size: 7.7, bold: true, color: COLORS.ink })
  content += textCommand({ x: 207, y: 151, text: 'Use a chave acima no aplicativo do seu banco para realizar o pagamento.', size: 6.6, color: COLORS.muted })
  return content
}

function receiptPaymentBlock(summary) {
  let content = lineCommand({ x1: 34, y1: 279, x2: 544, y2: 279, color: COLORS.line, lineWidth: 0.7 })
  content += textCommand({ x: 34, y: 254, text: 'RECEBIMENTOS', size: 10.4, bold: true, color: COLORS.blue, tracking: 1.05 })
  content += roundedRectCommand({ x: 34, y: 139, width: 510, height: 101, radius: 7, fill: COLORS.white, stroke: COLORS.line, lineWidth: 0.75 })
  let y = 213
  if (!summary.payments.length) {
    content += textCommand({ x: 52, y, text: 'Nenhuma baixa detalhada disponível.', size: 8.4, color: COLORS.muted })
  } else {
    summary.payments.slice(-4).forEach(payment => {
      const details = [`${dateBr(payment.data)}`, money(payment.valorRecebido)]
      if (payment.desconto) details.push(`desconto ${money(payment.desconto)}`)
      if (payment.acrescimo) details.push(`acréscimo ${money(payment.acrescimo)}`)
      content += textCommand({ x: 52, y, text: details.join(' - '), size: 8.2, color: COLORS.ink })
      y -= 18
    })
  }
  return content
}

function footerBlock({ office }) {
  let content = lineCommand({ x1: 34, y1: 107, x2: 544, y2: 107, color: COLORS.line, lineWidth: 0.7 })
  content += textCommand({ x: 34, y: 75, text: 'Documento gerado eletronicamente. Em caso de dúvidas, entre em contato.', size: 6.9, color: COLORS.muted })
  content += textCommand({ x: 34, y: 58, text: officeName(office), size: 8.1, bold: true, color: COLORS.ink })

  content += lineCommand({ x1: 438, y1: 39, x2: 438, y2: 84, color: COLORS.line, lineWidth: 0.7 })
  content += lineCommand({ x1: 466, y1: 76, x2: 495, y2: 76, color: COLORS.blue, lineWidth: 1.7 })
  content += textCommand({ x: 466, y: 63, text: 'CONTABILIDADE', size: 5.9, color: COLORS.muted, tracking: 1.0 })
  content += textCommand({ x: 466, y: 51, text: 'PARA UM FUTURO', size: 5.9, color: COLORS.muted, tracking: 1.0 })
  content += textCommand({ x: 466, y: 39, text: 'MAIS FORTE', size: 5.9, color: COLORS.muted, tracking: 1.0 })
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
  content += clientAndSummary({ client, charge, summary, receipt })
  content += servicesTable({ charge, summary })
  content += totalsBlock({ summary, receipt })
  content += receipt ? receiptPaymentBlock(summary) : pixPaymentBlock()
  content += footerBlock({ office })

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
