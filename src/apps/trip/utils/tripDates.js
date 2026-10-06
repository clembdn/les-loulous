// Le calendrier d'un voyage : ses jours, son statut, où on en est.
//
// Le statut (à venir / en cours / passé) n'est PAS stocké : il se déduit des
// dates et du jour courant. Un voyage s'archive donc tout seul le lendemain
// de son retour, sans écriture ni tâche planifiée, et ne peut jamais
// afficher un statut périmé.
//
// Toutes les dates sont des clés locales « AAAA-MM-JJ » (cf. shared/lib/dates).
// Imports relatifs : module testé sous `node --test`.

import { isDateKey, shiftDateKey } from '../../../shared/lib/dates.js'

// Au-delà, la liste des jours et la bande des nuits deviennent illisibles sur
// un téléphone — et un voyage de deux mois se découpe mieux en plusieurs.
export const MAX_TRIP_DAYS = 60

function dayNumberUtc(key) {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

/**
 * Écart en jours CALENDAIRES entre deux clés. Calculé sur des dates UTC
 * reconstruites, jamais sur des instants locaux : un passage à l'heure d'été
 * ferait sinon tomber un jour de 23 heures et décaler le compte.
 */
export function daysBetween(from, to) {
  return dayNumberUtc(to) - dayNumberUtc(from)
}

function hasValidRange(trip) {
  return isDateKey(trip?.startDate) && isDateKey(trip?.endDate) && trip.endDate >= trip.startDate
}

/** Toutes les dates du voyage, bornes comprises. */
export function tripDays(trip) {
  if (!hasValidRange(trip)) return []
  const days = []
  for (let d = trip.startDate; d <= trip.endDate && days.length < MAX_TRIP_DAYS; d = shiftDateKey(d, 1)) {
    days.push(d)
  }
  return days
}

export function tripLength(trip) {
  return hasValidRange(trip) ? daysBetween(trip.startDate, trip.endDate) + 1 : 0
}

/** 'upcoming' | 'ongoing' | 'past' — le voyage est « en cours » jusqu'au soir du retour. */
export function tripStatus(trip, today) {
  if (today < trip.startDate) return 'upcoming'
  if (today > trip.endDate) return 'past'
  return 'ongoing'
}

/** Tout ce qu'il faut pour dire « dans 12 jours » ou « jour 3 sur 6 ». */
export function tripProgress(trip, today) {
  const status = tripStatus(trip, today)
  return {
    status,
    length: tripLength(trip),
    daysUntil: status === 'upcoming' ? daysBetween(today, trip.startDate) : 0,
    dayNumber: status === 'ongoing' ? daysBetween(trip.startDate, today) + 1 : null,
    daysSince: status === 'past' ? daysBetween(trip.endDate, today) : 0,
  }
}

/**
 * Les voyages rangés pour la liste : en cours, puis à venir (le plus proche
 * d'abord), puis passés (le plus récent d'abord).
 */
export function groupTrips(trips, today) {
  const groups = { ongoing: [], upcoming: [], past: [] }
  for (const trip of trips) groups[tripStatus(trip, today)].push(trip)
  const byStart = (a, b) => a.startDate.localeCompare(b.startDate)
  groups.ongoing.sort(byStart)
  groups.upcoming.sort(byStart)
  groups.past.sort((a, b) => b.endDate.localeCompare(a.endDate))
  return groups
}

/**
 * Le voyage sur lequel l'app s'ouvre : celui qu'on est en train de vivre.
 * Deux voyages qui se chevauchent (un week-end dans un plus long) : le plus
 * récemment commencé, le plus précis des deux.
 */
export function currentTrip(trips, today) {
  const ongoing = trips.filter((t) => tripStatus(t, today) === 'ongoing')
  ongoing.sort((a, b) => b.startDate.localeCompare(a.startDate))
  return ongoing[0] || null
}

// Un voyage qui commence dans deux semaines se prépare encore, et le départ
// se fait souvent sans avoir rouvert l'app : on l'emporte dès maintenant.
export const PREWARM_DAYS = 14

/**
 * Les voyages à garder sous la main hors-ligne : en cours, ou qui commencent
 * dans `PREWARM_DAYS` jours au plus. Le plus proche d'abord.
 */
export function tripsToPrewarm(trips, today, horizon = PREWARM_DAYS) {
  return trips
    .filter((trip) => {
      const status = tripStatus(trip, today)
      return status === 'ongoing' || (status === 'upcoming' && daysBetween(today, trip.startDate) <= horizon)
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

/** Le jour ouvert par défaut : aujourd'hui s'il fait partie du voyage, sinon le premier. */
export function defaultDay(trip, today) {
  if (!hasValidRange(trip)) return null
  return today >= trip.startDate && today <= trip.endDate ? today : trip.startDate
}

/** Message d'erreur du formulaire de voyage, ou `null` si les dates tiennent. */
export function validateTripDates(startDate, endDate) {
  if (!isDateKey(startDate) || !isDateKey(endDate)) return 'Choisissez la date de début et la date de fin.'
  if (endDate < startDate) return 'La fin du voyage précède son début.'
  if (daysBetween(startDate, endDate) + 1 > MAX_TRIP_DAYS) return `${MAX_TRIP_DAYS} jours maximum par voyage.`
  return null
}
