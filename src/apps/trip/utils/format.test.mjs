// node --test src/apps/trip/utils/*.test.mjs
//
// Libellés : plages de dates et progression d'un voyage.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  dayChip, formatDuration, formatPrice, formatProgress, formatShortRange, formatSyncTime, formatTripRange,
  formatUntil, plural, totalsByCurrency,
} from './format.js'

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

test('pastilles de jour et durées', () => {
  assert.deepEqual(dayChip('2027-05-14'), { dow: 'Ven', day: 14, month: 'mai' })
  assert.equal(formatDuration(45), '45 min')
  assert.equal(formatDuration(60), '1 h')
  assert.equal(formatDuration(90), '1 h 30')
  assert.equal(formatDuration(125), '2 h 05')
  assert.equal(formatDuration(null), '')
})

test('prix dans leur devise, totaux jamais mélangés', () => {
  const plain = (s) => s.replace(/[\u202f\u00a0]/g, ' ')
  assert.equal(plain(formatPrice(284, 'EUR')), '284 €')
  assert.equal(plain(formatPrice(162.5, 'EUR')), '162,50 €')
  assert.equal(plain(formatPrice(1250, 'EUR')), '1 250 €')
  assert.equal(formatPrice(null, 'EUR'), '')
  assert.deepEqual(
    totalsByCurrency([
      { price: 284, currency: 'EUR' }, { price: 162.5, currency: 'EUR' },
      { price: 540, currency: 'AUD' }, { price: null, currency: 'AUD' }, { price: 10 },
    ]),
    [{ currency: 'AUD', total: 540 }, { currency: 'EUR', total: 456.5 }],
  )
})

test('plages courtes, sans l’année', () => {
  assert.equal(formatShortRange('2027-05-12', '2027-05-14'), '12 → 14 mai')
  assert.equal(formatShortRange('2027-04-28', '2027-05-03'), '28 avr → 3 mai')
  assert.equal(formatShortRange('2027-05-12', '2027-05-12'), '12 mai')
})

test('compte à rebours jusqu’au prochain élément', () => {
  assert.equal(formatUntil(0), 'maintenant')
  assert.equal(formatUntil(-5), 'maintenant')
  assert.equal(formatUntil(12), 'dans 12 min')
  assert.equal(formatUntil(80), 'dans 1 h 20')
  assert.equal(formatUntil(120), 'dans 2 h')
})

test('heure de la dernière synchro, en heure locale', () => {
  const now = new Date(2027, 4, 14, 9, 5)
  assert.equal(formatSyncTime(new Date(2027, 4, 14, 8, 2), now), '08:02')
  assert.equal(formatSyncTime(new Date(2027, 4, 13, 22, 47).getTime(), now), 'hier 22:47')
  assert.equal(formatSyncTime(new Date(2027, 4, 2, 10, 0), now), '2 mai')
  // À cheval sur un mois.
  assert.equal(formatSyncTime(new Date(2027, 4, 31, 23, 59), new Date(2027, 5, 1, 0, 1)), 'hier 23:59')
})
