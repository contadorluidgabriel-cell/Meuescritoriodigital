// Departamentos são classificações do escritório, não recursos ativáveis.
export const DEFAULT_DEPARTMENT_NAMES = Object.freeze([
  'Fiscal', 'Contábil', 'DP', 'Societário', 'Administrativo', 'Comercial',
])

const departmentKey = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')

export function normalizeDepartments(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_DEPARTMENT_NAMES
  const departments = []
  const seen = new Set()

  for (const item of source) {
    const name = String(typeof item === 'string' ? item : item?.name || '').trim()
    const key = departmentKey(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    // Mantemos os demais campos legados, sem excluir áreas previamente desativadas.
    departments.push({ ...(item && typeof item === 'object' ? item : {}), name: key === 'comercial' ? 'Comercial' : name, active: true })
  }

  if (!seen.has('comercial')) departments.push({ name: 'Comercial', active: true })
  return departments
}
