import { ShoppingBasket } from 'lucide-react'
import AppShell from '@/shared/ui/AppShell.jsx'
import ListsNavSection from './ListsNavSection.jsx'
import Toaster from '../Toaster.jsx'
import { MOBILE_TABS, SIDEBAR_SECTIONS, getTab } from '../../config/navigation.js'

// Shell de l'app Cook’It : la coquille est partagée, seul le bloc « Mes listes »
// est spécifique et passe par le slot `sidebarExtra`.
export default function Shell({ active, onChange, lists, counts, onManageLists, children }) {
  return (
    <AppShell
      title="Cook’It"
      icon={ShoppingBasket}
      heading={getTab(active).label}
      active={active}
      onChange={onChange}
      sections={SIDEBAR_SECTIONS}
      tabs={MOBILE_TABS}
      sidebarExtra={
        <ListsNavSection lists={lists} counts={counts} onManageLists={onManageLists} onChange={onChange} />
      }
    >
      {children}
      <Toaster />
    </AppShell>
  )
}
