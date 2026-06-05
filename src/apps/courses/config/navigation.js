import { ShoppingCart, ChefHat, CalendarDays, Refrigerator } from 'lucide-react'

// Sous-features de l'app Courses. Pilotent la sidebar (desktop) et la bottom-nav (mobile).
export const COURSES_TABS = [
  { id: 'liste',    label: 'Liste',    icon: ShoppingCart },
  { id: 'frigo',    label: 'Frigo',    icon: Refrigerator },
  { id: 'recettes', label: 'Recettes', icon: ChefHat },
  { id: 'planning', label: 'Planning', icon: CalendarDays },
]

export const DEFAULT_TAB = 'liste'

export function getTab(id) {
  return COURSES_TABS.find((t) => t.id === id) || COURSES_TABS[0]
}
