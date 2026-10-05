// node --test src/apps/trip/utils/*.test.mjs
//
// Le nettoyage des champs : ce qui part en base, ce qui en revient.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  currencyCode, money, optNumber, optText, place, stamp, text, timeOfDay, timePoint,
} from './fields.js'

test('chaînes rognées, bornées, vides → null quand c’est facultatif', () => {
  assert.equal(text('  Lisbonne  ', 120), 'Lisbonne')
  assert.equal(text('abcdef', 3), 'abc')
  assert.equal(text(undefined, 10), '')
  assert.equal(optText('   ', 10), null)
})

test('nombres saisis à la française, bornes respectées', () => {
  assert.equal(optNumber('12,5'), 12.5)
  assert.equal(optNumber(''), null)
  assert.equal(optNumber('abc'), null)
  assert.equal(optNumber(-1, { min: 0 }), null)
  assert.equal(money('284,456'), 284.46)
  assert.equal(money(-3), null)
})

test('heures murales et instants de réservation', () => {
  assert.equal(timeOfDay('08:12'), '08:12')
  assert.equal(timeOfDay('24:00'), null)
  assert.equal(timeOfDay('8:12'), null)
  assert.deepEqual(timePoint({ date: '2027-05-12', time: '15:00' }), { date: '2027-05-12', time: '15:00' })
  assert.deepEqual(timePoint({ date: '12/05/2027' }), { date: '', time: null })
  assert.deepEqual(timePoint(undefined), { date: '', time: null })
})

test('un lieu a ses deux coordonnées ou aucune', () => {
  assert.deepEqual(
    place({ name: ' Tour de Belém ', lat: '38.6916', lng: -9.216, mapsUrl: 'https://maps.app.goo.gl/x' }),
    { name: 'Tour de Belém', address: null, lat: 38.6916, lng: -9.216, mapsUrl: 'https://maps.app.goo.gl/x' },
  )
  const half = place({ name: 'Quelque part', lat: 38.7, lng: '' })
  assert.equal(half.lat, null)
  assert.equal(half.lng, null)
  assert.equal(place({ lat: 95, lng: 10 }).lat, null, 'latitude impossible')
})

test('devises sur trois lettres', () => {
  assert.equal(currencyCode('eur'), 'EUR')
  assert.equal(currencyCode('€'), null)
})

test('les métadonnées reportent le créateur d’origine', () => {
  const now = '2027-05-01T10:00:00.000Z'
  assert.deepEqual(stamp(null, 'clement', now), { createdAt: now, createdBy: 'clement', updatedAt: now, updatedBy: 'clement' })
  assert.deepEqual(
    stamp({ createdAt: '2027-04-01', createdBy: 'lise' }, 'clement', now),
    { createdAt: '2027-04-01', createdBy: 'lise', updatedAt: now, updatedBy: 'clement' },
  )
})
