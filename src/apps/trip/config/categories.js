import {
  Coffee, Landmark, MapPin, ShoppingBag, Ticket, Trees, UtensilsCrossed, Waves, Wine,
} from 'lucide-react'

// Catégories d'étape : une icône et une COULEUR, celle de la pastille numérotée
// dans la frise et sur la carte. Peu nombreuses exprès — on choisit d'un coup
// d'œil, on ne classe pas.
//
// Teintes franches et nettement distinctes, toutes assez sombres pour porter
// un chiffre blanc (contraste ≥ 4,5:1). « Autre », la catégorie par défaut,
// prend le lagon de l'app.
export const STOP_CATEGORIES = [
  { id: 'visit',    label: 'Visite',   icon: Landmark,        color: '#7C3AED' }, // violet 600
  { id: 'food',     label: 'Repas',    icon: UtensilsCrossed, color: '#C2410C' }, // orange 700
  { id: 'coffee',   label: 'Café',     icon: Coffee,          color: '#92400E' }, // ambre 800
  { id: 'nature',   label: 'Nature',   icon: Trees,           color: '#15803D' }, // vert 700
  { id: 'beach',    label: 'Plage',    icon: Waves,           color: '#2563EB' }, // bleu 600
  { id: 'activity', label: 'Activité', icon: Ticket,          color: '#DC2626' }, // rouge 600
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag,     color: '#DB2777' }, // rose 600
  { id: 'night',    label: 'Soirée',   icon: Wine,            color: '#4338CA' }, // indigo 700
  { id: 'other',    label: 'Autre',    icon: MapPin,          color: '#0E7490' }, // lagon
]

export const STOP_CATEGORY_IDS = STOP_CATEGORIES.map((c) => c.id)
export const DEFAULT_CATEGORY = 'other'

const BY_ID = Object.fromEntries(STOP_CATEGORIES.map((c) => [c.id, c]))

export function getCategory(id) {
  return BY_ID[id] || BY_ID[DEFAULT_CATEGORY]
}
