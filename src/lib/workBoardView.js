const uniqueItems = items => [...new Map(items.map(item => [item.key, item])).values()]
const matchesType = (item, type) => type === 'all' || (type === 'finance' ? ['finance', 'payable', 'partner'].includes(item.type) : item.type === type)

/** Apply a status first, then a work type; keep each record in its first group. */
export function selectWorkBoard(view, { scope = 'all', type = 'all' } = {}) {
  const sources = { all: view.items, overdue: view.overdue, critical: view.critical, unscheduled: view.unscheduled }
  const scoped = uniqueItems(sources[scope] || view.items || [])
  const counts = { all: scoped.length }
  for (const kind of ['task', 'process', 'obligation', 'finance']) {
    counts[kind] = scoped.filter(item => matchesType(item, kind)).length
  }
  const items = scoped.filter(item => matchesType(item, type))
  const selected = new Set(items.map(item => item.key))
  const seen = new Set()
  const sourceGroups = scope === 'unscheduled'
    ? [{ key: 'unscheduled', label: 'Sem data', items: scoped }]
    : view.groups || []
  const groups = sourceGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (!selected.has(item.key) || seen.has(item.key)) return false
      seen.add(item.key)
      return true
    }),
  })).filter(group => group.items.length)
  return { items, groups, counts }
}

/** Deduplicate complete metadata segments without dropping balances or dates. */
export function workItemSummary(item) {
  const seen = new Set()
  return [item.client || 'Escritório', ...String(item.subtitle || '').split('·')]
    .map(value => String(value).trim())
    .filter(value => {
      const key = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    }).join(' · ')
}
