// node --test src/apps/trip/utils/*.test.mjs
//
// Météo : codes WMO, regroupement des lieux, prévisions ou normales, agrégation ERA5.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDayTimeline } from './timeline.js'
import {
  archiveRanges, archiveUrl, forecastDays, forecastEnd, forecastUrl, formatTemp, groupCoords, groupKey,
  parseDaily, planWeather, seasonalNormals, shiftYears, weatherKind, weatherPlaces,
} from './weather.js'

test('codes WMO → huit sortes de temps', () => {
  assert.equal(weatherKind(0), 'clear')
  assert.equal(weatherKind(1), 'clear')
  assert.equal(weatherKind(2), 'partly')
  assert.equal(weatherKind(3), 'cloudy')
  assert.equal(weatherKind(48), 'fog')
  assert.equal(weatherKind(53), 'drizzle')
  assert.equal(weatherKind(63), 'rain')
  assert.equal(weatherKind(81), 'rain')
  assert.equal(weatherKind(75), 'snow')
  assert.equal(weatherKind(86), 'snow')
  assert.equal(weatherKind(95), 'storm')
  assert.equal(weatherKind(null), null)
  assert.equal(weatherKind(42), null)
})

test('les lieux se regroupent à 0,1° près, hémisphère sud compris', () => {
  assert.equal(groupKey(38.7139, -9.1394), '38.7,-9.1')
  assert.equal(groupKey(38.6973, -9.2062), '38.7,-9.2')
  assert.equal(groupKey(-33.8688, 151.2093), '-33.9,151.2')
  // Pas de « -0.0 » : deux clés pour la même case casseraient le cache.
  assert.equal(groupKey(-0.04, 0.01), '0.0,0.0')
  assert.deepEqual(groupCoords('-33.9,151.2'), { lat: -33.9, lng: 151.2 })
})

test('prévisions jusqu’à 16 jours, normales au-delà, rien pour le passé', () => {
  const today = '2027-05-01'
  assert.equal(forecastEnd(today), '2027-05-16')
  const plan = planWeather([
    { date: '2027-04-30', lat: 38.71, lng: -9.14 },
    { date: '2027-05-01', lat: 38.71, lng: -9.14 },
    { date: '2027-05-16', lat: 38.72, lng: -9.13 },
    { date: '2027-05-17', lat: 38.71, lng: -9.14 },
    { date: '2027-05-20', lat: 41.15, lng: -8.61 },
    { date: '2027-05-20', lat: null, lng: null },
  ], today)
  assert.deepEqual(plan.forecast, ['38.7,-9.1'])
  assert.deepEqual(plan.normals, { '38.7,-9.1': ['2027-05-17'], '41.2,-8.6': ['2027-05-20'] })
})

test('une seule requête pour tous les lieux', () => {
  const url = new URL(forecastUrl(['38.7,-9.1', '41.2,-8.6']))
  assert.equal(url.searchParams.get('latitude'), '38.7,41.2')
  assert.equal(url.searchParams.get('longitude'), '-9.1,-8.6')
  assert.equal(url.searchParams.get('forecast_days'), '16')
  assert.equal(url.searchParams.get('timezone'), 'auto')
  const archive = new URL(archiveUrl(['38.7,-9.1'], '2026-05-09', '2026-05-20'))
  assert.equal(archive.hostname, 'archive-api.open-meteo.com')
  assert.equal(archive.searchParams.get('models'), 'era5')
  assert.equal(archive.searchParams.get('start_date'), '2026-05-09')
})

test('réponses Open-Meteo : un objet pour un lieu, un tableau pour plusieurs, jours vides écartés', () => {
  const one = {
    daily: {
      time: ['2027-05-01', '2027-05-02'],
      weather_code: [80, null],
      temperature_2m_max: [23.3, null],
      temperature_2m_min: [15.1, null],
      precipitation_probability_max: [60, null],
    },
  }
  const parsed = parseDaily(one)
  assert.equal(parsed.length, 1)
  assert.deepEqual(Object.keys(parsed[0]), ['2027-05-01'])
  assert.deepEqual(forecastDays(parsed[0]), { '2027-05-01': { kind: 'rain', tmax: 23.3, tmin: 15.1, rain: 60 } })
  assert.equal(parseDaily([one, { daily: { time: [] } }]).length, 2)
})

test('reculer d’un an, même un 29 février', () => {
  assert.equal(shiftYears('2027-05-14', -1), '2026-05-14')
  assert.equal(shiftYears('2028-02-29', -1), '2027-03-01')
})

test('archive : la fenêtre des dates ±3 jours, reculée de 1 à 5 ans, à cheval sur le nouvel an', () => {
  const ranges = archiveRanges(['2027-01-02', '2026-12-29'])
  assert.equal(ranges.length, 5)
  assert.deepEqual(ranges[0], { offset: 1, start: '2025-12-26', end: '2026-01-05' })
  assert.deepEqual(ranges[4], { offset: 5, start: '2021-12-26', end: '2022-01-05' })
  assert.deepEqual(archiveRanges([]), [])
})

test('normales : moyenne sur 5 ans × 7 jours, part des jours de pluie, temps le plus fréquent', () => {
  // Cinq mois de mai à Lisbonne : 25° / 15°, un jour de pluie sur sept.
  const samples = {}
  for (let y = 2022; y <= 2026; y++) {
    for (let d = 11; d <= 17; d++) {
      const rainy = d === 14
      samples[`${y}-05-${d}`] = { code: rainy ? 63 : 1, tmax: y === 2022 ? 23 : 25.5, tmin: 15, rainMm: rainy ? 4.2 : 0 }
    }
  }
  const normals = seasonalNormals(['2027-05-14'], samples)
  const n = normals['05-14']
  assert.equal(n.samples, 35)
  assert.equal(n.tmax, 25)
  assert.equal(n.tmin, 15)
  assert.equal(n.rain, 14)
  assert.equal(n.kind, 'clear')
  // Sans archive pour une date : pas de normale inventée.
  assert.deepEqual(seasonalNormals(['2027-08-01'], samples), {})
})

test('à égalité, la normale garde le temps le plus clément', () => {
  const samples = {
    '2026-05-13': { code: 63, tmax: 20, tmin: 10, rainMm: 5 },
    '2026-05-14': { code: 0, tmax: 20, tmin: 10, rainMm: 0 },
  }
  assert.equal(seasonalNormals(['2027-05-14'], samples)['05-14'].kind, 'clear')
})

test('les lieux d’une journée : un en ville, deux un jour de route', () => {
  const D = '2027-05-14'
  const lisbonne = { id: 'a', name: 'Alfama', time: '09:00', lat: 38.711, lng: -9.13 }
  const belem = { id: 'b', name: 'Belém', time: '11:00', lat: 38.697, lng: -9.206 }
  const city = weatherPlaces(buildDayTimeline(D, [lisbonne, { ...lisbonne, id: 'c' }]))
  assert.equal(city.anchors.length, 1)
  assert.equal(city.all.length, 1)

  const porto = { id: 'h', name: 'Hôtel Porto', lat: 41.15, lng: -8.61 }
  const road = weatherPlaces(buildDayTimeline(D, [lisbonne, belem]), porto)
  assert.deepEqual(road.anchors.map((p) => groupKey(p.lat, p.lng)), ['38.7,-9.1', '41.2,-8.6'])
  assert.equal(road.all.length, 3)

  // Rien de localisé, mais l'hôtel du soir l'est.
  assert.deepEqual(weatherPlaces([], porto).anchors, [{ lat: 41.15, lng: -8.61 }])
  assert.deepEqual(weatherPlaces([]).anchors, [])
})

test('températures arrondies', () => {
  assert.equal(formatTemp(23.6), '24°')
  assert.equal(formatTemp(-0.4), '0°')
  assert.equal(formatTemp(null), '—')
})
