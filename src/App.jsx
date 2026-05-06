import { useState } from 'react'
import { CurrencyProvider } from './context/CurrencyContext.jsx'
import Header from './components/layout/Header.jsx'
import Sidebar from './components/layout/Sidebar.jsx'
import LoginView from './views/LoginView.jsx'
import GlobalView from './views/GlobalView.jsx'
import AustraliaView from './views/AustraliaView.jsx'
import PEAView from './views/PEAView.jsx'
import SettingsView from './views/SettingsView.jsx'
import { accounts } from './data/portfolio.js'

const NET_WORTH = accounts.reduce((s, a) => s + a.balance, 0)
const CHANGE_24H = accounts.reduce((s, a) => s + a.change24h, 0)

function ViewContainer({ active }) {
  switch (active) {
    case 'australia':
      return <AustraliaView />
    case 'pea':
      return <PEAView />
    case 'settings':
      return <SettingsView />
    case 'global':
    default:
      return <GlobalView />
  }
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [active, setActive] = useState('global')
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogin = (userData) => {
    setUser(userData)
    setAuthenticated(true)
  }

  if (!authenticated) {
    return <LoginView onLogin={handleLogin} />
  }

  const handleSelect = (id) => {
    setActive(id)
    setMobileOpen(false)
  }

  return (
    <CurrencyProvider>
      <div className="min-h-screen lg:flex">
        <Sidebar
          active={active}
          onSelect={handleSelect}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <div className="flex-1 min-w-0 flex flex-col">
          <Header
            netWorth={NET_WORTH}
            change24h={CHANGE_24H}
            onOpenMobile={() => setMobileOpen(true)}
          />
          <main className="flex-1 px-4 sm:px-6 py-6 max-w-[1500px] w-full mx-auto">
            <ViewContainer active={active} />
          </main>
        </div>
      </div>
    </CurrencyProvider>
  )
}
