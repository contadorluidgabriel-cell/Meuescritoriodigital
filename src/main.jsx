import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './legacy-route-bridge.js'
import './styles.css'
import './legacy-host.css'
import './migration-shell.css'
import './login-enhancements.css'
import './clients-react.css'
import './tasks-react.css'
import './dashboard-react.css'
import './calendar-react.css'
import './obligations-react.css'
import './processes-react.css'
import './visual-polish-v11.css'
import './nav-icons-v11.css'
import './design-refinement-v11.css'
import './premium-structure-v11.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
