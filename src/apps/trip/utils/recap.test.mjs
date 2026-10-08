// node --test src/apps/trip/utils/*.test.mjs
//
// Le récap d'un voyage : kilomètres (calculés ou estimés), lieux, pays.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haversineM } from './geo.js'
import { LEG_VERSION } from './legs.js'
import { buildDayTimeline } from './timeline.js'
import { nightsOf } from './nights.js'
import { dayDistances, flagOf, formatKm, tripCountries, tripRecap } from './recap.js'

const BELEM = { lat: 38.6916, lng: -9.216 }
const PASTEIS = { lat: 38.69751, lng: -9.20321 } // ~1,3 km de Belém
const GRACA = { lat: 38.7166, lng: -9.131 } // ~7 km de Pastéis
const AZORES = { lat: 37.7412, lng: -25.6756 }
const stop = (id, at, extra = {}) => ({ id, name: id, ...at, time: null, durationMin: null, category: 'visit', notes: '', ...extra })
const okLeg = (from, to, mode, distanceM) => ({ from, to, mode, manual: false, status: 'ok', distanceM, durationS: 600, polyline: 'x', v: LEG_VERSION })

test('une journée : par la route quand c’est calculé, à vol d’oiseau sinon', () => {
  const items = buildDayTimeline('2027-05-12', [stop('a', BELEM), stop('b', PASTEIS), stop('c', GRACA)])
  const straight = haversineM(PASTEIS, GRACA)
  const d = dayDistances(items, [okLeg(BELEM, PASTEIS, 'walk', 1556)])
  assert.equal(d.byMode.walk, 1556)
  assert.ok(Math.abs(d.byMode.car - straight) < 1, 'plus de 1,5 km : en voiture, estimé')
  assert.ok(Math.abs(d.totalM - (1556 + straight)) < 1)
  assert.ok(Math.abs(d.estimatedM - straight) < 1)
  // Un trajet rangé dans un autre mode que celui de la frise ne compte pas pour lui.
  const other = dayDistances(items, [okLeg(BELEM, PASTEIS, 'car', 3900)])
  assert.equal(other.byMode.walk, haversineM(BELEM, PASTEIS))
  assert.equal(other.byMode.car > 0, true)
})

test('le voyage : journées, trajets réservés à vol d’oiseau, location de voiture exclue', () => {
  const dayKeys = ['2027-05-12', '2027-05-13', '2027-05-14']
  const hotel = { id: 'h', name: 'Hôtel', ...BELEM, checkIn: { date: '2027-05-12', time: null }, checkOut: { date: '2027-05-14', time: null } }
  const flight = { id: 'f', mode: 'flight', from: { ...GRACA, date: '2027-05-14', time: '10:00' }, to: { ...AZORES, date: '2027-05-14', time: '11:00' } }
  const rental = { id: 'r', mode: 'car', from: { ...BELEM, date: '2027-05-12', time: null }, to: { ...GRACA, date: '2027-05-14', time: null } }
  const days = {
    '2027-05-12': { title: 'Belém', stops: [stop('a', BELEM), stop('b', PASTEIS), stop('x', { lat: null, lng: null })], legs: [okLeg(BELEM, PASTEIS, 'walk', 1556)] },
  }
  const timelines = Object.fromEntries(dayKeys.map((d) => [d, buildDayTimeline(d, days[d]?.stops || [], [hotel], [flight, rental])]))
  const recap = tripRecap({ dayKeys, days, timelines, stays: [hotel], transports: [flight, rental], nights: nightsOf(dayKeys, [hotel]) })

  assert.equal(recap.stops, 3)
  assert.equal(recap.located, 2)
  assert.equal(recap.stays, 1)
  assert.equal(recap.nights, 2)
  assert.deepEqual(recap.perDay.map((d) => [d.date, d.title, d.stops]), [['2027-05-12', 'Belém', 3], ['2027-05-13', null, 0], ['2027-05-14', null, 0]])
  const flightM = haversineM(GRACA, AZORES)
  assert.ok(Math.abs(recap.distance.byMode.flight - flightM) < 1)
  assert.ok(recap.distance.byMode.flight > 1_400_000 && recap.distance.byMode.flight < 1_500_000, 'Lisbonne → Açores ≈ 1 450 km')
  // Le premier jour : Belém → Pastéis seulement. L'étape « x » sans position coupe la suite
  // (Pastéis → x → arrivée à l'hôtel) : la frise n'y montre pas de trajet, le récap non plus.
  assert.equal(recap.distance.byMode.walk, 1556)
  assert.ok(Math.abs(recap.distance.totalM - (recap.perDay.reduce((n, d) => n + d.distanceM, 0) + flightM)) < 1, 'location exclue')
})

test('les pays du voyage, les plus fréquentés d’abord, villes sans doublon', () => {
  const places = [
    { lat: 1, lng: 1, c: 'PT', city: 'Lisbonne' },
    { lat: 2, lng: 2, c: 'PT', city: 'Lisbonne' },
    { lat: 3, lng: 3, c: 'ES', city: 'Séville' },
    { lat: 4, lng: 4, c: 'PT', city: null },
    { lat: 5, lng: 5, c: null, city: 'En mer' },
    { lat: 6, lng: 6, c: 'PT', city: 'Porto' },
  ]
  assert.deepEqual(tripCountries(places, (p) => p.c, (p) => p.city), [
    { id: 'PT', cities: ['Lisbonne', 'Porto'] },
    { id: 'ES', cities: ['Séville'] },
  ])
})

test('les kilomètres : milliers séparés au-delà de 10 km', () => {
  assert.equal(formatKm(850), '850 m')
  assert.equal(formatKm(4200), '4,2 km')
  assert.equal(formatKm(1_734_400).replace(/\s/g, ' '), '1 734 km')
  assert.equal(formatKm(NaN), '')
})

test('le drapeau d’un pays', () => {
  assert.equal(flagOf('PT'), '🇵🇹')
  assert.equal(flagOf('NC'), '🇳🇨')
  assert.equal(flagOf('pt'), '')
  assert.equal(flagOf(null), '')
})
