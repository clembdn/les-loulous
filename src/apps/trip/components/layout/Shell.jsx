import { useMemo } from 'react'
import { Plane } from 'lucide-react'
import AppShell from '@/shared/ui/AppShell.jsx'
import { MOBILE_TABS, sidebarSections, TRIP_TABS } from '../../config/navigation.js'

// Coquille de Trip Planner : la coquille partagée, nourrie selon qu'un voyage
// est ouvert (`trip`) ou non (la liste). Le titre du voyage nomme le groupe
// de la sidebar ; la barre du haut mobile dit l'écran, comme dans les autres
// apps — le titre du voyage est déjà en tête de page.
export default function Shell({ trip = null, active, onChange, sidebarAction, children }) {
  const sections = useMemo(() => sidebarSections(trip), [trip])
  return (
    <AppShell
      title="Trip Planner"
      icon={Plane}
      heading={TRIP_TABS.find((tab) => tab.id === active)?.label || 'Trip Planner'}
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
