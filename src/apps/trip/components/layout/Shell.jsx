import { useMemo } from 'react'
import { Plane } from 'lucide-react'
import AppShell from '@/shared/ui/AppShell.jsx'
import { MOBILE_TABS, sidebarSections } from '../../config/navigation.js'

// Coquille de Trip Planner : la coquille partagée, nourrie selon qu'un voyage
// est ouvert (`trip`) ou non (la liste). Le titre du voyage sert d'en-tête
// mobile et de groupe dans la sidebar.
export default function Shell({ trip = null, active, onChange, sidebarAction, children }) {
  const sections = useMemo(() => sidebarSections(trip), [trip])
  return (
    <AppShell
      title="Trip Planner"
      icon={Plane}
      heading={trip ? trip.title : 'Trip Planner'}
      active={active}
      onChange={onChange}
      sections={sections}
      tabs={trip ? MOBILE_TABS : []}
      sidebarAction={sidebarAction}
    >
      {children}
    </AppShell>
  )
}
