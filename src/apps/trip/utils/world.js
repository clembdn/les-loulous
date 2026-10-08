// La carte du monde de « Mes voyages » : projection, pays d'un lieu, lieux
// d'un voyage. Sans bibliothèque de carto : les contours (Natural Earth
// 1:110m, cf. scripts/trip-world.mjs) sont en centièmes de degré, et la
// projection Equal Earth tient en quelques lignes.
//
// Module pur, testé sous `node --test`.

import { hasCoords } from './geo.js'

// Equal Earth (Šavrič, Patterson, Jenny, 2018) : surfaces respectées, allure
// familière — le Groenland n'y est pas plus grand que l'Afrique.
const A1 = 1.340264
const A2 = -0.081106
const A3 = 0.000893
const A4 = 0.003796
const M = Math.sqrt(3) / 2
const RAD = Math.PI / 180
// 1 radian = 100 unités SVG.
const SCALE = 100

/** [lng, lat] en degrés → [x, y] SVG (y vers le bas). */
export function project(lng, lat) {
  const lambda = lng * RAD
  const theta = Math.asin(M * Math.sin(lat * RAD))
  const t2 = theta * theta
  const t6 = t2 * t2 * t2
  const x = (lambda * Math.cos(theta)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)))
  const y = theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
  return [x * SCALE, -y * SCALE]
}

// Le cadre : tout le monde habité, de la Terre de Feu au nord du Groenland.
const [WEST] = project(-180, 0)
const [EAST] = project(180, 0)
const [, NORTH] = project(0, 84)
const [, SOUTH] = project(0, -57)
export const WORLD_VIEWBOX = [WEST, NORTH, EAST - WEST, SOUTH - NORTH].map((v) => Math.round(v * 10) / 10)

const r1 = (v) => Math.round(v * 10) / 10

/** Le tracé SVG d'une terre (`rings` en centièmes de degré), à remplir en « evenodd ». */
export function partPath(rings) {
  let d = ''
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 2) {
      const [x, y] = project(ring[i] / 100, ring[i + 1] / 100)
      d += `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`
    }
    d += 'Z'
  }
  return d
}

/**
 * Les terres du monde (un « part » = un continent ou une île d'un pays), avec
 * leur cadre pour écarter vite celles qui sont loin d'un point.
 * Rend `{ parts: [{ key, country, rings, bbox, center }], byCountry }`.
 */
export function prepareWorld(countries) {
  const parts = []
  for (const { id, parts: list } of countries) {
    list.forEach((rings, i) => {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (let k = 0; k < rings[0].length; k += 2) {
        minX = Math.min(minX, rings[0][k])
        maxX = Math.max(maxX, rings[0][k])
        minY = Math.min(minY, rings[0][k + 1])
        maxY = Math.max(maxY, rings[0][k + 1])
      }
      parts.push({
        key: `${id}:${i}`,
        country: id,
        rings,
        bbox: [minX, minY, maxX, maxY],
        center: { lat: (minY + maxY) / 200, lng: (minX + maxX) / 200 },
      })
    })
  }
  const byCountry = new Map()
  for (const part of parts) {
    if (!byCountry.has(part.country)) byCountry.set(part.country, [])
    byCountry.get(part.country).push(part)
  }
  return { parts, byCountry }
}

// Pair-impair : un point dans une île ET dans le trou d'un lac compte juste.
function inside(x, y, rings) {
  let odd = false
  for (const ring of rings) {
    const n = ring.length
    for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
      const xi = ring[i]
      const yi = ring[i + 1]
      const xj = ring[j]
      const yj = ring[j + 1]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd
    }
  }
  return odd
}

function edgeDistance(x, y, rings, kx) {
  let best = Infinity
  for (const ring of rings) {
    const n = ring.length
    for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
      const ax = ring[j] * kx
      const ay = ring[j + 1]
      const dx = ring[i] * kx - ax
      const dy = ring[i + 1] - ay
      const len = dx * dx + dy * dy
      const t = len ? Math.max(0, Math.min(1, ((x * kx - ax) * dx + (y - ay) * dy) / len)) : 0
      best = Math.min(best, Math.hypot(x * kx - (ax + t * dx), y - (ay + t * dy)))
    }
  }
  return best
}

// ~55 km : un port, une plage, une île au large que les contours simplifiés
// ont laissés dans l'eau.
const COAST_MARGIN = 50

/**
 * La terre d'un lieu `{ lat, lng }`, ou `null` en pleine mer. Hors de tout
 * contour, la plus proche à moins de ~55 km (`coast: false` : seulement si
 * le lieu est dedans — une île saisie à la main n'allume pas sa voisine).
 */
export function partAt(place, world, { coast = true } = {}) {
  if (!hasCoords(place)) return null
  const x = place.lng * 100
  const y = place.lat * 100
  for (const p of world.parts) {
    const [minX, minY, maxX, maxY] = p.bbox
    if (x >= minX && x <= maxX && y >= minY && y <= maxY && inside(x, y, p.rings)) return p
  }
  if (!coast) return null
  // Les longitudes se resserrent vers les pôles : `kx` les ramène à des kilomètres.
  const kx = Math.cos(place.lat * RAD)
  let best = null
  let bestDist = COAST_MARGIN
  for (const p of world.parts) {
    const [minX, minY, maxX, maxY] = p.bbox
    if (x < minX - 200 || x > maxX + 200 || y < minY - 100 || y > maxY + 100) continue
    const d = edgeDistance(x, y, p.rings, kx)
    if (d < bestDist) {
      bestDist = d
      best = p
    }
  }
  return best
}

/** Le pays d'un lieu (code ISO à deux lettres), d'après les contours. */
export function countryAt(place, world) {
  return partAt(place, world)?.country || null
}

// Une case de 0,1° (~11 km) : une ville, ses quartiers et ses environs proches.
const CELL = 0.1
export const MAX_TRIP_PLACES = 80

/**
 * Les lieux d'un voyage, regroupés par case de 0,1° : de quoi allumer ses
 * pays et nommer ses villes. Hébergements et étapes des jours du voyage ;
 * pas les gares et aéroports de départ, qui disent d'où l'on part, pas où
 * l'on va. Ordre stable (le plus fréquenté d'abord) : la comparaison avec ce
 * qui est déjà rangé ne réécrit rien pour rien.
 */
export function tripPlaces({ stays, days, dayKeys }) {
  const points = stays.filter(hasCoords)
  for (const date of dayKeys) {
    for (const stop of days[date]?.stops || []) if (hasCoords(stop)) points.push(stop)
  }
  const cells = new Map()
  for (const p of points) {
    const key = `${Math.floor(p.lat / CELL)},${Math.floor(p.lng / CELL)}`
    const cell = cells.get(key) || { lat: 0, lng: 0, n: 0, key }
    cell.lat += p.lat
    cell.lng += p.lng
    cell.n += 1
    cells.set(key, cell)
  }
  return [...cells.values()]
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key))
    .slice(0, MAX_TRIP_PLACES)
    .map((c) => ({ lat: Math.round((c.lat / c.n) * 1000) / 1000, lng: Math.round((c.lng / c.n) * 1000) / 1000 }))
}

export function samePlaces(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  return a.every((p, i) => p.lat === b[i].lat && p.lng === b[i].lng)
}

// Un pays saisi à la main allume ses terres proches de son point, pas ses
// territoires lointains : « France » allume la métropole et la Corse, pas la Guyane.
const COUNTRY_REACH_KM = 2000

/**
 * Ce que la carte du monde allume, d'après les voyages et les saisies à la
 * main (`manual` : `{ id, name, lat, lng, country, kind, radiusKm }`).
 * `statusOf(trip)` : 'upcoming' | 'ongoing' | 'past' ; un voyage à venir
 * allume en « prévu ». `hint(place)` : le pays connu de Photon pour ce lieu,
 * qui l'emporte sur les contours (Singapour n'existe pas à 1:110m).
 *
 * Rend `{ countries, lit, points }` :
 *  · `countries` : `Map(id → { id, visited, trips: [{ trip, places, visited }], manual: [entrée] })` ;
 *  · `lit` : `Map(clé de terre → { part, visited })` ;
 *  · `points` : les lieux, `{ lat, lng, country, visited, radiusKm }`.
 */
export function worldVisits({ trips = [], manual = [], world, statusOf, hint = () => null }) {
  const countries = new Map()
  const lit = new Map()
  const points = []
  const country = (id) => {
    if (!countries.has(id)) countries.set(id, { id, visited: false, trips: [], manual: [] })
    return countries.get(id)
  }
  const light = (part, visited) => {
    const prev = lit.get(part.key)
    lit.set(part.key, { part, visited: visited || !!prev?.visited })
  }

  for (const trip of trips) {
    const visited = statusOf(trip) !== 'upcoming'
    const perCountry = new Map()
    for (const place of trip.places || []) {
      const part = partAt(place, world)
      const id = hint(place) || part?.country
      if (!id) continue
      if (part && part.country === id) light(part, visited)
      points.push({ lat: place.lat, lng: place.lng, country: id, visited, radiusKm: 8 })
      if (!perCountry.has(id)) perCountry.set(id, [])
      perCountry.get(id).push(place)
    }
    for (const [id, places] of perCountry) {
      const entry = country(id)
      entry.visited ||= visited
      entry.trips.push({ trip, places, visited })
    }
  }

  for (const item of manual) {
    if (!hasCoords(item)) continue
    if (item.kind === 'country') {
      const id = item.country || countryAt(item, world)
      if (!id) continue
      const parts = world.byCountry.get(id) || []
      const near = parts.filter((p) => haversineKm(p.center, item) <= COUNTRY_REACH_KM)
      const chosen = near.length ? near : parts.slice(0, 1)
      chosen.forEach((p) => light(p, true))
      const entry = country(id)
      entry.visited = true
      entry.manual.push(item)
      continue
    }
    // Un lieu : sa terre seulement s'il est DEDANS. Une île trop petite pour
    // la carte (Ouvéa) n'allume pas sa voisine : son halo la montre.
    const part = partAt(item, world, { coast: false })
    const id = item.country || part?.country
    if (!id) continue
    if (part && part.country === id) light(part, true)
    points.push({ lat: item.lat, lng: item.lng, country: id, visited: true, radiusKm: item.radiusKm || 8 })
    const entry = country(id)
    entry.visited = true
    entry.manual.push(item)
  }

  return { countries, lit, points }
}

function haversineKm(a, b) {
  const dLat = (b.lat - a.lat) * RAD
  const dLng = (b.lng - a.lng) * RAD
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Cadre de l'aperçu : rapport 2:1, comme le monde entier en Equal Earth.
const RATIO = 2
// Le plus petit cadre (~25° de large) : un seul voyage ne zoome pas sur un quartier.
const MIN_WIDTH = 45

/** Le cadre SVG autour de points `[x, y]` projetés, au rapport 2:1, sans sortir du monde. */
export function frameAround(xy) {
  const [wx, wy, ww, wh] = WORLD_VIEWBOX
  if (!xy.length) return WORLD_VIEWBOX
  const xs = xy.map((p) => p[0])
  const ys = xy.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  let w = Math.max(MIN_WIDTH, (Math.max(...xs) - Math.min(...xs)) * 1.4, (Math.max(...ys) - Math.min(...ys)) * 1.4 * RATIO)
  w = Math.min(w, ww)
  const h = Math.min(w / RATIO, wh)
  const x = Math.min(Math.max(cx - w / 2, wx), wx + ww - w)
  const y = Math.min(Math.max(cy - h / 2, wy), wy + wh - h)
  return [x, y, w, h]
}

/** Les terres allumées en GeoJSON (MapLibre), en degrés. */
export function litGeoJSON(lit) {
  return {
    type: 'FeatureCollection',
    features: [...lit.values()].map(({ part, visited }) => ({
      type: 'Feature',
      properties: { country: part.country, visited },
      geometry: {
        type: 'Polygon',
        coordinates: part.rings.map((ring) => {
          const coords = []
          for (let i = 0; i < ring.length; i += 2) coords.push([ring[i] / 100, ring[i + 1] / 100])
          coords.push(coords[0])
          return coords
        }),
      },
    })),
  }
}

/** Les lieux en GeoJSON (MapLibre). */
export function pointsGeoJSON(points) {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      properties: { country: p.country, visited: p.visited, radiusKm: p.radiusKm },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  }
}
