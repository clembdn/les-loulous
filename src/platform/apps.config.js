import { Wallet, ShoppingCart } from 'lucide-react'

// Registre des apps. Source unique de vérité pour les cards du dashboard.
// Ajouter une app = (1) une entrée ici + (2) une <Route> dans src/App.jsx.
export const APPS = [
  {
    id: 'finauzi',
    name: 'FinAuzi',
    description: 'Notre trésorerie pour l’Australie',
    path: '/finauzi',
    icon: Wallet,
    accent: 'amber',   // clé de COLOR_BY_ID (people.js)
    theme: 'dark',     // mode de l'app (data-theme)
    status: 'live',    // 'live' | 'soon'
  },
  {
    id: 'courses',
    name: 'Liste de courses',
    description: 'Nos courses partagées',
    path: '/courses',
    icon: ShoppingCart,
    accent: 'emerald',
    theme: 'light',
    status: 'live',
  },
]

export function getApp(id) {
  return APPS.find((a) => a.id === id) || null
}
