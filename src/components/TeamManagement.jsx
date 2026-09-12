// MED_USER_ACCESS_V2
import { useState } from 'react'
import UserAccessManager from './UserAccessManager.jsx'
import WorkDistributionV2 from './WorkDistributionV2.jsx'
import '../work-distribution.css'

export default function TeamManagement(props) {
  const [view, setView] = useState('users')
  const [distributionTarget, setDistributionTarget] = useState({ userId: '', mode: '', request: 0 })

  function openDistribution(userId = '', mode = '') {
    setDistributionTarget(current => ({ userId: String(userId || ''), mode, request: current.request + 1 }))
    setView('distribution')
  }

  function chooseView(next) {
    setView(next)
    if (next !== 'distribution') setDistributionTarget(current => ({ ...current, userId: '', mode: '' }))
  }

  return <div className="team-management-v2">
    <nav className="team-management-switch" aria-label="Gestão da equipe">
      <button type="button" className={view === 'users' ? 'active' : ''} onClick={() => chooseView('users')}>Usuários</button>
      <button type="button" className={view === 'distribution' ? 'active' : ''} onClick={() => chooseView('distribution')}>Distribuição</button>
    </nav>
    {view === 'users'
      ? <UserAccessManager {...props} onOpenDistribution={openDistribution} />
      : <WorkDistributionV2 {...props} focusUserId={distributionTarget.userId} focusMode={distributionTarget.mode} focusRequest={distributionTarget.request} />}
  </div>
}
