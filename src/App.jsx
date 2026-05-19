import { useState, lazy, Suspense } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { UIProvider } from './context/UIContext.jsx'
import LoginView from './views/LoginView.jsx'
import Shell from './components/layout/Shell.jsx'

const DashboardView = lazy(() => import('./views/DashboardView.jsx'))
const TransactionsView = lazy(() => import('./views/TransactionsView.jsx'))
const BudgetsView = lazy(() => import('./views/BudgetsView.jsx'))
const VoyageView = lazy(() => import('./views/VoyageView.jsx'))

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="h-7 w-7 border-2 border-white/15 border-t-white/80 rounded-full animate-spin" />
    </div>
  )
}

function Forbidden() {
  const { logout } = useAuth()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6 fade-in">
      <h1 className="text-xl font-semibold text-white">Accès refusé</h1>
      <p className="text-sm text-white/40 max-w-xs">
        Cet espace est privé — seuls Clément et Lise y ont accès.
      </p>
      <button
        onClick={logout}
        className="text-xs text-white/60 hover:text-white underline-offset-4 hover:underline transition"
      >
        Se déconnecter
      </button>
    </div>
  )
}

function ActiveView({ active }) {
  switch (active) {
    case 'transactions': return <TransactionsView />
    case 'budgets':      return <BudgetsView />
    case 'voyage':       return <VoyageView />
    case 'dashboard':
    default:             return <DashboardView />
  }
}

export default function App() {
  const { isLoading, isAuthenticated, isAuthorized } = useAuth()
  const [active, setActive] = useState('dashboard')

  if (isLoading) return <Splash />
  if (!isAuthenticated) return <LoginView />
  if (!isAuthorized) return <Forbidden />

  return (
    <UIProvider>
      <Shell active={active} onChange={setActive}>
        <Suspense fallback={<Splash />}>
          <ActiveView active={active} />
        </Suspense>
      </Shell>
    </UIProvider>
  )
}
