// node --test api/_lib/*.test.mjs
//
// Trajets calculés : la requête envoyée à OpenRouteService et le découpage de
// sa réponse. Le réseau est simulé, d'après le format documenté de
// /v2/directions/{profile}/json ; `ors.live.mjs` le vérifie pour de vrai.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMatrix, computeRun, parsePoints } from './ors.js'
import { decodePolyline, encodePolyline } from '../../src/apps/trip/utils/polyline.js'

const LINE = [[38.6916, -9.216], [38.694, -9.21], [38.69751, -9.20321], [38.70, -9.18], [38.7166, -9.131]]

function fakeFetch(responses) {
  const calls = []
  const impl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body), headers: options.headers })
    const r = responses.shift()
    return { ok: r.status < 300, status: r.status, json: async () => r.json }
  }
  return { impl, calls }
}

const route = (wayPoints, segments) => ({
  status: 200,
  json: { routes: [{ geometry: encodePolyline(LINE), way_points: wayPoints, segments }] },
})

test('points : « lat,lng;lat,lng », 2 à 50', () => {
  assert.deepEqual(parsePoints('38.69,-9.21;38.71,-9.13'), [{ lat: 38.69, lng: -9.21 }, { lat: 38.71, lng: -9.13 }])
  assert.equal(parsePoints('38.69,-9.21'), null)
  assert.equal(parsePoints('38.69,-9.21;91,0'), null)
  assert.equal(parsePoints('abc;def'), null)
  assert.equal(parsePoints(null), null)
})

test('sans clé : 503, sans appel', async () => {
  const net = fakeFetch([])
  const r = await computeRun('car', '38.69,-9.21;38.71,-9.13', { key: '', fetchImpl: net.impl })
  assert.equal(r.status, 503)
  assert.equal(r.body.error, 'no-key')
  assert.equal(net.calls.length, 0)
})

test('une course A → B → C : une requête, découpée par tronçon', async () => {
  const net = fakeFetch([route([0, 2, 4], [{ distance: 1312.4, duration: 940.2 }, { distance: 7020, duration: 655 }])])
  const r = await computeRun('walk', '38.6916,-9.216;38.69751,-9.20321;38.7166,-9.131', { key: 'K', fetchImpl: net.impl })
  assert.equal(r.status, 200)
  assert.equal(net.calls.length, 1)
  assert.match(net.calls[0].url, /\/v2\/directions\/foot-walking\/json$/)
  assert.equal(net.calls[0].headers.authorization, 'K')
  assert.deepEqual(net.calls[0].body.coordinates[0], [-9.216, 38.6916], 'ORS attend [lng, lat]')
  assert.equal(net.calls[0].body.instructions, true, 'sans instructions, ORS ne rend pas `segments`')
  assert.deepEqual(r.body.legs.map((l) => [l.status, l.distanceM, l.durationS]), [['ok', 1312, 940], ['ok', 7020, 655]])
  const first = decodePolyline(r.body.legs[0].polyline)
  assert.deepEqual(first[0], LINE[0])
  assert.deepEqual(first.at(-1), LINE[2], 'le tronçon s’arrête au point de passage')
  assert.deepEqual(decodePolyline(r.body.legs[1].polyline)[0], LINE[2])
})

test('pas de route pour la course : chaque tronçon est redemandé seul', async () => {
  const net = fakeFetch([
    { status: 404, json: { error: { code: 2010 } } },
    route([0, 2], [{ distance: 1300, duration: 900 }]),
    { status: 404, json: {} },
  ])
  const r = await computeRun('car', '38.6916,-9.216;38.69751,-9.20321;38.7166,-9.131', { key: 'K', fetchImpl: net.impl })
  assert.equal(r.status, 200)
  assert.equal(net.calls.length, 3)
  assert.deepEqual(r.body.legs.map((l) => l.status), ['ok', 'none'])
})

test('clé refusée, quota, panne : une erreur, pas un « sans route »', async () => {
  for (const [status, expected] of [[403, 503], [401, 503], [429, 429], [500, 502]]) {
    const net = fakeFetch([{ status, json: {} }])
    const r = await computeRun('bike', '38.69,-9.21;38.71,-9.13', { key: 'K', fetchImpl: net.impl })
    assert.equal(r.status, expected, `ORS ${status}`)
  }
})

test('mode inconnu', async () => {
  const r = await computeRun('rocket', '38.69,-9.21;38.71,-9.13', { key: 'K', fetchImpl: async () => { throw new Error('non') } })
  assert.equal(r.status, 400)
})

// Réponses RÉELLES de /v2/matrix (capturées le 2026-10-08) : Belém, Pastéis
// de Belém, Graça, Ponta Delgada (Açores, sans route depuis Lisbonne).
const REAL_WALK = {
  durations: [[0.0, 1120.51, 6371.0, null], [1120.51, 0.0, 5463.85, null], [6371.0, 5463.85, 0.0, null], [null, null, null, 0.0]],
  distances: [[0.0, 1556.31, 8848.75, null], [1556.31, 0.0, 7588.81, null], [8848.75, 7588.81, 0.0, null], [null, null, null, 0.0]],
}
const REAL_CAR = {
  durations: [[0.0, 472.96, 1206.64, null], [320.58, 0.0, 1086.94, null], [1264.18, 1136.92, 0.0, null], [null, null, null, 0.0]],
  distances: [[0.0, 3891.4, 9480.41, null], [2684.71, 0.0, 8249.43, null], [9398.09, 8242.59, 0.0, null], [null, null, null, 0.0]],
}
const FOUR = '38.6916,-9.216;38.6975,-9.2032;38.7166,-9.131;37.7412,-25.6756'

test('matrice : à pied et en voiture, arrondie, les « sans route » restent nuls', async () => {
  const net = fakeFetch([{ status: 200, json: REAL_WALK }, { status: 200, json: REAL_CAR }])
  const r = await computeMatrix(FOUR, { key: 'K', fetchImpl: net.impl })
  assert.equal(r.status, 200)
  assert.equal(net.calls.length, 2)
  assert.match(net.calls[0].url, /\/v2\/matrix\/foot-walking$/)
  assert.match(net.calls[1].url, /\/v2\/matrix\/driving-car$/)
  assert.deepEqual(net.calls[0].body.locations[0], [-9.216, 38.6916], 'ORS attend [lng, lat]')
  assert.deepEqual(net.calls[0].body.metrics, ['distance', 'duration'])
  assert.deepEqual(r.body.walk.durations[0], [0, 1121, 6371, null])
  assert.deepEqual(r.body.car.distances[1], [2685, 0, 8249, null])
  assert.equal(r.body.car.durations[3][3], 0)
})

test('matrice : clé refusée → 503, quota → 429, sans clé → pas d’appel', async () => {
  const bad = fakeFetch([{ status: 403, json: {} }, { status: 403, json: {} }])
  assert.equal((await computeMatrix(FOUR, { key: 'K', fetchImpl: bad.impl })).status, 503)
  const busy = fakeFetch([{ status: 429, json: {} }, { status: 429, json: {} }])
  assert.equal((await computeMatrix(FOUR, { key: 'K', fetchImpl: busy.impl })).status, 429)
  const none = fakeFetch([])
  assert.equal((await computeMatrix(FOUR, { key: '', fetchImpl: none.impl })).status, 503)
  assert.equal(none.calls.length, 0)
  assert.equal((await computeMatrix('38.69,-9.21', { key: 'K', fetchImpl: none.impl })).status, 400)
})
