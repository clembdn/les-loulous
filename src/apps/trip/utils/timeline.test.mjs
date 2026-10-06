// node --test src/apps/trip/utils/*.test.mjs
//
// La frise d'une journée : étapes à la main, réservations placées par heure.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDayTimeline, dayStatus, insertionPointByTime, insertStopByTime, isPast, lastStartedIndex, moveStop, pastKeys,
  toMinutes,
} from './timeline.js'

const D = '2027-05-14'
const stop = (id, time = null, durationMin = null) => ({ id, name: id, time, durationMin })
const stay = (id, checkIn, checkOut) => ({ id, name: id, checkIn, checkOut })
const transport = (id, from, to) => ({ id, from, to })
const keys = (items) => items.map((i) => i.key)

test('heures en minutes', () => {
  assert.equal(toMinutes('09:30'), 570)
  assert.equal(toMinutes(null), null)
})

test('les étapes gardent l’ordre manuel et sont numérotées', () => {
  const items = buildDayTimeline(D, [stop('b', '14:00'), stop('a'), stop('c', '09:00')])
  assert.deepEqual(keys(items), ['stop-b', 'stop-a', 'stop-c'])
  assert.deepEqual(items.map((i) => i.number), [1, 2, 3])
})

test('un trajet daté se glisse avant la première étape datée qui ne le précède pas', () => {
  const items = buildDayTimeline(
    D,
    [stop('petitdej'), stop('pena', '09:00'), stop('cabo', '15:00')],
    [],
    [transport('train', { date: D, time: '12:10' }, { date: D, time: '12:50' })],
  )
  assert.deepEqual(keys(items), ['stop-petitdej', 'stop-pena', 'transport-train', 'stop-cabo'])
  assert.equal(items[2].phase, 'both')
  assert.equal(items[2].endTime, '12:50')
})

test('journée de route : on rend la chambre, on part, on arrive, on pose ses valises', () => {
  const items = buildDayTimeline(
    D,
    [stop('dejeuner', '13:00')],
    [
      stay('alfama', { date: '2027-05-12', time: '15:00' }, { date: D, time: null }),
      stay('pins', { date: D, time: null }, { date: '2027-05-16', time: '11:00' }),
    ],
    [transport('vol', { date: D, time: '18:00' }, { date: D, time: '19:10' })],
  )
  assert.deepEqual(keys(items), ['checkout-alfama', 'stop-dejeuner', 'transport-vol', 'checkin-pins'])
})

test('à la même heure, le départ passe avant l’arrivée', () => {
  const items = buildDayTimeline(
    D,
    [],
    [
      stay('a', { date: '2027-05-12', time: null }, { date: D, time: '11:00' }),
      stay('b', { date: D, time: '11:00' }, { date: '2027-05-16', time: null }),
    ],
  )
  assert.deepEqual(keys(items), ['checkout-a', 'checkin-b'])
})

test('un trajet de nuit apparaît au départ le premier jour, à l’arrivée le lendemain', () => {
  const nuit = transport('nuit', { date: D, time: '22:40' }, { date: '2027-05-15', time: '07:05' })
  const day1 = buildDayTimeline(D, [], [], [nuit])
  const day2 = buildDayTimeline('2027-05-15', [stop('musee', '10:00')], [], [nuit])
  assert.deepEqual(day1.map((i) => [i.key, i.phase, i.time]), [['transport-nuit-dep', 'departure', '22:40']])
  assert.deepEqual(keys(day2), ['transport-nuit-arr', 'stop-musee'])
})

test('une location de voiture : prise le premier jour, retour le dernier, rien entre les deux', () => {
  const voiture = transport('voiture', { date: '2027-05-12', time: '10:00' }, { date: '2027-05-17', time: '18:00' })
  assert.equal(buildDayTimeline('2027-05-12', [], [], [voiture])[0].phase, 'departure')
  assert.deepEqual(buildDayTimeline(D, [], [], [voiture]), [])
  assert.equal(buildDayTimeline('2027-05-17', [], [], [voiture])[0].phase, 'arrival')
})

test('où en est la journée : en cours (heure + durée), puis le prochain élément daté', () => {
  const items = buildDayTimeline(D, [
    stop('pena', '09:00', 120),
    stop('regaleira', '12:00', 90),
    stop('sansheure'),
    stop('cabo', '15:00'),
  ])
  assert.deepEqual(
    [dayStatus(items, '10:15').current?.key, dayStatus(items, '10:15').next?.key],
    ['stop-pena', 'stop-regaleira'],
  )
  assert.deepEqual(
    [dayStatus(items, '11:30').current?.key, dayStatus(items, '11:30').next?.key],
    [undefined, 'stop-regaleira'],
  )
  assert.equal(dayStatus(items, '16:00').next, null)
})

test('le prochain élément est le plus tôt à venir, même si l’ordre manuel est différent', () => {
  const items = buildDayTimeline(D, [stop('diner', '20:00'), stop('plage', '16:00')])
  assert.equal(dayStatus(items, '12:00').next.key, 'stop-plage')
})

test('passé : seulement ce qui a une heure, durée comprise', () => {
  const [pena, sansheure] = buildDayTimeline(D, [stop('pena', '09:00', 120), stop('libre')])
  assert.equal(isPast(pena, '10:00'), false)
  assert.equal(isPast(pena, '11:01'), true)
  assert.equal(isPast(sansheure, '23:59'), false)
})

test('déplacer une étape avant une voisine, dans sa journée ou vers une autre', () => {
  const byDate = {
    '2027-05-14': [stop('a'), stop('b'), stop('c')],
    '2027-05-15': [stop('x'), stop('y')],
  }
  assert.deepEqual(
    moveStop(byDate, { fromDate: '2027-05-14', stopId: 'a', toDate: '2027-05-14', beforeId: 'c' })['2027-05-14'].map((s) => s.id),
    ['b', 'a', 'c'],
    'descendre d’un cran sans décalage',
  )
  assert.deepEqual(
    moveStop(byDate, { fromDate: '2027-05-14', stopId: 'c', toDate: '2027-05-14', beforeId: 'a' })['2027-05-14'].map((s) => s.id),
    ['c', 'a', 'b'],
  )
  const moved = moveStop(byDate, { fromDate: '2027-05-14', stopId: 'b', toDate: '2027-05-15', beforeId: null })
  assert.deepEqual(moved['2027-05-14'].map((s) => s.id), ['a', 'c'])
  assert.deepEqual(moved['2027-05-15'].map((s) => s.id), ['x', 'y', 'b'])
  assert.deepEqual(
    moveStop(byDate, { fromDate: '2027-05-14', stopId: 'a', toDate: '2027-05-16' })['2027-05-16'].map((s) => s.id),
    ['a'],
    'vers un jour encore vide',
  )
  assert.equal(moveStop(byDate, { fromDate: '2027-05-14', stopId: 'zz', toDate: '2027-05-15' }), null)
})

test('lâchée sur un autre jour, une étape se range à son heure', () => {
  const stops = [stop('a', '09:00'), stop('libre'), stop('b', '14:00')]
  assert.equal(insertionPointByTime(stops, '11:00'), 'b')
  assert.equal(insertionPointByTime(stops, '08:00'), 'a')
  assert.equal(insertionPointByTime(stops, '20:00'), null)
  assert.equal(insertionPointByTime(stops, null), null, 'sans heure : en fin de journée')
})

test('griser la journée : les horaires finis, et les étapes sans heure qu’on a dépassées', () => {
  const items = buildDayTimeline(D, [stop('musee', '09:00', 60), stop('flaner'), stop('train', '14:00', 120), stop('glace')])
  assert.equal(lastStartedIndex(items, '08:00'), -1)
  assert.equal(lastStartedIndex(items, '14:30'), 2)
  // 10:30 : le musée est fini, on flâne peut-être encore.
  assert.deepEqual([...pastKeys(items, '10:30')], ['stop-musee'])
  // 14:30 : dans le train, la flânerie est derrière nous ; le train ne l'est pas.
  assert.deepEqual([...pastKeys(items, '14:30')], ['stop-musee', 'stop-flaner'])
  // Ce qui vient après le dernier horaire reste à faire, même tard.
  assert.deepEqual([...pastKeys(items, '23:00')], ['stop-musee', 'stop-flaner', 'stop-train'])
})

test('une nouvelle étape se range à son heure, sinon en fin de journée', () => {
  const stops = [{ id: 'a', time: '09:00' }, { id: 'b', time: null }, { id: 'c', time: '14:00' }]
  assert.deepEqual(insertStopByTime(stops, { id: 'n', time: '11:00' }).map((s) => s.id), ['a', 'b', 'n', 'c'])
  assert.deepEqual(insertStopByTime(stops, { id: 'n', time: null }).map((s) => s.id), ['a', 'b', 'c', 'n'])
  assert.deepEqual(insertStopByTime(stops, { id: 'n', time: '20:00' }).map((s) => s.id), ['a', 'b', 'c', 'n'])
})
