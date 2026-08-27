import { ShoppingCart, ChefHat, CalendarDays, Refrigerator, Flame, Apple, NotebookPen, Target } from 'lucide-react'

// Sous-features de l'app Cook’It.
// Sidebar desktop et bottom-nav mobile ne sont plus identiques : le bloc
// Nutrition compte plusieurs écrans, qu'on ne peut pas empiler dans la barre
// du bas sans la saturer. Desktop → un groupe déplié ; mobile → un onglet
// unique, et un SegmentedTabs dans la vue pour passer d'un écran à l'autre.

export const COOKIT_TABS = [
  { id: 'liste',    label: 'Liste',    icon: ShoppingCart },
  { id: 'frigo',    label: 'Frigo',    icon: Refrigerator },
  { id: 'recettes', label: 'Recettes', icon: ChefHat },
  { id: 'planning', label: 'Planning', icon: CalendarDays },
]

export const NUTRITION_TABS = [
  { id: 'journal',   label: 'Journal',   icon: NotebookPen },
  { id: 'aliments',  label: 'Aliments',  icon: Apple },
  { id: 'objectifs', label: 'Objectifs', icon: Target },
]

export const NUTRITION_IDS = NUTRITION_TABS.map((t) => t.id)
export const NUTRITION_DEFAULT = 'journal'

const ALL_TABS = [...COOKIT_TABS, ...NUTRITION_TABS]

export const DEFAULT_TAB = 'liste'

export function getTab(id) {
  return ALL_TABS.find((t) => t.id === id) || ALL_TABS[0]
}

export const SIDEBAR_SECTIONS = [
  { type: 'items', items: COOKIT_TABS },
  { type: 'group', label: 'Nutrition', icon: Flame, accentClass: 'text-orange-500', items: NUTRITION_TABS },
]

export const MOBILE_TABS = [
  ...COOKIT_TABS,
  { id: 'nutrition', label: 'Nutrition', icon: Flame, activeFor: NUTRITION_IDS, route: NUTRITION_DEFAULT },
]
