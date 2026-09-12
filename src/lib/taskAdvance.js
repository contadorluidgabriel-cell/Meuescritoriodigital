import { addDays, daysBetween } from './operationalIntelligence.js'

export const TASK_ADVANCE_OPTIONS = [0, 1, 3, 5, 7, 10, 15, 30]

export function taskAdvanceDays(task = {}) {
  const raw = Number(task.antecedenciaDias ?? task.antecedencia ?? 0)
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return Math.min(90, Math.round(raw))
}

export function taskAdvanceStart(task = {}) {
  const due = String(task.prazo || '')
  if (!due) return ''
  const days = taskAdvanceDays(task)
  return days ? addDays(due, -days) : due
}

export function taskIsInAdvanceWindow(task = {}, day = '') {
  const due = String(task.prazo || '')
  const start = taskAdvanceStart(task)
  if (!day || !due || !start) return false
  return day >= start && day <= due
}

export function taskAdvanceMeta(task = {}, day = '') {
  const due = String(task.prazo || '')
  const days = taskAdvanceDays(task)
  const start = taskAdvanceStart(task)
  const remaining = due && day ? daysBetween(day, due) : null
  return {
    days,
    start,
    due,
    remaining,
    active: taskIsInAdvanceWindow(task, day),
  }
}
