// node --test src/apps/trip/utils/*.test.mjs
//
// L'écran Aujourd'hui : ce qui vient maintenant, où aller, quoi revoir avant de partir.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDayTimeline } from './timeline.js'
import { nightsOf } from './nights.js'
import { destinationOf, focusOf, fromMinutes, tripChecks } from './today.js'

const D = '2027-05-14'
const stop = (id, time = null, durationMin = null, extra = {}) => ({ id, name: id, time, durationMin, lat: 38.7, lng: -9.1, ...extra })
const at = (lat, lng) => ({ lat, lng })

test('minutes en heure murale', () => {
  assert.equal(fromMinutes(570), '09:30')
  assert.equal(fromMinutes(0), '00:00')
  // Une étape de 2 h à 23:00 ne finit pas « 25:00 ».
  assert.equal(fromMinutes(25 * 60), '23:59')
})

test('rien de prévu : journée libre', () => {
  assert.deepEqual(focusOf([], '10:00'), { kind: 'free', item: null })
})

test('en cours, puis le prochain élément daté avec le temps qu’il reste', () => {
  const items = buildDayTimeline(D, [stop('pena', '10:00', 90), stop('quinta', '14:00')])
  const during = focusOf(items, '10:45')
  assert.equal(during.kind, 'current')
  assert.equal(during.item.key, 'stop-pena')
  assert.equal(during.until, '11:30')

  const after = focusOf(items, '12:40')
  assert.equal(after.kind, 'next')
  assert.equal(after.item.key, 'stop-quinta')
  assert.equal(after.minutes, 80)
})

test('un horaire passe avant une étape sans heure : c’est lui qu’on ne doit pas rater', () => {
  const items = buildDayTimeline(D, [stop('flaner'), stop('train', '16:00')])
  const focus = focusOf(items, '09:00')
  assert.equal(focus.kind, 'next')
  assert.equal(focus.item.key, 'stop-train')
})

test('plus rien de daté : la suite du plan, dans l’ordre de la frise', () => {
  const items = buildDayTimeline(D, [stop('musee', '09:00'), stop('plage'), stop('diner')])
  const focus = focusOf(items, '11:00')
  assert.equal(focus.kind, 'then')
  assert.equal(focus.item.key, 'stop-plage')

  // Une journée sans aucune heure se lit depuis le début.
  const loose = buildDayTimeline(D, [stop('a'), stop('b')])
  assert.equal(focusOf(loose, '15:00').item.key, 'stop-a')
})

test('tout est derrière nous', () => {
  const items = buildDayTimeline(D, [stop('a', '09:00', 60), stop('b', '14:00', 60)])
  assert.deepEqual(focusOf(items, '18:00'), { kind: 'done', item: null })
})

test('un trajet réservé : le train de 12:10 est le prochain, même au milieu des étapes', () => {
  const train = {
    id: 'tgv', mode: 'train',
    from: { name: 'Oriente', ...at(38.76, -9.1), date: D, time: '12:10' },
    to: { name: 'Campanhã', ...at(41.15, -8.58), date: D, time: '15:05' },
  }
  const items = buildDayTimeline(D, [stop('cafe', '10:00', 30), stop('ribeira', '16:00')], [], [train])
  const focus = focusOf(items, '11:00')
  assert.equal(focus.kind, 'next')
  assert.equal(focus.item.key, 'transport-tgv')
  assert.equal(focus.minutes, 70)
  // Dans le train : en cours jusqu'à l'arrivée.
  const onBoard = focusOf(items, '13:00')
  assert.equal(onBoard.kind, 'current')
  assert.equal(onBoard.until, '15:05')
})

test('« Y aller » : où aller pour chaque élément de la frise', () => {
  const s = stop('pena')
  assert.equal(destinationOf({ type: 'stop', stop: s }), s)
  // Un nom seul ne mène nulle part de sûr.
  assert.equal(destinationOf({ type: 'stop', stop: { name: 'Café', lat: null, lng: null } }), null)

  const hotel = { id: 'h', name: 'Casa', address: 'Rua 1, Lisboa', lat: null, lng: null }
  assert.equal(destinationOf({ type: 'checkin', stay: hotel }), hotel)
  assert.equal(destinationOf({ type: 'checkout', stay: hotel }), null)

  const from = { name: 'Oriente', ...at(38.76, -9.1) }
  const to = { name: 'Campanhã', ...at(41.15, -8.58) }
  const train = { mode: 'train', from, to }
  assert.equal(destinationOf({ type: 'transport', phase: 'departure', transport: train }), from)
  assert.equal(destinationOf({ type: 'transport', phase: 'both', transport: train }), from)
  assert.equal(destinationOf({ type: 'transport', phase: 'arrival', transport: train }), null)
  // Déjà dans le train : plus rien à rejoindre.
  assert.equal(destinationOf({ type: 'transport', phase: 'both', transport: train }, { underway: true }), null)
  // Une voiture de location se ramène à l'agence, y compris en roulant.
  const car = { mode: 'car', from, to }
  assert.equal(destinationOf({ type: 'transport', phase: 'arrival', transport: car }), to)
  assert.equal(destinationOf({ type: 'transport', phase: 'both', transport: car }), from)
  assert.equal(destinationOf({ type: 'transport', phase: 'both', transport: car }, { underway: true }), to)
  assert.equal(destinationOf(null), null)
})

test('avant de partir : nuits sans toit, nuits réservées deux fois, étapes sans position', () => {
  const days = ['2027-05-12', '2027-05-13', '2027-05-14', '2027-05-15']
  const stays = [
    { id: 'a', name: 'A', checkIn: { date: '2027-05-12' }, checkOut: { date: '2027-05-14' } },
    { id: 'b', name: 'B', checkIn: { date: '2027-05-13' }, checkOut: { date: '2027-05-14' } },
  ]
  const stopsByDate = {
    '2027-05-12': [stop('ok')],
    '2027-05-13': [stop('perdu', null, null, { lat: null, lng: null })],
    '2027-06-01': [stop('hors-voyage', null, null, { lat: null, lng: null })],
  }
  const checks = tripChecks(nightsOf(days, stays), stopsByDate, days)
  // La dernière nuit n'est pas un trou : on rentre.
  assert.deepEqual(checks.gaps, ['2027-05-14'])
  assert.deepEqual(checks.overlaps.map((o) => [o.date, o.stays.map((s) => s.id)]), [['2027-05-13', ['a', 'b']]])
  // Un jour masqué (hors des dates du voyage) n'est pas à vérifier.
  assert.deepEqual(checks.unlocated.map((u) => u.stop.id), ['perdu'])
})
