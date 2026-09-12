// MED_USER_ACCESS_V2
import { useState } from 'react'
import UserAccessManager from './UserAccessManager.jsx'
import WorkDistribution from './WorkDistribution.jsx'
import '../work-distribution.css'

export default function TeamManagement(props) {
  const [view, setView] = useState('users')

  return <div className="team-management-v2">
    <nav className="team-management-switch" aria-label="Gestão da equipe">
      <button type="button" className={view === 'users' ? 'active' : ''} onClick={() => setView('users')}>Usuários</button>
      <button type="button" className={view === 'distribution' ? 'active' : ''} onClick={() => setView('distribution')}>Distribuição</button>
    </nav>
    {view === 'users' ? <UserAccessManager {...props} /> : <WorkDistribution {...props} />}
  </div>
}
