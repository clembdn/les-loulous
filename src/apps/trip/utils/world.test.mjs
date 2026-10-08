// node --test src/apps/trip/utils/*.test.mjs
//
// Carte du monde : projection, pays d'un lieu (sur les vrais contours de
// public/trip-map/world.json), lieux d'un voyage, pays visités.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  countryAt, frameAround, litGeoJSON, partAt, partPath, prepareWorld, project, samePlaces, tripPlaces, worldVisits, WORLD_VIEWBOX,
} from './world.js'

const WORLD = JSON.parse(readFileSync(new URL('../../../../public/trip-map/world.json', import.meta.url), 'utf8'))
const W = prepareWorld(WORLD.countries)

test('Equal Earth : l’origine au centre, symétrique, le nord en haut', () => {
  assert.deepEqual(project(0, 0).map(Math.abs), [0, 0])
  const [xe] = project(180, 0)
  assert.ok(Math.abs(xe - 270.64) < 0.1, `bord est : ${xe}`)
  assert.equal(project(-180, 0)[0], -xe)
  assert.ok(project(0, 60)[1] < 0, 'le nord vers le haut de l’écran')
  assert.equal(WORLD_VIEWBOX.length, 4)
})

test('le pays d’un lieu, sur les vrais contours', () => {
  const at = (lat, lng) => countryAt({ lat, lng }, W)
  assert.equal(at(38.7139, -9.1335), 'PT', 'Lisbonne')
  assert.equal(at(38.6916, -9.216), 'PT', 'Tour de Belém, au bord de l’eau')
  assert.equal(at(48.8584, 2.2945), 'FR', 'Paris')
  assert.equal(at(-33.8568, 151.2153), 'AU', 'Opéra de Sydney')
  assert.equal(at(-36.8485, 174.7633), 'NZ', 'Auckland')
  assert.equal(at(64.1466, -21.9426), 'IS', 'Reykjavik')
  assert.equal(at(30, -40), null, 'en plein Atlantique')
  assert.equal(at(null, 2), null)
})

test('un pays absent des contours simplifiés tombe sur son voisin immédiat', () => {
  // Singapour n'existe pas à l'échelle 1:110m : la Malaisie, à 20 km.
  // (Le nom de ville renvoyé par Photon corrige le pays, cf. placeNames.)
  assert.equal(countryAt({ lat: 1.2903, lng: 103.8519 }, W), 'MY')
})

test('tracé SVG : un sous-chemin fermé par contour', () => {
  const d = partPath([[0, 0, 100, 0, 100, 100]])
  assert.match(d, /^M0 -?0L[\d.]+ -?0L[\d.]+ -[\d.]+Z$/)
})

test('les lieux d’un voyage : hébergements et étapes des jours, par case de 0,1°', () => {
  const places = tripPlaces({
    stays: [{ lat: 38.7118, lng: -9.13 }, { lat: null, lng: null }],
    days: {
      '2027-05-12': { stops: [{ lat: 38.7139, lng: -9.1335 }, { lat: 38.7876, lng: -9.3906 }, { name: 'sans position' }] },
      '2027-05-30': { stops: [{ lat: 48.85, lng: 2.29 }] },
    },
    dayKeys: ['2027-05-12', '2027-05-13'],
  })
  assert.equal(places.length, 2, 'Lisbonne (2 lieux) et Sintra ; le jour hors voyage ne compte pas')
  assert.deepEqual(places[0], { lat: 38.713, lng: -9.132 })
  assert.ok(samePlaces(places, places.map((p) => ({ ...p }))))
  assert.equal(samePlaces(places, places.slice(1)), false)
  assert.equal(samePlaces(undefined, []), false, 'jamais résumé : à écrire')
})

const status = { pt: 'past', jp: 'upcoming', sg: 'ongoing', pt2: 'upcoming' }
const statusOf = (t) => status[t.id] || 'past'
const litKeys = (v) => [...v.lit.keys()].sort()

test('pays visités et prévus, terre par terre', () => {
  const trips = [
    { id: 'pt', places: [{ lat: 38.71, lng: -9.13 }, { lat: 37.1, lng: -8.67 }] },
    { id: 'jp', places: [{ lat: 35.68, lng: 139.76 }] },
    { id: 'sg', places: [{ lat: 1.29, lng: 103.85 }] },
    { id: 'pt2', places: [{ lat: 41.15, lng: -8.61 }] },
  ]
  const hint = (p) => (p.lat === 1.29 ? 'SG' : null)
  const v = worldVisits({ trips, world: W, statusOf, hint })
  assert.deepEqual([...v.countries.keys()].sort(), ['JP', 'PT', 'SG'])
  assert.equal(v.countries.get('PT').visited, true)
  assert.equal(v.countries.get('PT').trips.length, 2)
  assert.equal(v.countries.get('JP').visited, false, 'seulement prévu')
  assert.equal(v.countries.get('SG').visited, true, 'le pays connu de Photon l’emporte')
  assert.ok(!litKeys(v).some((k) => k.startsWith('MY')), 'la Malaisie voisine ne s’allume pas pour Singapour')
  assert.equal(v.lit.get(partAt({ lat: 35.68, lng: 139.76 }, W).key).visited, false)
  assert.equal(v.points.length, 5)
})

test('Ouvéa n’allume qu’Ouvéa : ni la Grande Terre, ni la métropole', () => {
  const ouvea = { id: 'm1', name: 'Ouvéa', lat: -20.62, lng: 166.56, country: 'NC', kind: 'island', radiusKm: 25 }
  const v = worldVisits({ manual: [ouvea], world: W, statusOf })
  assert.deepEqual(litKeys(v), [], 'aucune terre : l’île est trop petite pour la carte, son halo la montre')
  assert.deepEqual(v.points.map((p) => [p.country, p.radiusKm]), [['NC', 25]])
  assert.equal(v.countries.get('NC').visited, true)
  assert.equal(v.countries.has('FR'), false)
})

test('un pays saisi à la main allume ses terres proches, pas ses territoires lointains', () => {
  const france = { id: 'm2', name: 'France', lat: 46.6, lng: 2.4, country: 'FR', kind: 'country' }
  const v = worldVisits({ manual: [france], world: W, statusOf })
  const fr = litKeys(v)
  assert.equal(fr.length, 2, 'la métropole et la Corse')
  assert.ok(!fr.includes(partAt({ lat: 4.9, lng: -52.3 }, W).key), 'pas la Guyane')
  assert.equal(v.points.length, 0, 'un pays entier n’a pas de point')
  const japan = worldVisits({ manual: [{ id: 'm3', name: 'Japon', lat: 36.5, lng: 139, country: 'JP', kind: 'country' }], world: W, statusOf })
  assert.ok(litKeys(japan).length >= 3, 'Honshu, Hokkaido, Kyushu…')
})

test('une ville saisie à la main allume sa terre', () => {
  const v = worldVisits({ manual: [{ id: 'm4', name: 'Honolulu', lat: 21.31, lng: -157.86, country: 'US', kind: 'place' }], world: W, statusOf })
  const keys = litKeys(v)
  assert.equal(keys.length, 1)
  assert.ok(keys[0].startsWith('US:'))
  assert.notEqual(keys[0], partAt({ lat: 39, lng: -98 }, W).key, 'Hawaï, pas le continent')
})

test('GeoJSON et cadre', () => {
  const v = worldVisits({ trips: [{ id: 'pt', places: [{ lat: 38.71, lng: -9.13 }] }], world: W, statusOf })
  const geo = litGeoJSON(v.lit)
  assert.equal(geo.features[0].properties.country, 'PT')
  const ring = geo.features[0].geometry.coordinates[0]
  assert.deepEqual(ring[0], ring.at(-1), 'contour fermé')
  const [, , w, h] = frameAround([project(-9.13, 38.71)])
  assert.equal(w / h, 2)
  assert.deepEqual(frameAround([]), WORLD_VIEWBOX)
})
