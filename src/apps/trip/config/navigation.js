import { CalendarDays, Globe2, Luggage, Plane, Sun, Ticket } from 'lucide-react'

// Trip Planner a deux niveaux, là où les autres apps n'en ont qu'un :
//   /trip/voyages              la liste des voyages
//   /trip/<id>/<écran>[/<sous-page>]   l'intérieur d'un voyage
// Les écrans d'un voyage sont dans l'URL (cf. useTabRoute) : « retour »
// revient à l'écran précédent, et un lien vers une journée se partage.
//
// La liste n'est PAS un onglet du voyage : on y remonte par « ‹ Voyages »
// en haut de l'écran, comme on remonte d'un dossier — les onglets du bas ne
// basculent qu'entre des écrans du même voyage.

export const LIST_ID = 'voyages'
export const LIST_PATH = '/trip/voyages'
// La carte du monde : les pays visités, avec ou sans l'app.
export const WORLD_ID = 'monde'
export const WORLD_PATH = '/trip/monde'

// Le premier écran change de nom avec le voyage : avant le départ, c'est un
// aperçu (compte à rebours, ce qu'il reste à régler) ; pendant, la journée en
// cours ; après, le bilan. L'identifiant, lui, ne bouge pas.
const OVERVIEW_LABEL = { upcoming: 'Aperçu', ongoing: 'Aujourd’hui', past: 'Bilan' }

export const TRIP_TABS = [
  { id: 'aujourdhui', label: 'Aujourd’hui', icon: Sun },
  { id: 'jours',      label: 'Jours',       icon: CalendarDays },
  { id: 'resas',      label: 'Résas',       sidebarLabel: 'Réservations', icon: Ticket },
]

// Plein écran, hors des onglets : la journée déroulée étape par étape sur la carte.
export const RUNNER_ID = 'deroule'

// Segments reconnus sous /trip/<id> — tout le reste retombe sur DEFAULT_TAB.
export const TAB_IDS = [...TRIP_TABS.map((t) => t.id), RUNNER_ID]
export const DEFAULT_TAB = 'jours'

export function tripPath(tripId, tab = DEFAULT_TAB, sub = null) {
  return ['/trip', tripId, tab, sub && encodeURIComponent(sub)].filter(Boolean).join('/')
}

/** Les onglets d'un voyage, le premier nommé selon son statut (`tripStatus`). */
export function tripTabs(status) {
  return TRIP_TABS.map((t) => (t.id === 'aujourdhui' ? { ...t, label: OVERVIEW_LABEL[status] || t.label } : t))
}

const LIST_ITEM = { id: LIST_ID, label: 'Mes voyages', icon: Luggage }
const WORLD_ITEM = { id: WORLD_ID, label: 'Carte du monde', icon: Globe2 }

// Le libellé de groupe de la sidebar tient sur 240 px : un titre de voyage
// trop long passerait sur trois lignes.
function groupLabel(title) {
  return title.length > 26 ? `${title.slice(0, 25).trimEnd()}…` : title
}

/** Les écrans d'un voyage dans la sidebar, en groupe à son nom. */
export function tripSidebarGroup(trip, status) {
  return {
    type: 'group',
    label: groupLabel(trip.title),
    icon: Plane,
    accentClass: 'text-accent',
    items: tripTabs(status).map((t) => ({ id: t.id, label: t.sidebarLabel || t.label, icon: t.icon })),
  }
}

/** Sidebar desktop : la liste, puis les écrans du voyage ouvert. */
export function sidebarSections(trip, status) {
  const list = { type: 'items', items: [LIST_ITEM, WORLD_ITEM] }
  if (!trip) return [list]
  return [list, tripSidebarGroup(trip, status)]
}
