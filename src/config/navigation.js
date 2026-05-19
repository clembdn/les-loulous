import { Home, List, PieChart, Plane, CheckSquare, Calendar, Sparkles } from 'lucide-react'

// IDs of all routable views.
export const VOYAGE_SUB_IDS = ['checklist', 'timeline', 'scenarios']
export const TOP_LEVEL_IDS = ['dashboard', 'transactions', 'budgets', ...VOYAGE_SUB_IDS]

// Voyage sub-pages — used by mobile page-tabs and desktop sidebar group.
export const VOYAGE_SUBS = [
  { id: 'checklist', label: 'Checklist',  short: 'Check',   icon: CheckSquare },
  { id: 'timeline',  label: 'Timeline',   short: 'Timeline', icon: Calendar },
  { id: 'scenarios', label: 'Scénarios',  short: 'Scénarios', icon: Sparkles },
]

// The default Voyage sub-page when the user lands on /voyage (mobile bottom-nav).
export const VOYAGE_DEFAULT_SUB = 'checklist'

// Mobile bottom-nav: 4 tabs. The Voyage tab activates for any of its sub-pages.
export const MOBILE_TABS = [
  {
    id: 'dashboard',
    label: 'Accueil',
    icon: Home,
    activeFor: ['dashboard'],
    route: 'dashboard',
  },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: List,
    activeFor: ['transactions'],
    route: 'transactions',
  },
  {
    id: 'budgets',
    label: 'Budgets',
    icon: PieChart,
    activeFor: ['budgets'],
    route: 'budgets',
  },
  {
    id: 'voyage',
    label: 'Voyage',
    icon: Plane,
    activeFor: VOYAGE_SUB_IDS,
    route: VOYAGE_DEFAULT_SUB,
  },
]

// Desktop sidebar structure.
// Top-level items first, then groups with sub-items.
export const SIDEBAR_SECTIONS = [
  {
    type: 'items',
    items: [
      { id: 'dashboard',    label: 'Accueil',      icon: Home },
      { id: 'transactions', label: 'Transactions', icon: List },
      { id: 'budgets',      label: 'Budgets',      icon: PieChart },
    ],
  },
  {
    type: 'group',
    label: 'Voyage',
    icon: Plane,
    accentClass: 'text-cyan-400',
    items: VOYAGE_SUBS,
  },
]

export function isVoyageRoute(active) {
  return VOYAGE_SUB_IDS.includes(active)
}
