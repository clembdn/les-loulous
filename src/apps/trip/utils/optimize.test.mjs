// node --test src/apps/trip/utils/*.test.mjs
//
// Optimiser l'ordre d'une journée : ce qui bouge, ce qui reste, et le
// trajet le plus court entre les deux.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canOptimize, currentTokens, dayModel, EXACT_MAX_FREE, optimizeDay, pathCost, travelCost,
} from './optimize.js'

// Une rue droite d'est en ouest : `at(3)` est à 3 km à l'est de l'hôtel.
const LAT = 38.7
const KM = 1 / (111.32 * Math.cos(LAT * Math.PI / 180))
const at = (km) => ({ lat: LAT, lng: -9.2 + km * KM })
const DATE = '2027-05-12'
const HOTEL = { id: 'h', name: 'Hôtel', ...at(0), checkIn: { date: '2027-05-10', time: null }, checkOut: { date: '2027-05-15', time: null } }
const stop = (id, km, extra = {}) => ({ id, name: id, ...(km == null ? { lat: null, lng: null } : at(km)), time: null, ...extra })
const cost = travelCost(null)
const ids = (stops) => stops.map((s) => s.id)

function run(stops, { stays = [HOTEL], transports = [], tonight = HOTEL } = {}) {
  const model = dayModel({ date: DATE, stops, stays, transports, morning: HOTEL, tonight })
  return { model, result: optimizeDay(model, stops, cost) }
}

test('une rue droite : on va au plus loin en passant par les autres, puis on rentre', () => {
  const stops = [stop('c', 3), stop('a', 1), stop('b', 2)]
  const { result } = run(stops)
  assert.equal(result.changed, true)
  const order = ids(result.stops).join('')
  assert.ok(order === 'abc' || order === 'cba', order)
  assert.ok(result.after.distanceM < result.before.distanceM)
  // Aller-retour de 3 km, à vol d'oiseau majoré des détours de la rue.
  assert.ok(Math.abs(result.after.distanceM - 6000 * 1.3) < 400, String(result.after.distanceM))
})

test('déjà dans le bon ordre : on n’y touche pas', () => {
  const stops = [stop('a', 1), stop('b', 2), stop('c', 3)]
  const { result } = run(stops)
  assert.equal(result.changed, false)
  assert.equal(result.stops, stops)
  assert.deepEqual(result.after, result.before)
})

test('une étape à heure fixe reste, dans l’ordre des heures fixées ; une étape libre la contourne', () => {
  // Déjeuner réservé à 12:30 tout au bout ; une visite juste à côté, rangée en fin de journée.
  const stops = [stop('a', 1), stop('lunch', 5, { time: '12:30' }), stop('dinner', 0.5, { time: '20:00' }), stop('near-lunch', 5.2)]
  const { result } = run(stops)
  const order = ids(result.stops)
  assert.ok(order.indexOf('lunch') < order.indexOf('dinner'), 'les heures fixées gardent leur ordre')
  assert.equal(Math.abs(order.indexOf('near-lunch') - order.indexOf('lunch')), 1, `à côté du déjeuner : ${order}`)
  assert.equal(result.stops.find((s) => s.id === 'lunch').time, '12:30')
})

test('la matinée garde son nombre d’étapes, regroupées par quartier', () => {
  // Hôtel tout près du déjeuner (13:00) : sans cette règle, tout irait
  // l'après-midi et le déjeuner deviendrait la première étape.
  const stops = [stop('far-west', -6), stop('east', 2), stop('lunch', 0.3, { time: '13:00' }), stop('near-east', 0.6), stop('west', -5)]
  const { result } = run(stops)
  const order = ids(result.stops)
  assert.equal(result.changed, true)
  assert.equal(order.indexOf('lunch'), 2, `deux étapes avant le déjeuner : ${order}`)
  // Chaque moitié de journée reste d'un seul côté de la ville.
  const sides = [order.slice(0, 2), order.slice(3)].map((half) => half.map((id) => id.includes('west')))
  sides.forEach((side) => assert.equal(new Set(side).size, 1, `un quartier par demi-journée : ${order}`))
})

test('une étape pas localisée ne bouge pas par rapport aux autres étapes fixées', () => {
  const stops = [stop('far', 4), stop('mystery', null), stop('near', 1), stop('mid', 2)]
  const { model, result } = run(stops)
  assert.deepEqual(ids(model.fixed), ['mystery'])
  assert.equal(result.changed, true)
  assert.ok(ids(result.stops).includes('mystery'))
  assert.equal(result.stops.length, 4)
})

test('un train à prendre : les étapes vont vers la gare, le train lui-même ne compte pas', () => {
  const station = at(10)
  const porto = { lat: 41.1496, lng: -8.611 }
  const train = {
    id: 't', mode: 'train',
    from: { name: 'Gare', ...station, date: DATE, time: '16:00' },
    to: { name: 'Porto', ...porto, date: DATE, time: '19:00' },
  }
  const appart = { id: 'p', name: 'Porto', ...porto, checkIn: { date: DATE, time: null }, checkOut: { date: '2027-05-14', time: null } }
  const stops = [stop('nine', 9), stop('one', 1), stop('five', 5)]
  // Départ de l'hôtel sans heure : il ouvre la journée. (À 11:00, la frise
  // placerait les étapes sans heure AVANT lui, et le trajet y repasserait.)
  const { result } = run(stops, { stays: [{ ...HOTEL, checkOut: { date: DATE, time: null } }, appart], transports: [train], tonight: appart })
  assert.deepEqual(ids(result.stops), ['one', 'five', 'nine'])
  // Hôtel → 1 → 5 → 9 → gare (10 km) ; Lisbonne → Porto en train exclu.
  assert.ok(result.after.distanceM < 15000, String(result.after.distanceM))
})

test('l’ordre calculé est celui que la frise affichera', () => {
  const train = {
    id: 't', mode: 'train',
    from: { name: 'Gare', ...at(6), date: DATE, time: '15:00' },
    to: { name: 'Ailleurs', ...at(40), date: DATE, time: '16:00' },
  }
  const stops = [stop('x', 7), stop('visit', 2, { time: '10:00' }), stop('y', 0.5), stop('z', 5)]
  const { result } = run(stops, { transports: [train] })
  const again = dayModel({ date: DATE, stops: result.stops, stays: [HOTEL], transports: [train], morning: HOTEL, tonight: HOTEL })
  const replay = pathCost(again, currentTokens(again, result.stops), cost)
  assert.ok(Math.abs(replay.distanceM - result.after.distanceM) < 1e-6)
})

test('au-delà de 12 étapes libres : pas d’exhaustif, mais la journée raccourcit', () => {
  const kms = [7, 2, 13, 5, 11, 1, 9, 4, 14, 3, 8, 6, 12, 10]
  assert.ok(kms.length > EXACT_MAX_FREE)
  const stops = kms.map((km) => stop(`s${km}`, km))
  const { result } = run(stops)
  assert.equal(result.exact, false)
  assert.ok(result.after.distanceM < result.before.distanceM)
  // Le meilleur possible : aller au bout (14 km) et revenir.
  const best = run([...stops].sort((a, b) => a.lng - b.lng)).result.before
  assert.ok(result.after.distanceM <= best.distanceM * 1.05, `${result.after.distanceM} vs ${best.distanceM}`)
})

test('les matrices d’ORS l’emportent sur l’estimation ; une case vide est estimée', () => {
  const a = { ...at(0), i: 0 }
  const b = { ...at(1), i: 1 }
  const c = { ...at(3), i: 2 }
  const matrix = {
    walk: { durations: [[0, 700, null], [690, 0, null], [null, null, 0]], distances: [[0, 1100, null], [1090, 0, null], [null, null, 0]] },
    car: { durations: [[0, 200, null], [210, 0, 400], [null, 380, 0]], distances: [[0, 2500, null], [2400, 0, 3100], [null, 3000, 0]] },
  }
  const withMatrix = travelCost(matrix)
  assert.deepEqual(withMatrix(a, b), { durationS: 700, distanceM: 1100 }, '1 km : à pied')
  assert.deepEqual(withMatrix(c, b), { durationS: 380, distanceM: 3000 }, '2 km : en voiture, sens c → b')
  const guessed = withMatrix(a, c)
  assert.ok(guessed.distanceM > 3000 && guessed.durationS > 0, 'pas de route connue : estimée')
})

test('à optimiser : au moins une étape libre, qui ait de quoi bouger', () => {
  assert.equal(canOptimize([stop('a', 1)]), false)
  assert.equal(canOptimize([stop('a', 1), stop('b', 2)]), true)
  assert.equal(canOptimize([stop('a', 1), stop('t', 2, { time: '10:00' })]), true)
  assert.equal(canOptimize([stop('t', 2, { time: '10:00' }), stop('u', null)]), false)
})
