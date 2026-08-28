import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
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
import './saas-system-v11.css'
import './mobile-saas-v11.css'
import './mobile-nav-fix.css'
import './client-mobile-fix.css'
import './linked-companies.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
