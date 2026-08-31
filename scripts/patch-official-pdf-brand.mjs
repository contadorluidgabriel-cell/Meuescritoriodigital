import { readFileSync, writeFileSync } from 'node:fs'

function patchFile(path, marker, replacements) {
  let source = readFileSync(path, 'utf8')
  if (source.includes(marker)) return
  for (const [from, to, label] of replacements) {
    if (!source.includes(from)) throw new Error(`Official PDF brand patch failed (${label}) in ${path}`)
    source = source.replace(from, to)
  }
  writeFileSync(path, source)
}

export function applyOfficialPdfBrandPatch(root) {
  const mainBase64 = readFileSync(`${root}src/assets/brand-main.jpg`).toString('base64')
  const reducedBase64 = readFileSync(`${root}src/assets/brand-reduced.jpg`).toString('base64')
  const brandConstants = `const OFFICIAL_MAIN_LOGO = { width: 240, height: 64, base64: '${mainBase64}' }\nconst OFFICIAL_REDUCED_LOGO = { width: 80, height: 68, base64: '${reducedBase64}' }`

  patchFile(`${root}src/lib/financePdf.js`, "const OFFICIAL_MAIN_LOGO = { width: 240, height: 64", [
    [
      "import { paymentSummary } from './financePro.js'",
      `import { paymentSummary } from './financePro.js'\n\n${brandConstants}`,
      'brand assets',
    ],
    [
      "function concatBytes(chunks) {\n  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0)\n  const result = new Uint8Array(size)\n  let offset = 0\n  chunks.forEach(chunk => { result.set(chunk, offset); offset += chunk.length })\n  return result\n}",
      "function concatBytes(chunks) {\n  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0)\n  const result = new Uint8Array(size)\n  let offset = 0\n  chunks.forEach(chunk => { result.set(chunk, offset); offset += chunk.length })\n  return result\n}\n\nfunction base64Bytes(value = '') {\n  const binary = atob(value)\n  const result = new Uint8Array(binary.length)\n  for (let index = 0; index < binary.length; index += 1) result[index] = binary.charCodeAt(index)\n  return result\n}\n\nfunction jpegObject(asset) {\n  const bytes = base64Bytes(asset.base64)\n  return concatBytes([\n    latin1Bytes(`<< /Type /XObject /Subtype /Image /Width ${asset.width} /Height ${asset.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\\nstream\\n`),\n    bytes,\n    latin1Bytes('\\nendstream'),\n  ])\n}",
      'jpeg helpers',
    ],
    [
      "function lineCommand({ x1, y1, x2, y2, color = COLORS.line, lineWidth = 1 }) {\n  return `${color} RG ${lineWidth} w ${x1} ${y1} m ${x2} ${y2} l S\\n`\n}",
      "function lineCommand({ x1, y1, x2, y2, color = COLORS.line, lineWidth = 1 }) {\n  return `${color} RG ${lineWidth} w ${x1} ${y1} m ${x2} ${y2} l S\\n`\n}\n\nfunction imageCommand({ name, x, y, width, height }) {\n  return `q ${width} 0 0 ${height} ${x} ${y} cm /${name} Do Q\\n`\n}",
      'image command',
    ],
    [
      "  let content = ''\n  content += parseLgPath({ x: 46, y: 744, size: 72, color: COLORS.black })\n  content += lineCommand({ x1: 126, y1: 754, x2: 126, y2: 808, color: COLORS.line, lineWidth: 1 })\n  content += textCommand({ x: 143, y: 790, text: 'LUID', size: 19, bold: true })\n  content += textCommand({ x: 194, y: 790, text: 'GABRIEL', size: 19 })\n  content += textCommand({ x: 143, y: 770, text: 'CONTADOR', size: 9, bold: true, color: COLORS.blue, tracking: 2.6 })",
      "  let content = ''\n  // Assinatura horizontal oficial, extraída diretamente do Kit Oficial da Marca.\n  content += imageCommand({ name: 'BrandMain', x: 46, y: 756, width: 238, height: 63 })",
      'official header brand',
    ],
    [
      "  content += lineCommand({ x1: 46, y1: 65, x2: 549, y2: 65, color: COLORS.line, lineWidth: 0.8 })\n  content += parseLgPath({ x: 46, y: 18, size: 38, color: COLORS.black })\n  content += textCommand({ x: 92, y: 42, text: 'LUID', size: 10, bold: true })\n  content += textCommand({ x: 120, y: 42, text: 'GABRIEL', size: 10 })\n  content += textCommand({ x: 92, y: 29, text: 'CONTADOR', size: 5.7, bold: true, color: COLORS.blue, tracking: 1.5 })",
      "  content += lineCommand({ x1: 46, y1: 65, x2: 549, y2: 65, color: COLORS.line, lineWidth: 0.8 })\n  // Assinatura reduzida oficial para rodapé.\n  content += imageCommand({ name: 'BrandReduced', x: 46, y: 17, width: 50, height: 43 })",
      'official footer brand',
    ],
    [
      "  const objects = [\n    latin1Bytes('<< /Type /Catalog /Pages 2 0 R >>'),\n    latin1Bytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),\n    latin1Bytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>'),\n    latin1Bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),\n    latin1Bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),\n    concatBytes([latin1Bytes(`<< /Length ${stream.length} >>\\nstream\\n`), stream, latin1Bytes('\\nendstream')]),\n  ]",
      "  const objects = [\n    latin1Bytes('<< /Type /Catalog /Pages 2 0 R >>'),\n    latin1Bytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),\n    latin1Bytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /BrandMain 6 0 R /BrandReduced 7 0 R >> >> /Contents 8 0 R >>'),\n    latin1Bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),\n    latin1Bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),\n    jpegObject(OFFICIAL_MAIN_LOGO),\n    jpegObject(OFFICIAL_REDUCED_LOGO),\n    concatBytes([latin1Bytes(`<< /Length ${stream.length} >>\\nstream\\n`), stream, latin1Bytes('\\nendstream')]),\n  ]",
      'pdf image resources',
    ],
  ])
}
