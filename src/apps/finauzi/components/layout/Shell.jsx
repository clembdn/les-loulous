import { lazy, Suspense } from 'react'
import BottomNav from './BottomNav.jsx'
import Sidebar from './Sidebar.jsx'
import { Toaster } from '@/shared/ui/sonner.jsx'
import { MOBILE_TABS } from '../../config/navigation.js'
import { cn } from '@/shared/lib/utils.js'
import { useUI } from '../../context/UIContext.jsx'
import { useAuth } from '@/shared/context/AuthContext.jsx'

// Lazy-loaded — heavy date-picker / form chunks only load on first open.
const TransactionFormModal = lazy(() => import('../transactions/TransactionFormModal.jsx'))
const SettingsDrawer = lazy(() => import('./SettingsDrawer.jsx'))

export default function Shell({ active, onChange, children }) {
  const { formOpen, editingTx, closeForm, settingsOpen, closeSettings } = useUI()
  const { currentUser } = useAuth()

  return (
    <div className="min-h-screen text-white lg:flex">
      <Sidebar active={active} onChange={onChange} />

      <div className="flex-1 min-w-0 lg:ml-60">
        {/* Tablet top nav (sm to lg) */}
        <header className="hidden sm:block lg:hidden sticky top-0 z-20 bg-[#0B0E13]/85 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-6">
            <p className="text-sm font-semibold tracking-tight text-white">FinAuzi</p>
            <div className="flex items-center gap-1 ml-auto">
              {MOBILE_TABS.map((tab) => {
                const Icon = tab.icon
                const isActive = tab.activeFor.includes(active)
                return (
                  <button
                    key={tab.id}
                    onClick={() => onChange(tab.route)}
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition',
                      isActive
                        ? 'bg-white/[0.06] text-white'
                        : 'text-white/40 hover:text-white hover:bg-white/[0.03]',
                    )}
                  >
                    <Icon size={15} strokeWidth={isActive ? 2.3 : 2} />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        </header>

        <main>{children}</main>

        <BottomNav active={active} onChange={onChange} />
      </div>

      <Suspense fallback={null}>
        {formOpen && (
          <TransactionFormModal
            onClose={closeForm}
            currentUid={currentUser?.uid}
            existing={editingTx}
          />
        )}
        {settingsOpen && (
          <SettingsDrawer open={settingsOpen} onClose={closeSettings} />
        )}
      </Suspense>

      <Toaster />
    </div>
  )
}
