export const KEYS = {
  clients: 'med_clientes', linkedCompanies: 'med_cnpjs_vinculados', partners: 'med_parceiros_trabalho', tasks: 'med_tarefas', taskTemplates: 'med_tarefas_modelos',
  processes: 'med_processos', obligations: 'med_obrigacoes', processModels: 'med_processos_modelos',
  finance: 'med_financeiro',
  financeAccounts: 'med_financeiro_contas',
  financePayables: 'med_financeiro_pagar',
  financeMovements: 'med_financeiro_movimentos',
  financeCategories: 'med_financeiro_categorias',
  financeRecurrences: 'med_financeiro_recorrencias',
  financeClosings: 'med_financeiro_fechamentos',
  financeCollectionEvents: 'med_financeiro_cobrancas_eventos',
  financeConfig: 'med_financeiro_configuracoes',
  settings: 'med_configuracoes', departments: 'med_departamentos',
  ui: 'med_preferencias', history: 'med_historico_painel', meta: 'med_meta', lastBackup: 'med_last_backup',
}

export const defaults = {
  clients: [], linkedCompanies: [], partners: [], tasks: [], taskTemplates: [], processes: [], obligations: [], processModels: [], finance: [], history: [],
  financeAccounts: [], financePayables: [], financeMovements: [], financeCategories: [], financeRecurrences: [], financeClosings: [], financeCollectionEvents: [],
  financeConfig: { defaultAccountId: '', closingDay: 1, forecastDays: 30 },
  settings: { office: 'Meu Escritório', system: 'Meu Escritório Digital', user: 'Usuário', role: 'Administrador', initials: 'ME', visual: 'macos' },
  departments: ['Fiscal', 'Contábil', 'DP', 'Societário', 'Administrativo'].map(name => ({ name, active: true })),
  ui: {}, meta: { version: '11.1' }, lastBackup: '',
}

export const ACTIVE_USER_KEY = 'med_active_user_id'
const canonicalKeys = new Set(Object.values(KEYS))
const parse = (value, fallback) => { try { return value == null ? fallback : JSON.parse(value) } catch { return fallback } }
const safeUserId = userId => String(userId || '').replace(/[^a-zA-Z0-9_-]/g, '_')
export const userStoragePrefix = userId => userId ? `med_user_${safeUserId(userId)}__` : ''
export const userStorageKey = (key, userId) => userId ? `${userStoragePrefix(userId)}${key}` : key
const extrasKey = userId => `${userStoragePrefix(userId)}legacy_extras`
const updatedKey = userId => `${userStoragePrefix(userId)}updated_at`

function collectGlobalExtras() {
  const extras = {}
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key?.startsWith('med_') || key === ACTIVE_USER_KEY || key.startsWith('med_user_') || canonicalKeys.has(key)) continue
    extras[key] = parse(localStorage.getItem(key), localStorage.getItem(key))
  }
  return extras
}

function removeGlobalExtras() {
  const keys = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (key?.startsWith('med_') && key !== ACTIVE_USER_KEY && !key.startsWith('med_user_') && !canonicalKeys.has(key)) keys.push(key)
  }
  keys.forEach(key => localStorage.removeItem(key))
}

function readUserExtras(userId) {
  if (!userId) return {}
  return parse(localStorage.getItem(extrasKey(userId)), {}) || {}
}

function persistCurrentUserExtras(activeUserId) {
  if (!activeUserId) return
  const current = { ...readUserExtras(activeUserId), ...collectGlobalExtras() }
  localStorage.setItem(extrasKey(activeUserId), JSON.stringify(current))
}

function mirrorUserExtras(userId) {
  removeGlobalExtras()
  Object.entries(readUserExtras(userId)).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
}

function readValue(name, userId) {
  const key = KEYS[name]
  if (!userId) return parse(localStorage.getItem(key), defaults[name])

  const scoped = localStorage.getItem(userStorageKey(key, userId))
  if (scoped != null) return parse(scoped, defaults[name])

  const activeUser = localStorage.getItem(ACTIVE_USER_KEY)
  if (!activeUser || activeUser === String(userId)) return parse(localStorage.getItem(key), defaults[name])
  return structuredClone(defaults[name])
}

export function loadOffice(userId = '') {
  return Object.fromEntries(Object.keys(KEYS).map(name => [name, readValue(name, userId)]))
}

export function getLocalUpdatedAt(userId) {
  if (!userId) return ''
  return localStorage.getItem(updatedKey(userId)) || ''
}

export function saveOffice(office, userId = '', { touch = true, mirror = true } = {}) {
  if (userId) {
    const normalizedUserId = String(userId)
    const previousUser = localStorage.getItem(ACTIVE_USER_KEY)
    if (previousUser && previousUser !== normalizedUserId) persistCurrentUserExtras(previousUser)
    localStorage.setItem(ACTIVE_USER_KEY, normalizedUserId)

    Object.entries(KEYS).forEach(([name, key]) => {
      if (name in office) localStorage.setItem(userStorageKey(key, normalizedUserId), JSON.stringify(office[name]))
    })
    if (touch) localStorage.setItem(updatedKey(normalizedUserId), new Date().toISOString())

    if (mirror) {
      mirrorUserExtras(normalizedUserId)
      Object.entries(KEYS).forEach(([name, key]) => {
        if (name in office) localStorage.setItem(key, JSON.stringify(office[name]))
      })
    }
    return
  }

  Object.entries(KEYS).forEach(([name, key]) => {
    if (name in office) localStorage.setItem(key, JSON.stringify(office[name]))
  })
}

export function officePayload(office, userId = '') {
  const payload = {}
  const activeUser = localStorage.getItem(ACTIVE_USER_KEY)
  const canReadGlobalExtras = !userId || !activeUser || activeUser === String(userId)
  const extras = userId
    ? { ...readUserExtras(userId), ...(canReadGlobalExtras ? collectGlobalExtras() : {}) }
    : collectGlobalExtras()

  if (userId) localStorage.setItem(extrasKey(userId), JSON.stringify(extras))
  Object.assign(payload, extras)
  Object.entries(KEYS).forEach(([name, key]) => { if (name in office) payload[key] = office[name] })
  return payload
}

export function payloadToOffice(payload = {}) {
  const next = { ...defaults }
  Object.entries(KEYS).forEach(([name, key]) => { if (key in payload) next[name] = payload[key] })
  return next
}

export const uid = prefix => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
export const today = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
export const isDone = value => /conclu|recebido/i.test(String(value || ''))