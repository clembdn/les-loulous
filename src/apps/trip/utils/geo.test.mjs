// node --test src/apps/trip/utils/*.test.mjs
//
// Distances et projection des mini-cartes.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  curvePath, formatDistance, groupCoincident, hasCoords, haversineM, projectPoints,
} from './geo.js'

const LISBONNE = { lat: 38.7223, lng: -9.1393 }
const PORTO = { lat: 41.1579, lng: -8.6291 }

test('distance à vol d’oiseau', () => {
  const km = haversineM(LISBONNE, PORTO) / 1000
  assert.ok(km > 272 && km < 276, `${km} km`)
  assert.equal(haversineM(LISBONNE, LISBONNE), 0)
  const sydneyMelbourne = haversineM({ lat: -33.8688, lng: 151.2093 }, { lat: -37.8136, lng: 144.9631 }) / 1000
  assert.ok(sydneyMelbourne > 710 && sydneyMelbourne < 716, `${sydneyMelbourne} km`)
})

test('coordonnées présentes, zéro compris', () => {
  assert.equal(hasCoords({ lat: 0, lng: 0 }), true)
  assert.equal(hasCoords({ lat: null, lng: 2 }), false)
  assert.equal(hasCoords(null), false)
})

test('distances lisibles d’un coup d’œil', () => {
  assert.equal(formatDistance(4), '10 m')
  assert.equal(formatDistance(847), '850 m')
  assert.equal(formatDistance(1234), '1,2 km')
  assert.equal(formatDistance(9960), '10 km')
  assert.equal(formatDistance(38400), '38 km')
})

function inFrame(points, w, h, pad) {
  return points.every(([x, y]) => x >= pad - 1e-9 && x <= w - pad + 1e-9 && y >= pad - 1e-9 && y <= h - pad + 1e-9)
}

test('la projection tient dans le cadre et garde le nord en haut', () => {
  const pts = projectPoints([LISBONNE, PORTO, { lat: 37.1, lng: -8.67 }], 340, 170, 20)
  assert.ok(inFrame(pts, 340, 170, 20))
  assert.ok(pts[1][1] < pts[0][1], 'Porto au-dessus de Lisbonne')
  assert.ok(pts[2][1] > pts[0][1], 'Lagos en dessous')
})

test('un point seul, ou des points confondus, au centre', () => {
  assert.deepEqual(projectPoints([LISBONNE], 340, 170, 20), [[170, 85]])
  assert.deepEqual(projectPoints([LISBONNE, LISBONNE], 340, 170, 20), [[170, 85], [170, 85]])
  assert.deepEqual(projectPoints([], 340, 170, 20), [])
})

test('deux étapes voisines restent proches au lieu d’occuper tout le cadre', () => {
  const [a, b] = projectPoints([LISBONNE, { lat: 38.7226, lng: -9.1390 }], 340, 170, 20)
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 20)
})

test('un parcours à cheval sur l’antiméridien est recousu', () => {
  const [fidji, samoa] = projectPoints([{ lat: -17.7, lng: 178.0 }, { lat: -13.8, lng: -172.0 }], 340, 170, 20)
  assert.ok(samoa[0] > fidji[0], 'les Samoa à l’est des Fidji, pas à l’autre bout du monde')
})

test('points confondus regroupés en un seul repère', () => {
  assert.deepEqual(groupCoincident([[10, 10], [100, 50], [12, 11], [100, 80]]), [[0, 2], [1], [3]])
  assert.deepEqual(groupCoincident([]), [])
})

test('tracé en petites courbes alternées', () => {
  assert.equal(curvePath([]), '')
  assert.equal(curvePath([[0, 0]]), 'M0.0,0.0')
  assert.match(curvePath([[0, 0], [100, 0], [100, 100]]), /^M0\.0,0\.0 Q50\.0,18\.0 100\.0,0\.0 Q\S+ 100\.0,100\.0$/)
})
