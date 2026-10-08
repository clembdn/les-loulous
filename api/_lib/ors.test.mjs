// node --test api/_lib/*.test.mjs
//
// Trajets calculés : la requête envoyée à OpenRouteService et le découpage de
// sa réponse. Le réseau est simulé, d'après le format documenté de
// /v2/directions/{profile}/json ; `ors.live.mjs` le vérifie pour de vrai.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeRun, parsePoints } from './ors.js'
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
