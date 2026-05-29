import { useState, lazy, Suspense } from 'react'
import { UIProvider } from './context/UIContext.jsx'
import { AppDataProvider } from './context/AppDataContext.jsx'
import { CurrencyProvider } from './context/CurrencyContext.jsx'
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

function ActiveView({ active, onNavigate }) {
  switch (active) {
    case 'transactions': return <TransactionsView />
    case 'budgets':      return <BudgetsView />
    case 'checklist':    return <VoyageView section="checklist" onNavigate={onNavigate} />
    case 'timeline':     return <VoyageView section="timeline"  onNavigate={onNavigate} />
    case 'dashboard':
    default:             return <DashboardView />
  }
}

export default function FinauziApp() {
  const [active, setActive] = useState('dashboard')
  return (
    <AppDataProvider>
      <CurrencyProvider>
        <UIProvider>
          <Shell active={active} onChange={setActive}>
            <Suspense fallback={<Splash />}>
              <ActiveView active={active} onNavigate={setActive} />
            </Suspense>
          </Shell>
        </UIProvider>
      </CurrencyProvider>
    </AppDataProvider>
  )
}
