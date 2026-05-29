import { Home, List, PieChart, Plane, CheckSquare, Calendar } from 'lucide-react'

// IDs of all routable views.
export const VOYAGE_SUB_IDS = ['checklist', 'timeline']
export const TOP_LEVEL_IDS = ['dashboard', 'transactions', 'budgets', ...VOYAGE_SUB_IDS]

// Voyage sub-pages — kept for the mobile Voyage tab (which switches between them).
export const VOYAGE_SUBS = [
  { id: 'checklist', label: 'Checklist', short: 'Check',    icon: CheckSquare, subtitle: 'Préparer le voyage' },
  { id: 'timeline',  label: 'Timeline',  short: 'Timeline', icon: Calendar,    subtitle: 'Les étapes de l\'année' },
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

// Desktop sidebar structure — single flat list, Checklist & Timeline live alongside the others.
export const SIDEBAR_SECTIONS = [
  {
    type: 'items',
    items: [
      { id: 'dashboard',    label: 'Accueil',      icon: Home },
      { id: 'transactions', label: 'Transactions', icon: List },
      { id: 'budgets',      label: 'Budgets',      icon: PieChart },
      { id: 'checklist',    label: 'Checklist',    icon: CheckSquare },
      { id: 'timeline',     label: 'Timeline',     icon: Calendar },
    ],
  },
]

export function isVoyageRoute(active) {
  return VOYAGE_SUB_IDS.includes(active)
}

export function getVoyageSub(id) {
  return VOYAGE_SUBS.find((s) => s.id === id) || VOYAGE_SUBS[0]
}
