// node --test src/apps/trip/utils/*.test.mjs
//
// La liste des réservations : ordre chronologique, clés d'URL.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseResaKey, reservationEntries, resaKey } from './reservations.js'

test('clés d’URL aller-retour', () => {
  assert.equal(resaKey('stay', 'abc'), 'stay-abc')
  assert.deepEqual(parseResaKey('transport-x1'), { kind: 'transport', id: 'x1' })
  assert.equal(parseResaKey('voyage-x'), null)
  assert.equal(parseResaKey(null), null)
})

test('hébergements et trajets dans l’ordre où on les vit, le trajet avant à égalité', () => {
  const stays = [
    { id: 'lagos', checkIn: { date: '2027-05-16', time: '17:00' } },
    { id: 'alfama', checkIn: { date: '2027-05-12', time: null } },
  ]
  const transports = [
    { id: 'vol', from: { date: '2027-05-12', time: null } },
    { id: 'voiture', from: { date: '2027-05-14', time: '08:30' } },
  ]
  assert.deepEqual(
    reservationEntries(stays, transports).map((e) => e.key),
    ['transport-vol', 'stay-alfama', 'transport-voiture', 'stay-lagos'],
  )
})
