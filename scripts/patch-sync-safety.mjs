import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label, path) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`Sync safety patch failed (${label}) in ${path}`)
  return source.replace(from, to)
}

export function applySyncSafetyPatch(root) {
  const taskProgressPath = `${root}src/lib/taskProgress.js`
  let taskProgress = readFileSync(taskProgressPath, 'utf8')
  taskProgress = replaceRequired(
    taskProgress,
    `export function reconcileExternalTaskPayload(remoteTasks = [], currentTasks = []) {
  const currentById = new Map((currentTasks || []).map(task => [String(task.id), task]))
  return (remoteTasks || []).map(remote => {
    const previous = currentById.get(String(remote.id))
    if (!previous) return remote
    const merged = { ...remote }

    for (const key of preservedKeys) {
      if (Object.prototype.hasOwnProperty.call(previous, key)) {
        merged[key] = structuredClone(previous[key])
      }
    }

    if (!isDone(previous.status) && isDone(merged.status) && taskCompletionBlocker({ ...previous, ...merged })) {
      merged.status = previous.status
    }
    return merged
  })
}`,
    `export function reconcileExternalTaskPayload(remoteTasks = [], currentTasks = []) {
  const remoteById = new Map((Array.isArray(remoteTasks) ? remoteTasks : []).filter(task => task?.id).map(task => [String(task.id), task]))
  const currentIds = new Set((Array.isArray(currentTasks) ? currentTasks : []).filter(task => task?.id).map(task => String(task.id)))
  const next = (Array.isArray(currentTasks) ? currentTasks : []).map(previous => {
    const remote = remoteById.get(String(previous.id))
    if (!remote) return structuredClone(previous)
    const merged = { ...structuredClone(previous), ...remote }

    for (const key of preservedKeys) {
      if (Object.prototype.hasOwnProperty.call(previous, key)) {
        merged[key] = structuredClone(previous[key])
      }
    }

    if (!isDone(previous.status) && isDone(merged.status) && taskCompletionBlocker({ ...previous, ...merged })) {
      merged.status = previous.status
    }
    return merged
  })

  for (const remote of remoteById.values()) {
    if (!currentIds.has(String(remote.id))) next.push(structuredClone(remote))
  }
  return next
}`,
    'non-destructive external task reconciliation',
    taskProgressPath,
  )
  writeFileSync(taskProgressPath, taskProgress)

  const workspacePath = `${root}src/lib/workspaceSync.js`
  let workspace = readFileSync(workspacePath, 'utf8')
  workspace = replaceRequired(
    workspace,
    `function arrayPatch(name, before = [], after = []) {
  const beforeMap = new Map((Array.isArray(before) ? before : []).map(item => [recordKey(name, item), item]).filter(([key]) => key))
  const afterMap = new Map((Array.isArray(after) ? after : []).map(item => [recordKey(name, item), item]).filter(([key]) => key))
  const upserts = [], deletes = []
  for (const [key, item] of afterMap) { const previous = beforeMap.get(key); if (!previous || !same(previous, item)) upserts.push(clone(item)) }
  for (const key of beforeMap.keys()) if (!afterMap.has(key)) deletes.push(key)
  return upserts.length || deletes.length ? { upserts, deletes } : null
}`,
    `function arrayPatch(name, before = [], after = [], { allowDeletes = true } = {}) {
  const beforeMap = new Map((Array.isArray(before) ? before : []).map(item => [recordKey(name, item), item]).filter(([key]) => key))
  const afterMap = new Map((Array.isArray(after) ? after : []).map(item => [recordKey(name, item), item]).filter(([key]) => key))
  const upserts = [], deletes = []
  for (const [key, item] of afterMap) { const previous = beforeMap.get(key); if (!previous || !same(previous, item)) upserts.push(clone(item)) }
  if (allowDeletes) for (const key of beforeMap.keys()) if (!afterMap.has(key)) deletes.push(key)
  return upserts.length || deletes.length ? { upserts, deletes } : null
}`,
    'optional collection deletes',
    workspacePath,
  )
  workspace = replaceRequired(
    workspace,
    `export function buildOfficePatch(before = {}, after = {}, access = {}) {
  const allowed = allowedNames(access), patch = {}
  for (const name of officeNames) {
    if (!allowed.has(name)) continue
    if (arrayNames.has(name)) { const change = arrayPatch(name, before[name], after[name]); if (change) patch[name] = change }
    else if (!same(before[name], after[name])) patch[name] = { replace: clone(after[name]) }
  }
  return patch
}

export function hasOfficePatch(patch = {}) { return Object.keys(patch || {}).length > 0 }`,
    `export function buildOfficePatch(before = {}, after = {}, access = {}, { allowDeletes = true } = {}) {
  const allowed = allowedNames(access), patch = {}
  for (const name of officeNames) {
    if (!allowed.has(name)) continue
    if (arrayNames.has(name)) { const change = arrayPatch(name, before[name], after[name], { allowDeletes }); if (change) patch[name] = change }
    else if (!same(before[name], after[name])) patch[name] = { replace: clone(after[name]) }
  }
  return patch
}

export function buildOfficeRecoveryPatch(before = {}, after = {}, access = {}) {
  return buildOfficePatch(before, after, access, { allowDeletes: false })
}

export function hasOfficePatch(patch = {}) { return Object.keys(patch || {}).length > 0 }`,
    'recovery patch without deletes',
    workspacePath,
  )
  writeFileSync(workspacePath, workspace)

  const officePath = `${root}src/hooks/useOfficeData.js`
  let office = readFileSync(officePath, 'utf8')
  office = replaceRequired(
    office,
    `import { buildOfficePatch, hasOfficePatch, isAdminAccess, loadWorkspace, preferredWorkspaceId, saveWorkspace } from '../lib/workspaceSync.js'`,
    `import { buildOfficePatch, buildOfficeRecoveryPatch, hasOfficePatch, isAdminAccess, loadWorkspace, preferredWorkspaceId, saveWorkspace } from '../lib/workspaceSync.js'`,
    'recovery patch import',
    officePath,
  )
  office = replaceRequired(
    office,
    `        const patch = buildOfficePatch(remote, local, nextAccess)`,
    `        const patch = buildOfficeRecoveryPatch(remote, local, nextAccess)`,
    'non-destructive hydration recovery',
    officePath,
  )
  writeFileSync(officePath, office)
}
