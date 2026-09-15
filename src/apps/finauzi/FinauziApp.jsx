import { lazy, Suspense } from 'react'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import { useTabRoute } from '@/shared/lib/useTabRoute.js'
import { DEFAULT_TAB, TAB_IDS } from './config/navigation.js'
import { UIProvider } from './context/UIContext.jsx'
import { AppDataProvider } from './context/AppDataContext.jsx'
import { CurrencyProvider } from './context/CurrencyContext.jsx'
import Shell from './components/layout/Shell.jsx'

const DashboardView = lazy(() => import('./views/DashboardView.jsx'))
const TransactionsView = lazy(() => import('./views/TransactionsView.jsx'))
const BudgetsView = lazy(() => import('./views/BudgetsView.jsx'))
const JointAccountView = lazy(() => import('./views/JointAccountView.jsx'))
const BalanceView = lazy(() => import('./views/BalanceView.jsx'))
const ImportView = lazy(() => import('./views/ImportView.jsx'))

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="h-7 w-7 border-2 border-white/15 border-t-white/80 rounded-full animate-spin" />
    </div>
  )
}

function ActiveView({ active, onNavigate }) {
  switch (active) {
    case 'transactions': return <TransactionsView onNavigate={onNavigate} />
    case 'import':       return <ImportView />
    case 'budgets':      return <BudgetsView />
    case 'joint':        return <JointAccountView onNavigate={onNavigate} />
    case 'balance':      return <BalanceView onNavigate={onNavigate} />
    case 'dashboard':
    default:             return <DashboardView />
  }
}

export default function FinauziApp() {
  useAppTheme('dark', 'amber')
  // L'écran courant est dans l'URL (/finauzi/budgets) : chaque écran a son
  // entrée d'historique, donc « retour » revient à l'écran précédent de l'app
  // au lieu de la quitter d'un coup.
  const { tab: active, goTab } = useTabRoute('/finauzi', TAB_IDS, DEFAULT_TAB)
  return (
    <AppDataProvider>
      <CurrencyProvider>
        <UIProvider>
          <Shell active={active} onChange={goTab}>
            <Suspense fallback={<Splash />}>
              <ActiveView active={active} onNavigate={goTab} />
            </Suspense>
          </Shell>
        </UIProvider>
      </CurrencyProvider>
    </AppDataProvider>
  )
}
