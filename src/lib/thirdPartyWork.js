export const cnpjDigits = value => String(value || '').replace(/\D/g, '')

export function formatCnpj(value) {
  const digits = cnpjDigits(value).slice(0, 14)
  if (!digits) return ''
  let formatted = digits.slice(0, 2)
  if (digits.length > 2) formatted += `.${digits.slice(2, 5)}`
  if (digits.length > 5) formatted += `.${digits.slice(5, 8)}`
  if (digits.length > 8) formatted += `/${digits.slice(8, 12)}`
  if (digits.length > 12) formatted += `-${digits.slice(12, 14)}`
  return formatted
}

export function thirdPartyError(record = {}) {
  if (!record.terceirizado) return ''
  if (cnpjDigits(record.terceiroCnpj).length !== 14) return 'Informe o CNPJ terceirizado com 14 dígitos.'
  if (!String(record.terceiroNome || '').trim()) return 'Informe o nome ou razão social do CNPJ terceirizado.'
  return ''
}
