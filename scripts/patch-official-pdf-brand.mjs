import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label, path) {
  if (!source.includes(from)) throw new Error(`Official PDF brand patch failed (${label}) in ${path}`)
  return source.replace(from, to)
}

export function applyOfficialPdfBrandPatch(root) {
  const path = `${root}src/lib/financePdf.js`
  let source = readFileSync(path, 'utf8')
  if (source.includes('const OFFICIAL_MAIN_LOGO = { width: 240, height: 64')) return

  const mainBase64 = readFileSync(`${root}src/assets/brand-main.jpg`).toString('base64')
  const reducedBase64 = readFileSync(`${root}src/assets/brand-reduced.jpg`).toString('base64')
  source = replaceRequired(
    source,
    "import { paymentSummary } from './financePro.js'",
    `import { paymentSummary } from './financePro.js'\n\nconst OFFICIAL_MAIN_LOGO = { width: 240, height: 64, base64: '${mainBase64}' }\nconst OFFICIAL_REDUCED_LOGO = { width: 80, height: 68, base64: '${reducedBase64}' }`,
    'brand assets', path,
  )

  source = replaceRequired(
    source,
    "function concatBytes(chunks) {\n  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0)\n  const result = new Uint8Array(size)\n  let offset = 0\n  chunks.forEach(chunk => { result.set(chunk, offset); offset += chunk.length })\n  return result\n}",
    "function concatBytes(chunks) {\n  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0)\n  const result = new Uint8Array(size)\n  let offset = 0\n  chunks.forEach(chunk => { result.set(chunk, offset); offset += chunk.length })\n  return result\n}\n\nfunction base64Bytes(value = '') {\n  const binary = atob(value)\n  const result = new Uint8Array(binary.length)\n  for (let index = 0; index < binary.length; index += 1) result[index] = binary.charCodeAt(index)\n  return result\n}\n\nfunction jpegObject(asset) {\n  const bytes = base64Bytes(asset.base64)\n  return concatBytes([latin1Bytes(\`<< /Type /XObject /Subtype /Image /Width \${asset.width} /Height \${asset.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length \${bytes.length} >>\\nstream\\n\`), bytes, latin1Bytes('\\nendstream')])\n}",
    'jpeg helpers', path,
  )

  source = replaceRequired(
    source,
    "function lineCommand({ x1, y1, x2, y2, color = COLORS.line, lineWidth = 1 }) {\n  return \`${color} RG ${lineWidth} w ${x1} ${y1} m ${x2} ${y2} l S\\n\`\n}",
    "function lineCommand({ x1, y1, x2, y2, color = COLORS.line, lineWidth = 1 }) {\n  return \`${color} RG ${lineWidth} w ${x1} ${y1} m ${x2} ${y2} l S\\n\`\n}\n\nfunction imageCommand({ name, x, y, width, height }) {\n  return \`q ${width} 0 0 ${height} ${x} ${y} cm /${name} Do Q\\n\`\n}",
    'image command', path,
  )

  source = replaceRequired(
    source,
    "  content += parseLgPath({ x: 42, y: 25, size: 34, color: COLORS.ink })",
    "  content += imageCommand({ name: 'BrandReduced', x: 42, y: 24, width: 40, height: 34 })",
    'official footer brand', path,
  )

  source = replaceRequired(
    source,
    "  const objects = [\n    latin1Bytes('<< /Type /Catalog /Pages 2 0 R >>'),\n    latin1Bytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),\n    latin1Bytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>'),\n    latin1Bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),\n    latin1Bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),\n    concatBytes([latin1Bytes(\`<< /Length \${stream.length} >>\\nstream\\n\`), stream, latin1Bytes('\\nendstream')]),\n  ]",
    "  const objects = [\n    latin1Bytes('<< /Type /Catalog /Pages 2 0 R >>'),\n    latin1Bytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),\n    latin1Bytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /BrandMain 6 0 R /BrandReduced 7 0 R >> >> /Contents 8 0 R >>'),\n    latin1Bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),\n    latin1Bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),\n    jpegObject(OFFICIAL_MAIN_LOGO),\n    jpegObject(OFFICIAL_REDUCED_LOGO),\n    concatBytes([latin1Bytes(\`<< /Length \${stream.length} >>\\nstream\\n\`), stream, latin1Bytes('\\nendstream')]),\n  ]",
    'pdf image resources', path,
  )
  writeFileSync(path, source)
}
