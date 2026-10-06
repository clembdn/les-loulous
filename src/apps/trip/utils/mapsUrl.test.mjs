// node --test src/apps/trip/utils/*.test.mjs
//
// Les liens Google Maps qu'on colle vraiment : lire nom et coordonnées.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  dayRouteUrl, directionsUrl, goUrl, isMapsUrl, isShortMapsUrl, looksLikeUrl, parseMapsUrl, placeUrl,
} from './mapsUrl.js'

test('reconnaître un lien Maps, court ou long, et refuser le reste', () => {
  assert.equal(isMapsUrl('https://maps.app.goo.gl/AbCdEf123?g_st=ic'), true)
  assert.equal(isMapsUrl('https://goo.gl/maps/xyz'), true)
  assert.equal(isMapsUrl('https://www.google.com/maps/place/Lisbonne'), true)
  assert.equal(isMapsUrl('https://www.google.com.au/maps/@-33.86,151.2,15z'), true)
  assert.equal(isMapsUrl('https://maps.google.fr/?q=38.7,-9.1'), true)
  assert.equal(isMapsUrl('https://www.google.com/search?q=lisbonne'), false, 'une recherche Google')
  assert.equal(isMapsUrl('https://goo.gl/photos/xyz'), false)
  assert.equal(isMapsUrl('https://evil.com/maps/@38,9'), false)
  assert.equal(isMapsUrl('https://google.com.evil.com/maps'), false)
  assert.equal(isMapsUrl('Tour de Belém'), false)
  assert.equal(isShortMapsUrl('https://maps.app.goo.gl/AbC'), true)
  assert.equal(isShortMapsUrl('https://www.google.com/maps/place/x'), false)
  assert.equal(looksLikeUrl('  https://maps.app.goo.gl/x  '), true)
  assert.equal(looksLikeUrl('Tour de Belém'), false)
})

test('lien de lieu : le nom du chemin, la position exacte du lieu plutôt que le centre de la carte', () => {
  const p = parseMapsUrl('https://www.google.com/maps/place/Torre+de+Bel%C3%A9m/@38.6916,-9.2160,17z/data=!3m1!4b1!4m6!3m5!1s0xd1ecb1e2a83e8a9:0x1!8m2!3d38.6915837!4d-9.2159767!16zL20vMDFkMXNk?entry=ttu')
  assert.deepEqual(p, { name: 'Torre de Belém', address: null, lat: 38.6915837, lng: -9.2159767 })
})

test('sans repère de lieu, le centre de la carte fait l’affaire', () => {
  const p = parseMapsUrl('https://www.google.fr/maps/place/Lisbonne,+Portugal/@38.7436214,-9.1952226,12z/')
  assert.equal(p.name, 'Lisbonne, Portugal')
  assert.equal(p.lat, 38.7436214)
  assert.equal(p.lng, -9.1952226)
  assert.deepEqual(parseMapsUrl('https://www.google.com/maps/@-33.8568,151.2153,15z'), {
    name: '', address: null, lat: -33.8568, lng: 151.2153,
  })
})

test('coordonnées dans les paramètres', () => {
  assert.deepEqual(parseMapsUrl('https://maps.google.com/?q=38.7139,-9.1394'), { name: '', address: null, lat: 38.7139, lng: -9.1394 })
  assert.deepEqual(
    parseMapsUrl('https://www.google.com/maps/search/?api=1&query=47.5951518%2C-122.3316393'),
    { name: '', address: null, lat: 47.5951518, lng: -122.3316393 },
  )
  const ll = parseMapsUrl('https://maps.google.com/maps?ll=-42.8862,147.331&z=15')
  assert.equal(ll.lat, -42.8862)
  assert.equal(ll.lng, 147.331)
})

test('un lien de partage sans coordonnées : nom et adresse depuis `q`', () => {
  const p = parseMapsUrl('https://maps.google.com/?q=Past%C3%A9is+de+Bel%C3%A9m,+R.+de+Bel%C3%A9m+84+92,+1300-085+Lisboa&ftid=0xd1ecb:0x2&entry=gps')
  assert.deepEqual(p, {
    name: 'Pastéis de Belém',
    address: 'R. de Belém 84 92, 1300-085 Lisboa',
    lat: null,
    lng: null,
  })
})

test('un lien court ne contient rien : il faudra le suivre', () => {
  assert.deepEqual(parseMapsUrl('https://maps.app.goo.gl/AbCdEf123'), { name: '', address: null, lat: null, lng: null })
})

test('un itinéraire n’est pas un lieu', () => {
  const p = parseMapsUrl('https://www.google.com/maps/dir/Lisbonne/Porto/@39.9,-8.9,8z')
  assert.equal(p.lat, null)
})

test('coordonnées impossibles écartées, et ce qui n’est pas Maps refusé', () => {
  assert.equal(parseMapsUrl('https://maps.google.com/?q=138.7,-9.1').lat, null)
  assert.equal(parseMapsUrl('https://example.com/?q=38.7,-9.1'), null)
  assert.equal(parseMapsUrl('pas un lien'), null)
})

test('fabriquer les liens : y aller, le parcours du jour, montrer le lieu', () => {
  assert.equal(
    directionsUrl({ lat: 38.6915837, lng: -9.2159767 }),
    'https://www.google.com/maps/dir/?api=1&destination=38.691584%2C-9.215977',
  )
  assert.equal(
    directionsUrl({ name: 'Casa na Alfama', address: 'Lisbonne' }, { mode: 'walking' }),
    'https://www.google.com/maps/dir/?api=1&destination=Casa+na+Alfama%2C+Lisbonne&travelmode=walking',
  )
  const route = dayRouteUrl([{ lat: 1, lng: 2 }, { name: 'sans position' }, { lat: 3, lng: 4 }, { lat: 5, lng: 6 }])
  assert.equal(route, 'https://www.google.com/maps/dir/?api=1&origin=1%2C2&destination=5%2C6&waypoints=3%2C4')
  assert.equal(dayRouteUrl([{ lat: 1, lng: 2 }]), null)
  assert.equal(placeUrl({ mapsUrl: 'https://maps.app.goo.gl/x', lat: 1, lng: 2 }), 'https://maps.app.goo.gl/x')
  assert.equal(placeUrl({ lat: 1, lng: 2 }), 'https://www.google.com/maps/search/?api=1&query=1%2C2')
  assert.equal(placeUrl({}), null)
})

test('« Y aller » : l’itinéraire si on sait où c’est, sinon le lien d’origine, jamais un nom seul', () => {
  assert.equal(goUrl({ lat: 1, lng: 2 }), 'https://www.google.com/maps/dir/?api=1&destination=1%2C2')
  assert.equal(goUrl({ name: 'Hôtel', address: 'Porto' }), 'https://www.google.com/maps/dir/?api=1&destination=H%C3%B4tel%2C+Porto')
  assert.equal(goUrl({ name: 'Café', mapsUrl: 'https://maps.app.goo.gl/x' }), 'https://maps.app.goo.gl/x')
  assert.equal(goUrl({ name: 'Café' }), null)
  assert.equal(goUrl(null), null)
})
