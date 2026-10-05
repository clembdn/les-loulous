import {
  Coffee, Landmark, MapPin, ShoppingBag, Ticket, Trees, UtensilsCrossed, Waves, Wine,
} from 'lucide-react'

// Catégories d'étape : une icône dans la frise, rien de plus. Peu nombreuses
// exprès — on choisit d'un coup d'œil, on ne classe pas.
export const STOP_CATEGORIES = [
  { id: 'visit',    label: 'Visite',   icon: Landmark },
  { id: 'food',     label: 'Repas',    icon: UtensilsCrossed },
  { id: 'coffee',   label: 'Café',     icon: Coffee },
  { id: 'nature',   label: 'Nature',   icon: Trees },
  { id: 'beach',    label: 'Plage',    icon: Waves },
  { id: 'activity', label: 'Activité', icon: Ticket },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { id: 'night',    label: 'Soirée',   icon: Wine },
  { id: 'other',    label: 'Autre',    icon: MapPin },
]

export const STOP_CATEGORY_IDS = STOP_CATEGORIES.map((c) => c.id)
export const DEFAULT_CATEGORY = 'other'

const BY_ID = Object.fromEntries(STOP_CATEGORIES.map((c) => [c.id, c]))

export function getCategory(id) {
  return BY_ID[id] || BY_ID[DEFAULT_CATEGORY]
}
