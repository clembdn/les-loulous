// node --test src/apps/trip/utils/*.test.mjs
//
// Les nuits : qui les couvre, les trous, les doublons, la bande des nuits.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nightGaps, nightsOf, staySegments, staysForNight, tonightStay } from './nights.js'

const stay = (id, checkIn, checkOut, name = id) => ({
  id, name, checkIn: { date: checkIn, time: null }, checkOut: { date: checkOut, time: null },
})

const DAYS = ['2027-05-12', '2027-05-13', '2027-05-14', '2027-05-15', '2027-05-16', '2027-05-17']

test('un séjour couvre ses nuits, pas le jour du départ', () => {
  const alfama = stay('alfama', '2027-05-12', '2027-05-14')
  assert.deepEqual(staysForNight('2027-05-12', [alfama]), [alfama])
  assert.deepEqual(staysForNight('2027-05-13', [alfama]), [alfama])
  assert.deepEqual(staysForNight('2027-05-14', [alfama]), [], 'on rend les clés le 14')
  assert.equal(tonightStay('2027-05-13', [alfama]).id, 'alfama')
  assert.equal(tonightStay('2027-05-14', [alfama]), null)
})

test('trous et doublons, sauf la dernière nuit qui n’a rien à trouver', () => {
  const stays = [
    stay('alfama', '2027-05-12', '2027-05-14'),
    stay('pins', '2027-05-15', '2027-05-17'),
    stay('erreur', '2027-05-16', '2027-05-17'),
  ]
  const nights = nightsOf(DAYS, stays)
  assert.deepEqual(nights.filter((n) => n.gap).map((n) => n.date), ['2027-05-14'])
  assert.deepEqual(nights.filter((n) => n.overlap).map((n) => n.date), ['2027-05-16'])
  assert.equal(nights.at(-1).isLast, true)
  assert.equal(nights.at(-1).gap, false, 'la nuit du retour n’est pas un trou')
  assert.deepEqual(nightGaps(DAYS, stays), ['2027-05-14'])
})

test('barres de la bande : découpées aux bornes du voyage, couleurs dans l’ordre des arrivées', () => {
  const stays = [
    stay('lagos', '2027-05-16', '2027-05-20'),
    stay('avant', '2027-05-10', '2027-05-13'),
    stay('hors', '2027-06-01', '2027-06-03'),
  ]
  const segments = staySegments(DAYS, stays)
  assert.deepEqual(
    segments.map(({ stay: s, start, span, lane, colorIndex }) => [s.id, start, span, lane, colorIndex]),
    [
      ['avant', 0, 1, 0, 0],  // arrivé avant le voyage : seule la nuit du 12 est visible
      ['lagos', 4, 2, 0, 1],  // part après : nuits du 16 et du 17
    ],
    'un séjour hors du voyage n’a pas de barre',
  )
})

test('deux réservations pour les mêmes nuits passent sur deux lignes', () => {
  const segments = staySegments(DAYS, [
    stay('a', '2027-05-12', '2027-05-15'),
    stay('b', '2027-05-14', '2027-05-16'),
    stay('c', '2027-05-15', '2027-05-17'),
  ])
  assert.deepEqual(segments.map((s) => [s.stay.id, s.lane]), [['a', 0], ['b', 1], ['c', 0]])
})
