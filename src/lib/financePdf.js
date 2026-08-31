import { paymentSummary } from './financePro.js'

const blue = '0.141 0.337 0.910'
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateBr = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—'
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
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
  const date = charge.faturaEmitidaEm || charge.recebidoEm || charge.vencimento || new Date().toISOString().slice(0, 10)
  const year = String(date).slice(0, 4) || String(new Date().getFullYear())
  const prefix = type === 'receipt' ? 'REC' : 'FAT'
  return `${prefix}-${year}-${String(hashNumber(charge.id || `${charge.clienteId}-${charge.descricao}-${charge.valor}`)).padStart(6, '0')}`
}

function textCommand({ x = 48, y, text, size = 10, bold = false, white = false }) {
  return `${white ? '1 1 1 rg' : '0 0 0 rg'} BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${escapePdf(text)}) Tj ET\n`
}

export function buildFinanceDocumentBytes({ type = 'invoice', charge = {}, client = {}, office = {} } = {}) {
  const receipt = type === 'receipt'
  const summary = paymentSummary(charge)
  const issuedAt = receipt ? (summary.lastPaymentDate || charge.recebidoEm || new Date().toISOString().slice(0, 10)) : (charge.faturaEmitidaEm || new Date().toISOString().slice(0, 10))
  const number = financeDocumentNumber({ ...charge, faturaEmitidaEm: issuedAt }, receipt ? 'receipt' : 'invoice')
  const title = receipt ? 'RECIBO DE PAGAMENTO' : 'FATURA DE SERVIÇOS'
  let content = `${blue} rg 0 756 595 86 re f\n`
  content += textCommand({ x: 46, y: 808, text: officeName(office), size: 16, bold: true, white: true })
  content += textCommand({ x: 46, y: 786, text: title, size: 12, bold: true, white: true })
  content += textCommand({ x: 400, y: 808, text: number, size: 10, bold: true, white: true })
  content += textCommand({ x: 400, y: 789, text: `Emissão: ${dateBr(issuedAt)}`, size: 8, white: true })

  let y = 720
  content += textCommand({ y, text: 'CLIENTE', size: 9, bold: true }); y -= 20
  content += textCommand({ y, text: clientName(client), size: 12, bold: true }); y -= 18
  if (client.documento) { content += textCommand({ y, text: `CPF/CNPJ: ${client.documento}`, size: 9 }); y -= 16 }
  if (client.email) { content += textCommand({ y, text: `E-mail: ${client.email}`, size: 9 }); y -= 16 }
  y -= 10

  content += `${blue} rg 46 ${y - 4} 503 1 re f\n`; y -= 24
  content += textCommand({ y, text: 'DETALHES', size: 9, bold: true }); y -= 20
  wrap(charge.descricao || 'Honorários contábeis', 82).slice(0, 3).forEach(line => { content += textCommand({ y, text: line, size: 11, bold: true }); y -= 16 })
  if (charge.parcelaTotal > 1) { content += textCommand({ y, text: `Parcela: ${charge.parcelaNumero}/${charge.parcelaTotal}`, size: 9 }); y -= 16 }
  if (charge.competencia) { content += textCommand({ y, text: `Competência: ${charge.competencia}`, size: 9 }); y -= 16 }
  content += textCommand({ y, text: `Vencimento: ${dateBr(charge.vencimento)}`, size: 9 }); y -= 26

  const rows = [
    ['Valor da cobrança', money(summary.total)],
    ['Valor recebido', money(summary.receivedCash)],
  ]
  if (summary.discounts > 0) rows.push(['Descontos concedidos', money(summary.discounts)])
  if (summary.surcharges > 0) rows.push(['Acréscimos recebidos', money(summary.surcharges)])
  rows.push([receipt ? 'Saldo remanescente' : 'Saldo a pagar', money(summary.balance)])

  rows.forEach(([label, value], index) => {
    if (index % 2 === 0) content += '0.965 0.965 0.97 rg 46 ' + (y - 8) + ' 503 28 re f\n'
    content += textCommand({ x: 56, y, text: label, size: 9 })
    content += textCommand({ x: 430, y, text: value, size: 10, bold: true })
    y -= 30
  })

  if (receipt && summary.payments.length) {
    y -= 10
    content += textCommand({ y, text: 'PAGAMENTOS REGISTRADOS', size: 9, bold: true }); y -= 20
    summary.payments.slice(-8).forEach(payment => {
      const details = [`${dateBr(payment.data)} - ${money(payment.valorRecebido)}`]
      if (payment.desconto) details.push(`desconto ${money(payment.desconto)}`)
      if (payment.acrescimo) details.push(`acréscimo ${money(payment.acrescimo)}`)
      content += textCommand({ y, text: details.join(' - '), size: 8 }); y -= 14
    })
  }

  y = Math.max(90, y - 20)
  content += `${blue} rg 46 ${y + 18} 503 1 re f\n`
  const note = receipt
    ? 'Documento emitido pelo controle financeiro interno. Não substitui documento fiscal quando este for exigido.'
    : 'Fatura comercial para controle e cobrança de serviços. Não substitui nota fiscal.'
  wrap(note, 92).forEach(line => { content += textCommand({ y, text: line, size: 8 }); y -= 13 })
  content += textCommand({ x: 46, y: 38, text: officeName(office), size: 8, bold: true })
  content += textCommand({ x: 360, y: 38, text: 'Gerado pelo Meu Escritório Digital', size: 7 })

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
