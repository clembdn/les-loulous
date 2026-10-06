import { useMemo } from 'react'
import { Plane } from 'lucide-react'
import AppShell from '@/shared/ui/AppShell.jsx'
import { useToday } from '@/shared/lib/useToday.js'
import { LIST_PATH, sidebarSections, tripTabs } from '../../config/navigation.js'
import { tripStatus } from '../../utils/tripDates.js'

// Coquille de Trip Planner : la coquille partagée, nourrie selon qu'un voyage
// est ouvert (`trip`) ou non (la liste).
//
// Dans un voyage, la barre du haut mobile porte son titre et « ‹ Voyages »
// pour remonter à la liste ; les écrans n'ont plus à répéter l'en-tête du
// voyage. Sur la liste, la flèche ramène au portail, comme les autres apps.
export default function Shell({ trip = null, active, onChange, sidebarAction, action = null, children }) {
  const today = useToday()
  const status = trip ? tripStatus(trip, today) : null
  const sections = useMemo(() => sidebarSections(trip, status), [trip, status])
  const tabs = useMemo(() => (trip ? tripTabs(status) : []), [trip, status])
  return (
    <AppShell
      title="Trip Planner"
      icon={Plane}
      heading={trip ? trip.title : 'Mes voyages'}
      back={trip ? { to: LIST_PATH, label: 'Voyages' } : null}
      active={active}
      onChange={onChange}
      sections={sections}
      tabs={tabs}
      sidebarAction={sidebarAction}
      action={action}
    >
      {children}
    </AppShell>
  )
}
