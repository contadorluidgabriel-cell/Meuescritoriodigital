import { useEffect, useMemo, useState } from 'react'
import { Icon } from './ui/SaasUI.jsx'
import { collectCommandCenterItems } from '../lib/operationalIntelligence.js'
import { today } from '../lib/storage.js'
import WorkHorizonBoard from './WorkHorizonBoard.jsx'
import PendingInbox from './PendingInbox.jsx'
import '../operational-v12-3.css'

// MED_INFORMATION_ARCHITECTURE_V12_2 - compatibility marker for legacy build patches
// MED_INFORMATION_ARCHITECTURE_V12_3
const tabs = [
  ['today', 'Hoje'],
  ['pending', 'Pendências'],
  ['upcoming', 'Próximos'],
]

const normalizeTab = value => value === 'pending' ? 'pending' : value === 'week' || value === 'upcoming' ? 'upcoming' : 'today'
const identity = item => item.type === 'obligation' ? `obligation:${item.id}` : item.key
const unique = items => [...new Map(items.map(item => [identity(item), item])).values()]
const operational = item => ['task', 'process', 'obligation'].includes(item.type)
const actionDate = item => String(item.actionDate || item.effectiveDate || item.planned || item.due || '')

export default function OperationalCommandCenter({ office, update, onOpenItem, onNavigate, initialTab = 'today' }) {
  const day = today()
  const [tab, setTab] = useState(() => normalizeTab(initialTab))
  const [notice, setNotice] = useState('')

  useEffect(() => { setTab(normalizeTab(initialTab)) }, [initialTab])
  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 3000)
    return () => clearTimeout(timer)
  }, [notice])

  const items = useMemo(() => unique(collectCommandCenterItems(office, { day, daysBefore: 60 }).filter(operational)), [office, day])
  const summary = useMemo(() => ({
    overdue: items.filter(item => actionDate(item) && actionDate(item) < day).length,
    today: items.filter(item => actionDate(item) === day).length,
    critical: items.filter(item => item.level === 'critical').length,
  }), [items, day])

  const heroText = summary.overdue
    ? `${summary.overdue} atrasado(s) vêm primeiro. Depois há ${summary.today} item(ns) para o expediente de hoje.`
    : summary.today
      ? `${summary.today} item(ns) operacional(is) precisam de ação hoje.`
      : summary.critical
        ? `${summary.critical} item(ns) crítico(s) precisam de revisão.`
        : 'Nenhuma ação operacional urgente para hoje.'

  return <div className="occ-shell occ-v123">
    {notice ? <div className="occ-toast">{notice}</div> : null}

    <header className="occ-hero">
      <div><span className="occ-eyebrow">Mesa de trabalho</span><h1>Meu Dia</h1><p>{heroText}</p></div>
      <div className="occ-hero-actions"><button type="button" onClick={() => onNavigate('tarefas')}><Icon name="tasks" size={17} /> Tarefas</button><button type="button" className="secondary" onClick={() => onNavigate('calendario')}><Icon name="calendar" size={17} /> Calendário</button></div>
    </header>

    <nav className="occ-tabs" aria-label="Visões do Meu Dia">
      {tabs.map(([id, label]) => <button type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}>{label}</button>)}
    </nav>

    {tab === 'today' ? <WorkHorizonBoard office={office} update={update} onOpenItem={onOpenItem} onNavigate={onNavigate} onShowPending={() => setTab('pending')} day={day} mode="today" embedded /> : null}

    {tab === 'pending' ? <PendingInbox office={office} update={update} onOpenItem={onOpenItem} onNavigate={onNavigate} onNotice={setNotice} day={day} /> : null}

    {tab === 'upcoming' ? <WorkHorizonBoard office={office} update={update} onOpenItem={onOpenItem} onNavigate={onNavigate} onShowPending={() => setTab('pending')} day={day} mode="upcoming" embedded /> : null}
  </div>
}
