// node --test src/apps/trip/utils/*.test.mjs
//
// Trajets calculés : ce qui manque, les courses groupées, ce qu'on range.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  autoMode, formatTravel, legKey, legRuns, mergeLegs, missingLegs, normalizeLeg, routedLegs, withLegMode,
} from './legs.js'

const A = { lat: 38.6916, lng: -9.216 }
const B = { lat: 38.69751, lng: -9.20321 } // ~1,3 km de A
const C = { lat: 38.7166, lng: -9.131 } // ~6,6 km de B
const D = { lat: 38.7105, lng: -9.144 }

// La forme de `timelineLegs` (utils/route.js).
const TIMELINE = {
  'stop-a': { distanceM: 1300, from: A, to: B },
  'stop-b': { distanceM: 6600, from: B, to: C },
  'stop-c': { distanceM: 1300, from: C, to: D },
}

const ok = (from, to, mode, extra = {}) => ({ from, to, mode, manual: false, status: 'ok', distanceM: 1500, durationS: 1200, polyline: 'abc', ...extra })

test('le mode suit la distance : à pied jusqu’à 1,5 km', () => {
  assert.equal(autoMode(1500), 'walk')
  assert.equal(autoMode(1501), 'car')
})

test('sans rien de rangé, tout est à calculer, en courses qui s’enchaînent', () => {
  const routed = routedLegs(TIMELINE, [])
  assert.deepEqual(Object.values(routed).map((l) => l.mode), ['walk', 'car', 'walk'])
  const missing = missingLegs(routed)
  assert.equal(missing.length, 3)
  const runs = legRuns(missing)
  assert.deepEqual(runs.map((r) => [r.mode, r.points.length]), [['walk', 2], ['car', 2], ['walk', 2]])
})

test('deux tronçons à pied qui se suivent partent en une requête', () => {
  const walkAll = { 'stop-a': TIMELINE['stop-a'], 'stop-c': { distanceM: 900, from: B, to: D } }
  const runs = legRuns(missingLegs(routedLegs(walkAll, [])))
  assert.equal(runs.length, 1)
  assert.deepEqual(runs[0].points, [A, B, D])
  assert.equal(runs[0].legs.length, 2)
})

test('un trajet connu est retrouvé par ses deux bouts, au mètre près', () => {
  const nearA = { lat: A.lat + 0.000001, lng: A.lng }
  const routed = routedLegs(TIMELINE, [ok(nearA, B, 'walk')])
  assert.equal(routed['stop-a'].route.status, 'ok')
  assert.equal(missingLegs(routed).length, 2)
})

test('un mode choisi à la main l’emporte, et ce qui est rangé dans un autre mode ne compte pas', () => {
  const routed = routedLegs(TIMELINE, [ok(B, C, 'bike', { manual: true }), ok(A, B, 'car')])
  assert.equal(routed['stop-b'].mode, 'bike')
  assert.ok(routed['stop-b'].route)
  assert.equal(routed['stop-a'].mode, 'walk')
  assert.equal(routed['stop-a'].route, null, 'calculé en voiture, il faut le refaire à pied')
})

test('ranger : les trajets du jour seulement, résultats compris', () => {
  const routed = routedLegs(TIMELINE, [ok(A, B, 'walk'), ok(D, A, 'car')])
  const results = {
    [legKey(B, C)]: { status: 'ok', distanceM: 7100, durationS: 900, polyline: 'xyz' },
    [legKey(C, D)]: { status: 'none' },
  }
  const saved = mergeLegs(routed, results)
  assert.equal(saved.length, 3, 'D → A n’est plus dans la journée')
  assert.deepEqual(saved.map((l) => l.status), ['ok', 'ok', 'none'])
  assert.equal(saved[1].durationS, 900)
  assert.equal(saved[2].polyline, null)
  assert.deepEqual(saved.map(normalizeLeg), saved, 'ce qu’on range se relit tel quel')
})

test('changer de mode : à recalculer ; revenir au mode auto le rend automatique', () => {
  const routed = routedLegs(TIMELINE, [ok(B, C, 'car')])
  const bike = withLegMode([ok(B, C, 'car')], routed['stop-b'], 'bike')
  assert.equal(bike.length, 1)
  assert.deepEqual([bike[0].mode, bike[0].manual, bike[0].status], ['bike', true, 'pending'])
  const again = routedLegs(TIMELINE, bike)
  assert.equal(again['stop-b'].mode, 'bike')
  assert.equal(again['stop-b'].route, null)
  const back = withLegMode(bike, again['stop-b'], 'car')
  assert.equal(back[0].manual, false)
})

test('relire un trajet abîmé', () => {
  assert.equal(normalizeLeg({ from: A }), null)
  const odd = normalizeLeg({ from: A, to: B, mode: 'rocket', status: 'ok', distanceM: -3 })
  assert.equal(odd.mode, 'car')
  assert.equal(odd.distanceM, null)
  assert.equal(normalizeLeg({ from: A, to: B, status: 'weird' }).status, 'pending')
})

test('durées de trajet', () => {
  assert.equal(formatTravel(20), '1 min')
  assert.equal(formatTravel(16 * 60), '16 min')
  assert.equal(formatTravel(65 * 60), '1 h 05')
  assert.equal(formatTravel(2 * 3600), '2 h')
  assert.equal(formatTravel(null), '')
})

test('résumé d’un trajet : calculé, sinon à vol d’oiseau', async () => {
  const { legSummary } = await import('./legs.js')
  const routed = routedLegs(TIMELINE, [ok(A, B, 'walk', { distanceM: 1640, durationS: 1180 })])
  assert.deepEqual(legSummary(routed['stop-a']), { routed: true, text: '20 min · 1,6 km' })
  assert.deepEqual(legSummary(routed['stop-b']), { routed: false, text: '≈ 6,6 km' })
})
