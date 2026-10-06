// node --test src/apps/trip/utils/*.test.mjs
//
// Identifiants relevés sur de vrais lieux Google Maps (2026-10), avec leurs
// coordonnées exactes selon Google.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ftidArea, mapsFtid } from './ftid.js'
import { haversineM } from './geo.js'

const REAL = [
  ['Tour Eiffel', '0x47e66e2964e34e2d:0x8ddca9ee380ef7e0', 48.8583701, 2.2944813],
  ['Pastéis de Belém', '0xd1ecb452efd715b:0xffeff6c6b46d9665', 38.6975105, -9.2032276],
  ['Praia do Camilo', '0xd1b31dd791d72a7:0x65cce4d0d6f8a4', 37.0873925, -8.6684868],
  ['Opéra de Sydney', '0x6b12ae665e892fdd:0x3133f8d75a1ac251', -33.8567844, 151.2152967],
  ['Uluru', '0x2b236c2b6d625223:0x43a8cd4d9bc55f21', -25.3444277, 131.0368822],
  ['Tour de Tokyo', '0x60188bbd9009ec09:0x481a93f0d2a409dd', 35.6585805, 139.7454329],
  ['Temba (partage Android)', '0x1ebfc06ee282e2a9:0x843802deff256922', -25.384152, 28.2720638],
]

test('la zone d’un ftid réel tombe à moins de 3 km du lieu', () => {
  for (const [name, ftid, lat, lng] of REAL) {
    const area = ftidArea(ftid)
    assert.ok(area, name)
    const km = haversineM(area, { lat, lng }) / 1000
    assert.ok(km < 3, `${name} : ${km.toFixed(2)} km`)
  }
})

test('des lieux différents donnent des zones différentes', () => {
  const keys = REAL.map(([, ftid]) => JSON.stringify(ftidArea(ftid)))
  assert.equal(new Set(keys).size, REAL.length)
})

test('pas une cellule S2 : null', () => {
  assert.equal(ftidArea('0x1:0x2'), null)
  assert.equal(ftidArea('0xffffffffffffffff:0x2'), null, 'face 7 n’existe pas')
  assert.equal(ftidArea(null), null)
  assert.equal(ftidArea('Tour Eiffel'), null)
})

test('le ftid d’un lien : paramètre `ftid`, ou `!1s` de `data=`', () => {
  assert.equal(
    mapsFtid('https://maps.google.com/maps?q=Tour+Eiffel&ftid=0x47e66e2964e34e2d:0x8ddca9ee380ef7e0&entry=gps'),
    '0x47e66e2964e34e2d:0x8ddca9ee380ef7e0',
  )
  assert.equal(
    mapsFtid('https://www.google.com/maps/place/X/data=!4m2!3m1!1s0x1ebfc06ee282e2a9:0x843802deff256922!18m1!1e1?entry=gps'),
    '0x1ebfc06ee282e2a9:0x843802deff256922',
  )
  // `!5s` désigne un autre lieu (le bâtiment autour) : on prend `!1s`.
  assert.equal(
    mapsFtid('https://www.google.com/maps/place/J/@37,-122,17z/data=!3m2!4b1!5s0x808e417502d57005:0x8580897e73d60a70!4m6!3m5!1s0x808e4174e0eafc51:0x1'),
    '0x808e4174e0eafc51:0x1',
  )
  assert.equal(mapsFtid('https://maps.google.com/?q=x&ftid=0x47E66E2964E34E2D%3A0x8DDC'), '0x47e66e2964e34e2d:0x8ddc')
  assert.equal(mapsFtid('https://maps.app.goo.gl/AbCdEf123'), null)
})
