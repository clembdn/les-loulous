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

test('recherche inverse : la ville sans ses paroisses, le pays en majuscules', async () => {
  const { photonCity, photonReverseUrl } = await import('./photon.js')
  const body = (properties) => ({ features: [{ properties }] })
  assert.deepEqual(
    photonCity(body({ name: 'Castelo dos Mouros', city: 'Sintra (Santa Maria e São Miguel, São Martinho e São Pedro de Penaferrim)', countrycode: 'PT' })),
    { city: 'Sintra', countryCode: 'PT' },
  )
  assert.deepEqual(photonCity(body({ village: 'Aljezur', countrycode: 'pt' })), { city: 'Aljezur', countryCode: 'PT' })
  assert.deepEqual(photonCity(body({ countrycode: 'SG' })), { city: null, countryCode: 'SG' })
  assert.equal(photonCity({ features: [] }), null)
  assert.match(photonReverseUrl({ lat: 38.7, lng: -9.1 }), /\/reverse\?lat=38\.7&lon=-9\.1&lang=fr&limit=1$/)
})

test('outre-mer : Ouvéa est en Nouvelle-Calédonie, pas « en France »', async () => {
  const { regionCode, photonCity } = await import('./photon.js')
  assert.equal(regionCode('FR', 'Nouvelle-Calédonie'), 'NC')
  assert.equal(regionCode('FR', 'La Réunion'), 'RE')
  assert.equal(regionCode('US', 'Porto Rico'), 'PR')
  assert.equal(regionCode('FR', 'Bretagne'), 'FR')
  assert.equal(regionCode('fr', null), 'FR')
  assert.equal(regionCode('', 'x'), null)
  const body = { features: [{ properties: { city: 'Nouméa', countrycode: 'FR', state: 'Nouvelle-Calédonie' } }] }
  assert.deepEqual(photonCity(body), { city: 'Nouméa', countryCode: 'NC' })
})

test('ajouter un lieu déjà visité : pays, île (préférée à la commune), ville', async () => {
  const { photonAreas } = await import('./photon.js')
  // Réponses relevées sur photon.komoot.io (2026-10).
  const feature = (coords, properties) => ({ geometry: { coordinates: coords }, properties })
  const areas = photonAreas({ features: [
    feature([166.5, -20.55], { name: 'Ouvéa', osm_key: 'boundary', osm_value: 'administrative', type: 'city', country: 'France', countrycode: 'FR', state: 'Nouvelle-Calédonie', extent: [166.1351785, -20.2958488, 166.6672996, -20.7348798] }),
    feature([166.56, -20.62], { name: 'Ouvéa', osm_key: 'place', osm_value: 'island', type: 'other', country: 'France', countrycode: 'FR', state: 'Nouvelle-Calédonie', extent: [166.4710718, -20.389574, 166.6672996, -20.7084049] }),
    feature([139.2394179, 36.5748441], { name: 'Japon', osm_key: 'place', osm_value: 'country', type: 'country', countrycode: 'JP', extent: [122.7, 45.7, 154.2, 20.2] }),
    feature([5.0, 45.0], { name: 'Sans pays' }),
  ] })
  assert.equal(areas.length, 2)
  assert.deepEqual(
    [areas[0].name, areas[0].kind, areas[0].country, areas[0].label, areas[0].detail],
    ['Ouvéa', 'island', 'NC', 'Île', 'Nouvelle-Calédonie, France'],
  )
  assert.ok(areas[0].radiusKm >= 15 && areas[0].radiusKm <= 25, `rayon ${areas[0].radiusKm}`)
  assert.deepEqual([areas[1].kind, areas[1].country, areas[1].radiusKm], ['country', 'JP', 150])
})
