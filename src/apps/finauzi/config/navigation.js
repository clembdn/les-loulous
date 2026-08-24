import { Home, List, PieChart, Users, Scale, Wallet, Upload } from 'lucide-react'

// Le compte joint et l'équilibre partagent un onglet sur mobile et
// apparaissent séparément dans la sidebar desktop.
export const COMMON_SUB_IDS = ['joint', 'balance']

export const COMMON_SUBS = [
  { id: 'joint', label: 'Compte joint', short: 'Joint', icon: Wallet, subtitle: 'Solde, autonomie et charges fixes' },
  { id: 'balance', label: 'Équilibre', short: 'Équilibre', icon: Scale, subtitle: 'Apports au pot et dettes croisées' },
]

export const COMMON_DEFAULT_SUB = 'joint'

// Barre du bas mobile : 4 onglets. « Commun » regroupe le compte joint et
// l'équilibre. Les libellés restent courts pour ne pas déborder sur un
// écran de 360 px.
export const MOBILE_TABS = [
  { id: 'dashboard', label: 'Accueil', icon: Home, activeFor: ['dashboard'], route: 'dashboard' },
  { id: 'common', label: 'Commun', icon: Users, activeFor: COMMON_SUB_IDS, route: COMMON_DEFAULT_SUB },
  // L'import se lit depuis l'activité : sur mobile, il s'ouvre par le bouton
  // de l'en-tête plutôt que par un cinquième onglet qui serrerait les autres.
  { id: 'transactions', label: 'Activité', icon: List, activeFor: ['transactions', 'import'], route: 'transactions' },
  { id: 'budgets', label: 'Budgets', icon: PieChart, activeFor: ['budgets'], route: 'budgets' },
]

// Sidebar desktop : chaque sous-page a sa propre entrée, jamais empilée
// derrière un onglet parent.
export const SIDEBAR_SECTIONS = [
  {
    type: 'items',
    items: [
      { id: 'dashboard', label: 'Accueil', icon: Home },
      { id: 'transactions', label: 'Transactions', icon: List },
      { id: 'import', label: 'Importer', icon: Upload },
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
]
