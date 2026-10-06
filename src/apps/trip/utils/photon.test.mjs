// node --test src/apps/trip/utils/*.test.mjs
//
// Photon : la requête et la lecture de ses réponses.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { photonPlace, photonPlaces, photonUrl } from './photon.js'

test('la requête, biaisée vers le voyage quand on sait où il est', () => {
  assert.equal(photonUrl(' gare oriente '), 'https://photon.komoot.io/api/?q=gare+oriente&limit=6&lang=fr')
  assert.equal(
    photonUrl('gare', { near: { lat: 38.7, lng: -9.1 }, limit: 1 }),
    'https://photon.komoot.io/api/?q=gare&limit=1&lang=fr&lat=38.7&lon=-9.1',
  )
})

test('une réponse devient un lieu : nom, adresse sans répétition, coordonnées', () => {
  const feature = {
    geometry: { type: 'Point', coordinates: [-9.0993, 38.7678] },
    properties: { name: 'Gare do Oriente', street: 'Avenida Dom João II', city: 'Lisboa', country: 'Portugal' },
  }
  assert.deepEqual(photonPlace(feature), {
    name: 'Gare do Oriente',
    address: 'Avenida Dom João II, Lisboa, Portugal',
    lat: 38.7678,
    lng: -9.0993,
  })
})

test('une ville seule : son nom, et le pays comme adresse', () => {
  const place = photonPlace({
    geometry: { coordinates: [-8.67, 37.1] },
    properties: { name: 'Lagos', city: 'Lagos', country: 'Portugal' },
  })
  assert.equal(place.name, 'Lagos')
  assert.equal(place.address, 'Portugal')
})

test('les réponses inutilisables sont écartées', () => {
  assert.equal(photonPlace({ geometry: { coordinates: [] }, properties: { name: 'x' } }), null)
  assert.equal(photonPlace({ geometry: { coordinates: [1, 2] }, properties: {} }), null)
  assert.deepEqual(photonPlaces({}), [])
})

test('un même lieu décrit plusieurs fois n’apparaît qu’une fois', () => {
  const twice = (coordinates) => ({ geometry: { coordinates }, properties: { name: 'Mosteiro', city: 'Lisboa' } })
  assert.equal(photonPlaces({ features: [twice([-9.2, 38.69]), twice([-9.21, 38.7])] }).length, 1)
})

test('la catégorie, devinée d’après les tags OpenStreetMap', () => {
  const place = photonPlace({
    geometry: { coordinates: [-9.2068, 38.6979] },
    properties: { name: 'Mosteiro dos Jerónimos', osm_key: 'historic', osm_value: 'monastery', city: 'Lisboa' },
  })
  assert.equal(place.category, 'visit')
})
