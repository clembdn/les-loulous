// node --test src/apps/trip/utils/*.test.mjs
//
// Libellés : plages de dates et progression d'un voyage.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatProgress, formatTripRange, plural } from './format.js'

test('pluriel', () => {
  assert.equal(plural(1, 'jour'), '1 jour')
  assert.equal(plural(6, 'jour'), '6 jours')
  assert.equal(plural(2, 'trajet réservé', 'trajets réservés'), '2 trajets réservés')
})

test('plages de dates : on ne répète que ce qui change', () => {
  assert.equal(formatTripRange('2027-05-12', '2027-05-17'), '12 → 17 mai 2027')
  assert.equal(formatTripRange('2027-04-28', '2027-05-03'), '28 avr → 3 mai 2027')
  assert.equal(formatTripRange('2026-12-28', '2027-01-03'), '28 déc 2026 → 3 jan 2027')
  assert.equal(formatTripRange('2027-05-12', '2027-05-12'), '12 mai 2027')
})

test('progression en une ligne', () => {
  assert.equal(formatProgress({ status: 'upcoming', daysUntil: 1 }), 'Demain')
  assert.equal(formatProgress({ status: 'upcoming', daysUntil: 12 }), 'Dans 12 jours')
  assert.equal(formatProgress({ status: 'upcoming', daysUntil: 200 }), 'Dans 7 mois')
  assert.equal(formatProgress({ status: 'ongoing', dayNumber: 3, length: 6 }), 'Jour 3 sur 6')
  assert.equal(formatProgress({ status: 'past', daysSince: 1 }), 'Rentrés hier')
  assert.equal(formatProgress({ status: 'past', daysSince: 20 }), 'Rentrés il y a 20 jours')
  assert.equal(formatProgress({ status: 'past', daysSince: 400 }, '2026-08-14'), 'Août 2026')
})
