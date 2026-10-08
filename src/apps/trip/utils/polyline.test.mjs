// node --test src/apps/trip/utils/*.test.mjs
//
// Tracés encodés (algorithme de Google) et simplification.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodePolyline, encodePolyline, simplifyPoints } from './polyline.js'

test('l’exemple de la documentation Google', () => {
  const points = [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]
  assert.equal(encodePolyline(points), '_p~iF~ps|U_ulLnnqC_mqNvxq`@')
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), points)
})

test('aller-retour au mètre près, coordonnées négatives comprises', () => {
  const points = [[38.69160, -9.21600], [38.69751, -9.20321], [-33.86785, 151.20732]]
  assert.deepEqual(decodePolyline(encodePolyline(points)), points)
})

test('une chaîne illisible ne casse rien', () => {
  assert.deepEqual(decodePolyline(null), [])
  assert.deepEqual(decodePolyline(''), [])
  assert.equal(decodePolyline('_p~iF~ps|U_ulL').length, 1, 'le point incomplet est ignoré')
})

test('simplifier : une ligne droite garde ses deux bouts, un virage reste', () => {
  const straight = Array.from({ length: 50 }, (_, i) => [38.7, -9.2 + i * 0.001])
  assert.deepEqual(simplifyPoints(straight), [straight[0], straight[49]])
  const bend = [[0, 0], [0, 0.01], [0.01, 0.01]]
  assert.equal(simplifyPoints(bend).length, 3)
  assert.deepEqual(simplifyPoints([[1, 1]]), [[1, 1]])
})
