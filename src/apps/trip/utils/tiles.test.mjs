// node --test src/apps/trip/utils/*.test.mjs
//
// Les tuiles de carte emportées hors-ligne.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boundsOf, fitZoom, planTiles, tileUrl, tileX, tileY, tilesFor, tripBounds } from './tiles.js'

test('tuile de Lisbonne aux zooms courants', () => {
  // (−9,14 + 180) / 360 · 2¹³ = 3888,01 ; Mercator pour 38,71° : 3139,3.
  assert.equal(tileX(-9.14, 13), 3888)
  assert.equal(tileY(38.71, 13), 3139)
  assert.equal(tileX(-9.14, 0), 0)
  assert.equal(tileY(38.71, 0), 0)
})

test('les bords du monde restent dans la grille', () => {
  assert.equal(tileX(180, 3), 7)
  assert.equal(tileX(-180, 3), 0)
  assert.equal(tileY(89.9, 3), 0)
  assert.equal(tileY(-89.9, 3), 7)
})

test('un lieu seul couvre au moins son quartier', () => {
  const b = boundsOf([{ lat: 38.7114, lng: -9.13 }, { lat: null, lng: null }])
  assert.ok(b.north - b.south >= 0.015 - 1e-9)
  assert.ok(b.east - b.west >= 0.015 - 1e-9)
  assert.equal(boundsOf([{ name: 'sans position' }]), null)
})

test('le zoom d’une journée en ville, puis d’une journée de route', () => {
  const city = boundsOf([{ lat: 38.6916, lng: -9.216 }, { lat: 38.7114, lng: -9.13 }])
  const road = boundsOf([{ lat: 38.7804, lng: -9.4989 }, { lat: 38.38, lng: -8.786 }])
  const zCity = fitZoom(city, 390, 300)
  const zRoad = fitZoom(road, 390, 300)
  assert.ok(zCity > 11 && zCity < 12.5, `ville : ${zCity}`)
  assert.ok(zRoad > 8 && zRoad < 9.5, `route : ${zRoad}`)
})

test('les tuiles d’une emprise, sans trou', () => {
  const b = { west: -9.22, south: 38.69, east: -9.13, north: 38.72 }
  const tiles = tilesFor(b, 13)
  const xs = new Set(tiles.map((t) => t[1]))
  const ys = new Set(tiles.map((t) => t[2]))
  assert.equal(tiles.length, xs.size * ys.size)
  assert.ok(tiles.every(([z]) => z === 13))
})

test('le plan : sans doublon, des zooms larges aux fins, plafonné', () => {
  const day = boundsOf([{ lat: 38.6916, lng: -9.216 }, { lat: 38.7114, lng: -9.13 }])
  const plan = planTiles([day, day])
  const keys = plan.map((t) => t.join('/'))
  assert.equal(new Set(keys).size, keys.length)
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i - 1][0] <= plan[i][0])
  assert.ok(plan.every(([z]) => z <= 14))
  assert.equal(planTiles([day], { cap: 5 }).length, 5)
})

test('gabarit d’URL du TileJSON', () => {
  assert.equal(tileUrl('https://t.example/planet/v1/{z}/{x}/{y}.pbf', [13, 3887, 3139]), 'https://t.example/planet/v1/13/3887/3139.pbf')
})

test('les emprises d’un voyage : journées, hébergements, gares', () => {
  const list = tripBounds({
    days: [{ stops: [{ lat: 38.69, lng: -9.21 }] }, { stops: [] }],
    stays: [{ lat: 38.71, lng: -9.13 }, { name: 'sans position' }],
    transports: [{ from: { lat: 38.77, lng: -9.13 }, to: {} }],
  })
  assert.equal(list.length, 3)
})
