// node --test src/apps/trip/utils/*.test.mjs
//
// Le calendrier d'un voyage : jours, statut déduit des dates, progression.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  currentTrip, daysBetween, defaultDay, groupTrips, MAX_TRIP_DAYS, tripDays, tripLength,
  tripProgress, tripStatus, validateTripDates,
} from './tripDates.js'

const trip = (id, startDate, endDate) => ({ id, startDate, endDate })

test('écart en jours calendaires, à cheval sur un mois et sur le changement d’heure', () => {
  assert.equal(daysBetween('2027-05-12', '2027-05-17'), 5)
  assert.equal(daysBetween('2027-04-28', '2027-05-03'), 5)
  assert.equal(daysBetween('2027-03-27', '2027-03-29'), 2, 'passage à l’heure d’été en Europe')
  assert.equal(daysBetween('2027-05-17', '2027-05-12'), -5)
})

test('les jours du voyage, bornes comprises', () => {
  assert.deepEqual(tripDays(trip('t', '2027-05-12', '2027-05-14')), ['2027-05-12', '2027-05-13', '2027-05-14'])
  assert.deepEqual(tripDays(trip('t', '2027-12-31', '2028-01-01')), ['2027-12-31', '2028-01-01'])
  assert.deepEqual(tripDays(trip('t', '2027-05-12', '2027-05-12')), ['2027-05-12'], 'un aller-retour dans la journée')
  assert.deepEqual(tripDays(trip('t', '2027-05-14', '2027-05-12')), [], 'dates à l’envers')
  assert.deepEqual(tripDays(trip('t', '', '2027-05-12')), [])
  assert.equal(tripDays(trip('t', '2027-01-01', '2027-12-31')).length, MAX_TRIP_DAYS, 'plafonné')
  assert.equal(tripLength(trip('t', '2027-05-12', '2027-05-17')), 6)
})

test('le statut se déduit des dates : en cours jusqu’au soir du retour', () => {
  const t = trip('t', '2027-05-12', '2027-05-17')
  assert.equal(tripStatus(t, '2027-05-11'), 'upcoming')
  assert.equal(tripStatus(t, '2027-05-12'), 'ongoing')
  assert.equal(tripStatus(t, '2027-05-17'), 'ongoing')
  assert.equal(tripStatus(t, '2027-05-18'), 'past')
})

test('progression : compte à rebours, jour n sur N, jours depuis le retour', () => {
  const t = trip('t', '2027-05-12', '2027-05-17')
  assert.deepEqual(tripProgress(t, '2027-04-30'), { status: 'upcoming', length: 6, daysUntil: 12, dayNumber: null, daysSince: 0 })
  assert.equal(tripProgress(t, '2027-05-14').dayNumber, 3)
  assert.equal(tripProgress(t, '2027-05-20').daysSince, 3)
})

test('la liste : en cours, à venir du plus proche, passés du plus récent', () => {
  const trips = [
    trip('ancien', '2026-01-02', '2026-01-09'),
    trip('loin', '2027-08-01', '2027-08-10'),
    trip('recent', '2027-03-01', '2027-03-05'),
    trip('maintenant', '2027-05-10', '2027-05-20'),
    trip('bientot', '2027-06-01', '2027-06-03'),
  ]
  const g = groupTrips(trips, '2027-05-12')
  assert.deepEqual(g.ongoing.map((t) => t.id), ['maintenant'])
  assert.deepEqual(g.upcoming.map((t) => t.id), ['bientot', 'loin'])
  assert.deepEqual(g.past.map((t) => t.id), ['recent', 'ancien'])
})

test('le voyage en cours : le plus récemment commencé si deux se chevauchent', () => {
  const long = trip('long', '2027-05-01', '2027-05-31')
  const weekend = trip('weekend', '2027-05-14', '2027-05-16')
  assert.equal(currentTrip([long, weekend], '2027-05-15').id, 'weekend')
  assert.equal(currentTrip([long, weekend], '2027-05-20').id, 'long')
  assert.equal(currentTrip([long], '2027-06-01'), null)
})

test('le jour ouvert par défaut : aujourd’hui pendant le voyage, sinon le premier', () => {
  const t = trip('t', '2027-05-12', '2027-05-17')
  assert.equal(defaultDay(t, '2027-05-14'), '2027-05-14')
  assert.equal(defaultDay(t, '2027-04-01'), '2027-05-12')
  assert.equal(defaultDay(t, '2027-06-01'), '2027-05-12')
})

test('validation des dates du formulaire', () => {
  assert.equal(validateTripDates('2027-05-12', '2027-05-17'), null)
  assert.equal(validateTripDates('2027-05-12', '2027-05-12'), null)
  assert.match(validateTripDates('', '2027-05-17'), /Choisissez/)
  assert.match(validateTripDates('2027-05-17', '2027-05-12'), /précède/)
  assert.match(validateTripDates('2027-01-01', '2027-12-31'), /maximum/)
})
