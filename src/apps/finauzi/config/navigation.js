import { Home, List, PieChart, Plane, CheckSquare, Calendar, Users, Scale, Wallet } from 'lucide-react'

// Deux groupes de sous-pages qui partagent un onglet sur mobile et
// apparaissent séparément dans la sidebar desktop.
export const COMMON_SUB_IDS = ['joint', 'balance']
export const VOYAGE_SUB_IDS = ['checklist', 'timeline']

export const TOP_LEVEL_IDS = [
  'dashboard',
  ...COMMON_SUB_IDS,
  'transactions',
  'budgets',
  ...VOYAGE_SUB_IDS,
]

export const COMMON_SUBS = [
  { id: 'joint', label: 'Compte joint', short: 'Joint', icon: Wallet, subtitle: 'Solde, autonomie et charges fixes' },
  { id: 'balance', label: 'Équilibre', short: 'Équilibre', icon: Scale, subtitle: 'Apports au pot et dettes croisées' },
]

export const VOYAGE_SUBS = [
  { id: 'checklist', label: 'Checklist', short: 'Check', icon: CheckSquare, subtitle: 'Préparer le voyage' },
  { id: 'timeline', label: 'Timeline', short: 'Timeline', icon: Calendar, subtitle: 'Les étapes de l\'année' },
]

export const COMMON_DEFAULT_SUB = 'joint'
export const VOYAGE_DEFAULT_SUB = 'checklist'

// Barre du bas mobile : 5 onglets. « Commun » regroupe le compte joint et
// l'équilibre, comme « Voyage » regroupe checklist et timeline.
// Les libellés sont volontairement courts — à cinq, « Transactions » en
// entier fait déborder la barre sur un écran de 360 px.
export const MOBILE_TABS = [
  { id: 'dashboard', label: 'Accueil', icon: Home, activeFor: ['dashboard'], route: 'dashboard' },
  { id: 'common', label: 'Commun', icon: Users, activeFor: COMMON_SUB_IDS, route: COMMON_DEFAULT_SUB },
  { id: 'transactions', label: 'Activité', icon: List, activeFor: ['transactions'], route: 'transactions' },
  { id: 'budgets', label: 'Budgets', icon: PieChart, activeFor: ['budgets'], route: 'budgets' },
  { id: 'voyage', label: 'Voyage', icon: Plane, activeFor: VOYAGE_SUB_IDS, route: VOYAGE_DEFAULT_SUB },
]

// Sidebar desktop : chaque sous-page a sa propre entrée, jamais empilée
// derrière un onglet parent.
export const SIDEBAR_SECTIONS = [
  {
    type: 'items',
    items: [
      { id: 'dashboard', label: 'Accueil', icon: Home },
      { id: 'transactions', label: 'Transactions', icon: List },
      { id: 'budgets', label: 'Budgets', icon: PieChart },
    ],
  },
  {
    type: 'group',
    label: 'Commun',
    icon: Users,
    accentClass: 'text-sky-400',
    items: [
      { id: 'joint', label: 'Compte joint', icon: Wallet },
      { id: 'balance', label: 'Équilibre', icon: Scale },
    ],
  },
  {
    type: 'group',
    label: 'Voyage',
    icon: Plane,
    accentClass: 'text-cyan-400',
    items: [
      { id: 'checklist', label: 'Checklist', icon: CheckSquare },
      { id: 'timeline', label: 'Timeline', icon: Calendar },
    ],
  },
]

export function isVoyageRoute(active) {
  return VOYAGE_SUB_IDS.includes(active)
}

export function isCommonRoute(active) {
  return COMMON_SUB_IDS.includes(active)
}

export function getVoyageSub(id) {
  return VOYAGE_SUBS.find((s) => s.id === id) || VOYAGE_SUBS[0]
}

export function getCommonSub(id) {
  return COMMON_SUBS.find((s) => s.id === id) || COMMON_SUBS[0]
}
