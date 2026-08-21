import { Dumbbell, LineChart, Scale, Settings, CalendarRange, ListChecks, ArrowLeftRight } from 'lucide-react'

// La séance du jour est à zéro clic ; le reste à un clic.
// Les deux écrans de réglages ont chacun leur entrée dans la sidebar desktop,
// et partagent un seul onglet sur mobile.
export const SETTINGS_IDS = ['programme', 'catalogue', 'transfert']
export const SETTINGS_DEFAULT = 'programme'

// Sur mobile la barre du bas n'a qu'un onglet « Réglages » : sans ce contrôle
// segmenté, le catalogue d'exercices serait tout simplement inatteignable au
// doigt. Sur desktop, chacun a son entrée de sidebar.
export const SETTINGS_SUBS = [
  { id: 'programme', label: 'Programme', short: 'Programme', icon: CalendarRange },
  { id: 'catalogue', label: 'Exercices', short: 'Exercices', icon: ListChecks },
  { id: 'transfert', label: 'Transfert', short: 'Transfert', icon: ArrowLeftRight },
]

export const MUSC_TABS = [
  { id: 'seance',   label: 'Séance',   icon: Dumbbell },
  { id: 'progres',  label: 'Progrès',  icon: LineChart },
  { id: 'poids',    label: 'Suivi',    icon: Scale },
  { id: 'reglages', label: 'Réglages', icon: Settings, activeFor: SETTINGS_IDS, route: SETTINGS_DEFAULT },
]

export const DEFAULT_TAB = 'seance'

export const SIDEBAR_SECTIONS = [
  {
    type: 'items',
    items: [
      { id: 'seance',  label: 'Séance du jour', icon: Dumbbell },
      { id: 'progres', label: 'Progrès',        icon: LineChart },
      { id: 'poids',   label: 'Suivi',          icon: Scale },
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
      { id: 'transfert', label: 'Transfert', icon: ArrowLeftRight },
    ],
  },
]

const ALL_ITEMS = SIDEBAR_SECTIONS.flatMap((s) => s.items)

export function getTab(id) {
  return ALL_ITEMS.find((t) => t.id === id) || ALL_ITEMS[0]
}
