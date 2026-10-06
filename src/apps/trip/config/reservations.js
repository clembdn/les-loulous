import {
  BedDouble, BedSingle, Bus, Car, Home, Hotel, Plane, Route, Ship, Tent, TrainFront,
} from 'lucide-react'

// Hébergements : un séjour couvre des nuits (cf. utils/nights.js).
export const STAY_KINDS = [
  { id: 'hotel',   label: 'Hôtel',   icon: Hotel },
  { id: 'airbnb',  label: 'Airbnb',  icon: Home },
  { id: 'camping', label: 'Camping', icon: Tent },
  { id: 'hostel',  label: 'Auberge', icon: BedSingle },
  { id: 'other',   label: 'Autre',   icon: BedDouble },
]

/**
 * Trajets RÉSERVÉS, saisis à la main : le billet existe déjà, rien à calculer.
 *
 * La location de voiture n'était pas au cahier des charges ; c'est pourtant la
 * réservation la plus courante d'un road trip, et elle a exactement la forme
 * d'un trajet — une prise, un retour, une référence, un justificatif. Seuls
 * les libellés des deux extrémités changent.
 */
export const TRANSPORT_MODES = [
  { id: 'flight', label: 'Vol', icon: Plane, refPlaceholder: 'TP 1024', fromLabel: 'Départ', toLabel: 'Arrivée' },
  { id: 'train',  label: 'Train', icon: TrainFront, refPlaceholder: 'TGV 6173', fromLabel: 'Départ', toLabel: 'Arrivée' },
  { id: 'bus',    label: 'Bus',   icon: Bus, refPlaceholder: 'FlixBus 042', fromLabel: 'Départ', toLabel: 'Arrivée' },
  { id: 'ferry',  label: 'Ferry', icon: Ship, refPlaceholder: 'Traversée 7:30', fromLabel: 'Départ', toLabel: 'Arrivée' },
  { id: 'car',    label: 'Location de voiture', short: 'Voiture', icon: Car, refPlaceholder: 'Hertz · Clio', fromLabel: 'Prise', toLabel: 'Retour' },
  { id: 'other',  label: 'Autre', icon: Route, refPlaceholder: '', fromLabel: 'Départ', toLabel: 'Arrivée' },
]

export const STAY_KIND_IDS = STAY_KINDS.map((k) => k.id)
export const TRANSPORT_MODE_IDS = TRANSPORT_MODES.map((m) => m.id)

const STAY_KIND_BY_ID = Object.fromEntries(STAY_KINDS.map((k) => [k.id, k]))
const TRANSPORT_MODE_BY_ID = Object.fromEntries(TRANSPORT_MODES.map((m) => [m.id, m]))

export function getStayKind(id) {
  return STAY_KIND_BY_ID[id] || STAY_KIND_BY_ID.other
}

export function getTransportMode(id) {
  return TRANSPORT_MODE_BY_ID[id] || TRANSPORT_MODE_BY_ID.other
}

// Les devises qu'on croise le plus depuis l'Australie ; le prix reste dans la
// devise payée, jamais converti (comme dans FinAuzi).
export const CURRENCIES = ['EUR', 'AUD', 'USD', 'GBP', 'NZD', 'JPY', 'THB', 'IDR', 'SGD', 'CHF', 'CAD']
