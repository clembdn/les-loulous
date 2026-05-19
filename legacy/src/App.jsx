import { useState, lazy, Suspense } from 'react'
import { CurrencyProvider } from './context/CurrencyContext.jsx'
import { useAuth } from './context/AuthContext.jsx'
import Header from './components/layout/Header.jsx'
import Sidebar from './components/layout/Sidebar.jsx'
import LoginView from './views/LoginView.jsx'
import LoadingScreen from './components/auth/LoadingScreen.jsx'
import AccessDeniedScreen from './components/auth/AccessDeniedScreen.jsx'

const AustraliaView = lazy(() => import('./views/AustraliaView.jsx'))
const EquilibreView = lazy(() => import('./views/EquilibreView.jsx'))
const SettingsView = lazy(() => import('./views/SettingsView.jsx'))
const ChecklistView = lazy(() => import('./views/ChecklistView.jsx'))
const PreDepartView = lazy(() => import('./views/PreDepartView.jsx'))

function ViewFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <span className="inline-block h-6 w-6 border-2 border-brand/30 border-t-brand-glow rounded-full animate-spin" />
    </div>
  )
}

function ViewContainer({ active }) {
  switch (active) {
    case 'settings':
      return <SettingsView />
    case 'checklist':
      return <ChecklistView />
    case 'equilibre':
      return <EquilibreView />
    case 'predepart':
      return <PreDepartView />
    case 'australia':
    default:
      return <AustraliaView />
  }
}

export default function App() {
  const { isLoading, isAuthenticated, isAuthorized } = useAuth()
  const [active, setActive] = useState('australia')
  const [mobileOpen, setMobileOpen] = useState(false)

  // 1. Loading: show premium splash
  if (isLoading) {
    return <LoadingScreen />
  }

  // 2. Not logged in: show login
  if (!isAuthenticated) {
    return <LoginView />
  }

  // 3. Logged in but not authorized: show access denied
  if (!isAuthorized) {
    return <AccessDeniedScreen />
  }

  // 4. Authorized: show app
  const handleSelect = (id) => {
    setActive(id)
    setMobileOpen(false)
  }

  // When the Australia view is active, it renders its own mobile shell
  const isAustraliaMobile = active === 'australia'

  return (
    <CurrencyProvider>
      <div className="min-h-screen lg:flex">
        {/* Sidebar: hide on mobile when Australia is active (it has its own bottom nav) */}
        <div className={isAustraliaMobile ? 'hidden lg:contents' : 'contents'}>
          <Sidebar
            active={active}
            onSelect={handleSelect}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header: hide on mobile when Australia is active (it has its own sticky header) */}
          <div className={isAustraliaMobile ? 'hidden lg:block' : ''}>
            <Header
              onOpenMobile={() => setMobileOpen(true)}
            />
          </div>
          <main className={`flex-1 max-w-[1500px] w-full mx-auto ${
            isAustraliaMobile
              ? 'lg:px-4 lg:sm:px-6 lg:py-6'
              : 'px-4 sm:px-6 py-6'
          }`}>
            <Suspense fallback={<ViewFallback />}>
              <ViewContainer active={active} />
            </Suspense>
          </main>
        </div>
      </div>
    </CurrencyProvider>
  )
}
