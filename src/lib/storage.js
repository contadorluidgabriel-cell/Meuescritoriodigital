export const KEYS = {
  clients: 'med_clientes', tasks: 'med_tarefas', taskTemplates: 'med_tarefas_modelos',
  processes: 'med_processos', obligations: 'med_obrigacoes', processModels: 'med_processos_modelos',
  finance: 'med_financeiro', settings: 'med_configuracoes', departments: 'med_departamentos',
  ui: 'med_preferencias', history: 'med_historico_painel', meta: 'med_meta', lastBackup: 'med_last_backup',
}

export const defaults = {
  clients: [], tasks: [], taskTemplates: [], processes: [], obligations: [], processModels: [], finance: [], history: [],
  settings: { office: 'Meu Escritório', system: 'Meu Escritório Digital', user: 'Usuário', role: 'Administrador', initials: 'ME', visual: 'macos' },
  departments: ['Fiscal', 'Contábil', 'DP', 'Societário', 'Administrativo'].map(name => ({ name, active: true })),
  ui: {}, meta: { version: '11.1' }, lastBackup: '',
}

const parse = (value, fallback) => { try { return value == null ? fallback : JSON.parse(value) } catch { return fallback } }
export function loadOffice() {
  return Object.fromEntries(Object.entries(KEYS).map(([name, key]) => [name, parse(localStorage.getItem(key), defaults[name])]))
}
export function saveOffice(office) {
  Object.entries(KEYS).forEach(([name, key]) => {
    if (name in office) localStorage.setItem(key, JSON.stringify(office[name]))
  })
}
export function officePayload(office) {
  const payload = {}
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key?.startsWith('med_')) continue
    payload[key] = parse(localStorage.getItem(key), localStorage.getItem(key))
  }
  Object.entries(KEYS).forEach(([name, key]) => { if (name in office) payload[key] = office[name] })
  return payload
}
export function payloadToOffice(payload = {}) {
  const next = { ...defaults }
  Object.entries(KEYS).forEach(([name, key]) => { if (key in payload) next[name] = payload[key] })
  return next
}
export const uid = prefix => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
export const today = () => new Date().toISOString().slice(0, 10)
export const isDone = value => /conclu|recebido/i.test(String(value || ''))
