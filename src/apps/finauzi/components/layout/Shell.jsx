import { lazy, Suspense } from 'react'
import { Plus } from 'lucide-react'
import AppShell from '@/shared/ui/AppShell.jsx'
import { Toaster } from '@/shared/ui/sonner.jsx'
import { MOBILE_TABS, SIDEBAR_SECTIONS } from '../../config/navigation.js'
import { useUI } from '../../context/UIContext.jsx'
import { useAppData } from '../../context/AppDataContext.jsx'
import { useAuth } from '@/shared/context/AuthContext.jsx'

// Lazy-loaded — heavy date-picker / form chunks only load on first open.
const TransactionFormModal = lazy(() => import('../transactions/TransactionFormModal.jsx'))
const SettingsDrawer = lazy(() => import('./SettingsDrawer.jsx'))

export default function Shell({ active, onChange, children }) {
  const { formOpen, editingTx, closeForm, settingsOpen, closeSettings, openForm, openSettings } = useUI()
  const { settings } = useAppData()
  const { currentUser } = useAuth()

  return (
    <>
      <AppShell
        title="FinAuzi"
        active={active}
        onChange={onChange}
        sections={SIDEBAR_SECTIONS}
        tabs={MOBILE_TABS}
        tabletNav
        sidebarAction={{ label: 'Nouvelle transaction', icon: Plus, onClick: () => openForm(null) }}
        userColors={settings.userColors}
        onUserClick={openSettings}
      >
        {children}
      </AppShell>

      <Suspense fallback={null}>
        {formOpen && (
          <TransactionFormModal
            onClose={closeForm}
            currentUid={currentUser?.uid}
            existing={editingTx}
          />
        )}
        {settingsOpen && <SettingsDrawer open={settingsOpen} onClose={closeSettings} />}
      </Suspense>

      <Toaster />
    </>
  )
}
