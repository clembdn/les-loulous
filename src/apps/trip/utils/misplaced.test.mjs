// node --test src/apps/trip/utils/*.test.mjs
//
// Les lieux placés à Washington par l'ancien résolveur de liens.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isMisplaced, misplacedIn, nearIpCenter } from './misplaced.js'

const BUG = { lat: 38.9072, lng: -77.0369, mapsUrl: 'https://maps.app.goo.gl/abc' }

test('le point exact du bug, avec un lien à relire', () => {
  assert.equal(isMisplaced(BUG), true)
  assert.equal(isMisplaced({ ...BUG, mapsUrl: null }), false, 'sans lien, rien à relire : un vrai lieu à Washington')
  assert.equal(isMisplaced({ ...BUG, lat: 38.8977, lng: -77.0365 }), false, 'la Maison-Blanche, à 1 km, est un vrai lieu')
  assert.equal(nearIpCenter({ lat: 38.9, lng: -77.04 }), true)
  assert.equal(nearIpCenter({ lat: 38.7, lng: -9.1 }), false)
})

test('tout ce qui est mal placé dans un voyage', () => {
  const found = misplacedIn({
    days: { '2027-05-12': { stops: [{ id: 's1', ...BUG }, { id: 's2', lat: 38.7, lng: -9.1, mapsUrl: 'x' }] } },
    stays: [{ id: 'h1', ...BUG }],
    transports: [{ id: 't1', from: { lat: 38.77, lng: -9.13 }, to: { ...BUG } }],
  })
  assert.deepEqual(found.map((f) => [f.kind, f.id, f.date || f.end || null]), [
    ['stop', 's1', '2027-05-12'], ['stay', 'h1', null], ['transport', 't1', 'to'],
  ])
})
