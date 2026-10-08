// node --test src/apps/trip/utils/*.test.mjs
//
// Liste « à caser » : où placer un lieu repéré, ce qui est près d'une journée.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  closestDay, dayPoints, distanceToPoints, ideaToStop, ideasNear, rankDays, sortIdeas, stopToIdea,
} from './ideas.js'

// Lisbonne, Sintra (~25 km), Porto (~275 km).
const BELEM = { lat: 38.6916, lng: -9.216 }
const HOTEL_LX = { id: 'lx', lat: 38.7105, lng: -9.144 }
const PENA = { lat: 38.7876, lng: -9.3906 }
const HOTEL_PORTO = { id: 'po', lat: 41.1496, lng: -8.611 }
const ORIENTE = { lat: 38.7678, lng: -9.0990 }

const stop = (id, at) => ({ type: 'stop', key: `stop-${id}`, stop: { id, ...at } })
const night = (stay) => ({ stays: stay ? [stay] : [] })

test('les points d’un jour : étapes, hôtel du matin et du soir, gares du trajet', () => {
  const dayKeys = ['2027-05-12', '2027-05-13']
  const timelines = {
    '2027-05-12': [stop('a', BELEM), stop('b', { lat: null, lng: null })],
    '2027-05-13': [{
      type: 'transport', key: 't', phase: 'departure',
      transport: { from: ORIENTE, to: { lat: 41.15, lng: -8.58 } },
    }],
  }
  const nights = [night(HOTEL_LX), night(HOTEL_PORTO)]
  const points = dayPoints(dayKeys, timelines, nights)
  assert.deepEqual(points['2027-05-12'], [BELEM, { lat: HOTEL_LX.lat, lng: HOTEL_LX.lng }])
  // Départ seulement ce jour-là : la gare d'arrivée appartient au jour suivant.
  assert.deepEqual(points['2027-05-13'], [
    ORIENTE,
    { lat: HOTEL_LX.lat, lng: HOTEL_LX.lng },
    { lat: HOTEL_PORTO.lat, lng: HOTEL_PORTO.lng },
  ])
})

test('un lieu sans position n’est près de rien', () => {
  assert.equal(distanceToPoints({ lat: null, lng: null }, [BELEM]), Infinity)
  assert.equal(distanceToPoints(BELEM, []), Infinity)
  assert.deepEqual(rankDays({ name: 'x' }, { d: [BELEM] }), [])
})

test('le jour suggéré est le plus proche, et jamais au-delà de 50 km', () => {
  const points = { '2027-05-12': [HOTEL_LX], '2027-05-15': [HOTEL_PORTO] }
  assert.equal(closestDay(PENA, points).date, '2027-05-12')
  assert.equal(closestDay({ lat: 37.0194, lng: -7.9304 }, points), null) // Faro
})

test('à égalité (même hôtel), le jour le moins chargé, puis le plus tôt', () => {
  const points = { '2027-05-12': [HOTEL_LX], '2027-05-13': [HOTEL_LX], '2027-05-14': [HOTEL_LX] }
  const counts = { '2027-05-12': 4, '2027-05-13': 1, '2027-05-14': 1 }
  assert.deepEqual(rankDays(BELEM, points, { stopCounts: counts }).map((d) => d.date), ['2027-05-13', '2027-05-14', '2027-05-12'])
  // Une vraie différence de distance l'emporte sur la charge.
  const nearer = { ...points, '2027-05-12': [BELEM] }
  assert.equal(closestDay(BELEM, nearer, { stopCounts: counts }).date, '2027-05-12')
})

test('pendant le voyage, jamais un jour passé', () => {
  const points = { '2027-05-12': [HOTEL_LX], '2027-05-13': [{ lat: 38.75, lng: -9.2 }] }
  assert.equal(closestDay(BELEM, points).date, '2027-05-12')
  assert.equal(closestDay(BELEM, points, { from: '2027-05-13' }).date, '2027-05-13')
  assert.equal(closestDay(BELEM, points, { from: '2027-05-14' }), null)
})

test('ce qui est près d’une journée, du plus proche au plus lointain', () => {
  const ideas = [
    { id: 'pena', name: 'Pena', ...PENA },
    { id: 'belem', name: 'Belém', ...BELEM },
    { id: 'clerigos', name: 'Clérigos', lat: 41.1458, lng: -8.6143 },
    { id: 'nowhere', name: 'Sans position', lat: null, lng: null },
  ]
  assert.deepEqual(ideasNear(ideas, [HOTEL_LX]).map((x) => x.idea.id), ['belem'])
  assert.deepEqual(ideasNear(ideas, [HOTEL_LX], 40_000).map((x) => x.idea.id), ['belem', 'pena'])
  assert.deepEqual(ideasNear(ideas, []), [])
})

test('les derniers repérés en premier', () => {
  const list = sortIdeas([
    { id: 'a', name: 'B', createdAt: '2027-01-01T10:00:00Z' },
    { id: 'b', name: 'A', createdAt: '2027-01-02T10:00:00Z' },
    { id: 'c', name: 'C', createdAt: null },
  ])
  assert.deepEqual(list.map((i) => i.id), ['b', 'a', 'c'])
})

test('idée ↔ étape garde l’identifiant, perd l’heure et la durée en repartant', () => {
  const idea = { id: 'x', name: 'Pena', address: 'Sintra', ...PENA, mapsUrl: null, category: 'visit', notes: 'Billets' }
  const asStop = ideaToStop(idea, '10:30')
  assert.equal(asStop.id, 'x')
  assert.equal(asStop.time, '10:30')
  assert.equal(asStop.durationMin, null)
  const back = stopToIdea({ ...asStop, durationMin: 90 })
  assert.deepEqual(back, { id: 'x', name: 'Pena', address: 'Sintra', ...PENA, mapsUrl: null, category: 'visit', notes: 'Billets' })
})
