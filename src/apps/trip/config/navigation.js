import { CalendarDays, Luggage, Plane, Sun, Ticket } from 'lucide-react'

// Trip Planner a deux niveaux, là où les autres apps n'en ont qu'un :
//   /trip/voyages              la liste des voyages
//   /trip/<id>/<écran>[/<sous-page>]   l'intérieur d'un voyage
// Les écrans d'un voyage sont dans l'URL (cf. useTabRoute) : « retour »
// revient à l'écran précédent, et un lien vers une journée se partage.

export const LIST_ID = 'voyages'
export const LIST_PATH = '/trip/voyages'

export const TRIP_TABS = [
  { id: 'aujourdhui', label: 'Aujourd’hui', icon: Sun },
  { id: 'jours',      label: 'Jours',       icon: CalendarDays },
  { id: 'resas',      label: 'Résas',       sidebarLabel: 'Réservations', icon: Ticket },
]

// Segments reconnus sous /trip/<id> — tout le reste retombe sur DEFAULT_TAB.
export const TAB_IDS = TRIP_TABS.map((t) => t.id)
export const DEFAULT_TAB = 'jours'

export function tripPath(tripId, tab = DEFAULT_TAB, sub = null) {
  return ['/trip', tripId, tab, sub && encodeURIComponent(sub)].filter(Boolean).join('/')
}

// Mobile : les écrans du voyage + un retour à la liste. Sur la liste elle-même,
// pas de barre du bas (il n'y a rien entre quoi basculer).
export const MOBILE_TABS = [
  ...TRIP_TABS,
  { id: LIST_ID, label: 'Voyages', icon: Luggage },
]

const LIST_ITEM = { id: LIST_ID, label: 'Mes voyages', icon: Luggage }

// Le libellé de groupe de la sidebar est en petites capitales sur 240 px :
// un titre de voyage trop long passerait sur trois lignes.
function groupLabel(title) {
  return title.length > 26 ? `${title.slice(0, 25).trimEnd()}…` : title
}

/** Sidebar desktop : la liste, puis les écrans du voyage ouvert, en groupe à son nom. */
export function sidebarSections(trip) {
  const list = { type: 'items', items: [LIST_ITEM] }
  if (!trip) return [list]
  return [
    list,
    {
      type: 'group',
      label: groupLabel(trip.title),
      icon: Plane,
      accentClass: 'text-accent',
      items: TRIP_TABS.map((t) => ({ id: t.id, label: t.sidebarLabel || t.label, icon: t.icon })),
    },
  ]
}
