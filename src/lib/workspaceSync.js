import { supabase } from './supabase.js'

export const ACTIVE_WORKSPACE_KEY = 'med_active_workspace_id'

const arrayNames = new Set(['clients', 'linkedCompanies', 'partners', 'tasks', 'taskTemplates', 'processes', 'obligations', 'processModels', 'finance', 'departments', 'history'])
const officeNames = ['clients', 'linkedCompanies', 'partners', 'tasks', 'taskTemplates', 'processes', 'obligations', 'processModels', 'finance', 'settings', 'departments', 'ui', 'history', 'meta', 'lastBackup']
const clone = value => value == null ? value : structuredClone(value)
const recordKey = (name, record = {}) => name === 'departments' ? String(record.name || '') : String(record.id || '')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

async function invoke(action, body = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
  const { data, error } = await supabase.functions.invoke('office-workspace', {
    body: { action, ...body },
    headers: { Authorization: `Bearer ${token}` },
  })
  if (error) throw new Error(error.message || 'Falha ao acessar o escritório.')
  if (data?.error) throw new Error(data.message || 'Falha ao acessar o escritório.')
  return data
}

export function preferredWorkspaceId() {
  return localStorage.getItem(ACTIVE_WORKSPACE_KEY) || ''
}

export function rememberWorkspace(workspaceId = '') {
  if (workspaceId) localStorage.setItem(ACTIVE_WORKSPACE_KEY, String(workspaceId))
}

export async function loadWorkspace(workspaceId = '') {
  const data = await invoke('load', { workspace_id: workspaceId || preferredWorkspaceId() })
  if (data?.workspace?.id) rememberWorkspace(data.workspace.id)
  return data
}

export async function saveWorkspace(workspaceId, patch) {
  const data = await invoke('save', { workspace_id: workspaceId, patch })
  if (data?.workspace?.id) rememberWorkspace(data.workspace.id)
  return data
}

export async function loadWorkspaceContext(workspaceId = '') {
  const data = await invoke('context', { workspace_id: workspaceId || preferredWorkspaceId() })
  if (data?.workspace?.id) rememberWorkspace(data.workspace.id)
  return data
}

export const listWorkspaceMembers = workspaceId => invoke('members', { workspace_id: workspaceId })
export const inviteWorkspaceMember = (workspaceId, values) => invoke('invite', { workspace_id: workspaceId, ...values })
export const updateWorkspaceMember = (workspaceId, values) => invoke('update_member', { workspace_id: workspaceId, ...values })
export const removeWorkspaceMember = (workspaceId, memberId) => invoke('remove_member', { workspace_id: workspaceId, member_id: memberId })
export const loadWorkspaceAudit = workspaceId => invoke('audit', { workspace_id: workspaceId })

export function roleLabel(role = '') {
  if (role === 'admin') return 'Administrador'
  if (role === 'partner') return 'Parceiro'
  return 'Colaborador'
}

export function isAdminAccess(access = {}) { return access?.membership?.role === 'admin' }
export function isPartnerAccess(access = {}) { return access?.membership?.role === 'partner' }

function allowedNames(access = {}) {
  const membership = access.membership || access || {}
  const role = membership.role || 'collaborator'
  const permissions = membership.permissions || {}
  if (role === 'admin') return new Set(officeNames)
  if (role === 'partner') return new Set(['tasks', 'processes', 'obligations'])
  const result = new Set(['history'])
  if (permissions.tasks !== false) result.add('tasks')
  if (permissions.tasks !== false) result.add('taskTemplates')
  if (permissions.processes !== false) { result.add('processes'); result.add('processModels') }
  if (permissions.obligations !== false) result.add('obligations')
  if (permissions.clients && permissions.manage_clients) { result.add('clients'); result.add('linkedCompanies') }
  if (permissions.finance && permissions.finance_edit) result.add('finance')
  return result
}

function arrayPatch(name, before = [], after = []) {
  const beforeMap = new Map((Array.isArray(before) ? before : []).map(item => [recordKey(name, item), item]).filter(([key]) => key))
  const afterMap = new Map((Array.isArray(after) ? after : []).map(item => [recordKey(name, item), item]).filter(([key]) => key))
  const upserts = []
  const deletes = []
  for (const [key, item] of afterMap) {
    const previous = beforeMap.get(key)
    if (!previous || !same(previous, item)) upserts.push(clone(item))
  }
  for (const key of beforeMap.keys()) if (!afterMap.has(key)) deletes.push(key)
  return upserts.length || deletes.length ? { upserts, deletes } : null
}

export function buildOfficePatch(before = {}, after = {}, access = {}) {
  const allowed = allowedNames(access)
  const patch = {}
  for (const name of officeNames) {
    if (!allowed.has(name)) continue
    if (arrayNames.has(name)) {
      const change = arrayPatch(name, before[name], after[name])
      if (change) patch[name] = change
      continue
    }
    if (!same(before[name], after[name])) patch[name] = { replace: clone(after[name]) }
  }
  return patch
}

export function hasOfficePatch(patch = {}) {
  return Object.keys(patch || {}).length > 0
}
