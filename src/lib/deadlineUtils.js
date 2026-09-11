import { addDays } from './operationalIntelligence.js'

export function deadlineMatchesScope({ due = '', scope = 'all', day = '', waiting = false, completed = false } = {}) {
  if (completed) return false
  const value = String(due || '')
  if (scope === 'all') return true
  if (scope === 'waiting') return Boolean(waiting)
  if (!value) return false

  if (scope === 'overdue') return value < day
  if (scope === 'today') return value === day
  if (scope === 'tomorrow') return value === addDays(day, 1)
  if (scope === 'week') return value >= day && value <= addDays(day, 6)
  if (scope === 'month') return value >= day && value <= addDays(day, 29)
  return true
}
