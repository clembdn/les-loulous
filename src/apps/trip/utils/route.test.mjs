// node --test src/apps/trip/utils/*.test.mjs
//
// Le parcours d'une journée : points de la mini-carte, distances de la frise.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDayTimeline } from './timeline.js'
import { dayRoute, timelineLegs } from './route.js'

const D = '2027-05-14'
const stop = (id, time, lat, lng) => ({ id, name: id, time, lat, lng })
const stay = (id, checkIn, checkOut, lat = 38.71, lng = -9.13) => ({ id, name: id, lat, lng, checkIn, checkOut })
const at = (date, time = null) => ({ date, time })

test('les points dans l’ordre de la frise, étapes numérotées, sans les lieux inconnus', () => {
  const items = buildDayTimeline(
    D,
    [stop('pena', '09:00', 38.79, -9.39), stop('inconnu', '11:00', null, null), stop('cabo', '15:00', 38.78, -9.5)],
    [stay('alfama', at('2027-05-12'), at(D, '08:00'))],
  )
  const { points, segments } = dayRoute(items)
  assert.deepEqual(points.map((p) => [p.kind, p.number ?? null]), [['stay', null], ['stop', 1], ['stop', 3]])
  assert.deepEqual(segments.map((s) => [s.from, s.to, s.booked]), [[0, 1, false], [1, 2, false]])
})

test('un trajet réservé : départ et arrivée reliés en pointillés', () => {
  const vol = {
    id: 'vol', mode: 'flight',
    from: { name: 'LIS', lat: 38.77, lng: -9.13, date: D, time: '10:00' },
    to: { name: 'FAO', lat: 37.01, lng: -7.97, date: D, time: '10:50' },
  }
  const items = buildDayTimeline(D, [stop('plage', '15:00', 37.08, -8.67)], [], [vol])
  const { points, segments } = dayRoute(items)
  assert.deepEqual(points.map((p) => p.kind), ['transport', 'transport', 'stop'])
  assert.deepEqual(segments.map((s) => s.booked), [true, false])
})

test('l’hébergement du soir comme repère, s’il n’est pas déjà dans la journée', () => {
  const pins = stay('pins', at('2027-05-13'), at('2027-05-16'), 38.38, -8.79)
  const items = buildDayTimeline(D, [stop('plage', '10:00', 38.35, -8.78)], [pins])
  assert.equal(dayRoute(items, { home: pins }).home.stayId, 'pins')
  const arrival = buildDayTimeline(D, [], [stay('pins', at(D, '16:00'), at('2027-05-16'), 38.38, -8.79)])
  assert.equal(dayRoute(arrival, { home: pins }).home, null, 'on y arrive ce jour-là : déjà un point')
})

test('distances entre éléments consécutifs localisés, jamais autour d’un trajet ni pour 0 m', () => {
  const items = buildDayTimeline(D, [
    stop('a', '09:00', 38.6975, -9.2032),
    stop('b', '10:30', 38.6916, -9.216),
    stop('c', '12:00', null, null),
    stop('d', '14:00', 38.7037, -9.1785),
    stop('e', '19:00', 38.7037, -9.1785),
  ])
  const legs = timelineLegs(items)
  assert.deepEqual(Object.keys(legs), ['stop-a'])
  assert.ok(legs['stop-a'].distanceM > 1100 && legs['stop-a'].distanceM < 1400)
})
