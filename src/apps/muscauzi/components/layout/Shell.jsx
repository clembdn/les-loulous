import { Dumbbell } from 'lucide-react'
import AppShell from '@/shared/ui/AppShell.jsx'
import { Toaster } from '@/shared/ui/sonner.jsx'
import { MUSC_TABS, SIDEBAR_SECTIONS, getTab } from '../../config/navigation.js'

// Coquille de MuscAuzi. Comme Cook'It et FinAuzi : une enveloppe fine autour de
// la coquille partagée, pour que la racine de l'app n'ait à s'occuper que de la
// vue affichée.
//
// `sidebarAction` porte l'action principale du desktop — la séance du jour est
// à un clic depuis n'importe quel écran, sans avoir à revenir dans l'onglet.
export default function Shell({ active, onChange, sidebarAction, children }) {
  return (
    <AppShell
      title="MuscAuzi"
      icon={Dumbbell}
      heading={getTab(active).label}
      active={active}
      onChange={onChange}
      sections={SIDEBAR_SECTIONS}
      tabs={MUSC_TABS}
      sidebarAction={sidebarAction}
    >
      {children}
      <Toaster />
    </AppShell>
  )
}
