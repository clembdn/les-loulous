import { Dumbbell, LineChart, Scale, Settings, CalendarRange, ListChecks } from 'lucide-react'

// La séance du jour est à zéro clic ; le reste à un clic.
// Les deux écrans de réglages ont chacun leur entrée dans la sidebar desktop,
// et partagent un seul onglet sur mobile.
export const SETTINGS_IDS = ['programme', 'catalogue']
export const SETTINGS_DEFAULT = 'programme'

export const MUSC_TABS = [
  { id: 'seance',   label: 'Séance',   icon: Dumbbell },
  { id: 'progres',  label: 'Progrès',  icon: LineChart },
  { id: 'poids',    label: 'Poids',    icon: Scale },
  { id: 'reglages', label: 'Réglages', icon: Settings, activeFor: SETTINGS_IDS, route: SETTINGS_DEFAULT },
]

export const DEFAULT_TAB = 'seance'

export const SIDEBAR_SECTIONS = [
  {
    type: 'items',
    items: [
      { id: 'seance',  label: 'Séance du jour', icon: Dumbbell },
      { id: 'progres', label: 'Progrès',        icon: LineChart },
      { id: 'poids',   label: 'Poids',          icon: Scale },
    ],
  },
  {
    type: 'group',
    label: 'Réglages',
    icon: Settings,
    accentClass: 'text-accent',
    items: [
      { id: 'programme', label: 'Programme', icon: CalendarRange },
      { id: 'catalogue', label: 'Exercices', icon: ListChecks },
    ],
  },
]

const ALL_ITEMS = SIDEBAR_SECTIONS.flatMap((s) => s.items)

export function getTab(id) {
  return ALL_ITEMS.find((t) => t.id === id) || ALL_ITEMS[0]
}
