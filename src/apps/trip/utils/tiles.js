// Les tuiles de carte à emporter hors-ligne.
//
// Les cartes viennent d'OpenFreeMap : des tuiles vectorielles de 512 px,
// jusqu'au zoom 14 (au-delà, MapLibre agrandit celles du 14). Avant de partir,
// on télécharge celles qui couvrent chaque lieu du voyage, à quelques niveaux
// de zoom autour de celui où la carte du jour s'affiche : de quoi lire la
// carte, et zoomer un peu, sans réseau.
//
// Module pur, testé sous `node --test`.

import { hasCoords } from './geo.js'

export const TILE_SIZE = 512
export const MAX_TILE_ZOOM = 14

// Un lieu seul ou deux étapes voisines : on emporte au moins le quartier
// (~1,5 km de côté), pas une seule tuile.
const MIN_SPAN_DEG = 0.015

function clampLat(lat) {
  return Math.max(-85.0511, Math.min(85.0511, lat))
}

/** Colonne de la tuile qui contient la longitude `lng` au zoom `z`. */
export function tileX(lng, z) {
  const n = 2 ** z
  return Math.min(n - 1, Math.max(0, Math.floor(((lng + 180) / 360) * n)))
}

/** Rangée de la tuile qui contient la latitude `lat` au zoom `z` (Web Mercator). */
export function tileY(lat, z) {
  const n = 2 ** z
  const rad = (clampLat(lat) * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n
  return Math.min(n - 1, Math.max(0, Math.floor(y)))
}

/** L'emprise `{ west, south, east, north }` de points `{ lat, lng }`, ou `null`. */
export function boundsOf(points) {
  const located = points.filter(hasCoords)
  if (!located.length) return null
  const lats = located.map((p) => p.lat)
  const lngs = located.map((p) => p.lng)
  let south = Math.min(...lats)
  let north = Math.max(...lats)
  let west = Math.min(...lngs)
  let east = Math.max(...lngs)
  if (north - south < MIN_SPAN_DEG) {
    const mid = (north + south) / 2
    south = mid - MIN_SPAN_DEG / 2
    north = mid + MIN_SPAN_DEG / 2
  }
  if (east - west < MIN_SPAN_DEG) {
    const mid = (east + west) / 2
    west = mid - MIN_SPAN_DEG / 2
    east = mid + MIN_SPAN_DEG / 2
  }
  return { west, south, east, north }
}

function mercatorY(lat) {
  const rad = (clampLat(lat) * Math.PI) / 180
  return Math.log(Math.tan(Math.PI / 4 + rad / 2))
}

/**
 * Le zoom auquel l'emprise tient dans un cadre `width × height` (en px CSS),
 * celui que choisira la carte du jour.
 */
export function fitZoom(bounds, width, height) {
  const spanX = (bounds.east - bounds.west) / 360
  const spanY = (mercatorY(bounds.north) - mercatorY(bounds.south)) / (2 * Math.PI)
  const zx = Math.log2(width / (TILE_SIZE * Math.max(spanX, 1e-9)))
  const zy = Math.log2(height / (TILE_SIZE * Math.max(spanY, 1e-9)))
  return Math.min(zx, zy)
}

/** Toutes les tuiles `[z, x, y]` qui couvrent l'emprise au zoom `z`. */
export function tilesFor(bounds, z) {
  const x0 = tileX(bounds.west, z)
  const x1 = tileX(bounds.east, z)
  const y0 = tileY(bounds.north, z)
  const y1 = tileY(bounds.south, z)
  const tiles = []
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push([z, x, y])
  return tiles
}

/**
 * Les tuiles à emporter pour un voyage : pour chaque emprise (une journée,
 * un hébergement), du zoom de la carte du jour moins un à plus deux.
 *
 * Sans doublon, triées des zooms larges aux plus fins : si le plafond `cap`
 * coupe la liste, on garde partout de quoi voir la carte, quitte à perdre
 * le détail des rues de quelques lieux.
 */
export function planTiles(boundsList, { width = 390, height = 300, below = 1, above = 2, cap = 800 } = {}) {
  const seen = new Set()
  const tiles = []
  for (const bounds of boundsList) {
    if (!bounds) continue
    const base = Math.floor(fitZoom(bounds, width, height))
    const from = Math.max(0, Math.min(MAX_TILE_ZOOM, base - below))
    const to = Math.max(0, Math.min(MAX_TILE_ZOOM, base + above))
    for (let z = from; z <= to; z++) {
      for (const tile of tilesFor(bounds, z)) {
        const key = tile.join('/')
        if (seen.has(key)) continue
        seen.add(key)
        tiles.push(tile)
      }
    }
  }
  tiles.sort((a, b) => a[0] - b[0])
  return tiles.slice(0, cap)
}

/** L'adresse d'une tuile d'après le gabarit du TileJSON (`…/{z}/{x}/{y}.pbf`). */
export function tileUrl(template, [z, x, y]) {
  return template.replace('{z}', z).replace('{x}', x).replace('{y}', y)
}

/**
 * Les emprises d'un voyage lu depuis Firestore : une par journée qui a des
 * étapes localisées, une par hébergement, une par gare ou aéroport.
 */
export function tripBounds({ stays = [], transports = [], days = [] }) {
  const list = []
  for (const day of days) list.push(boundsOf(day.stops || []))
  for (const stay of stays) list.push(boundsOf([stay]))
  for (const t of transports) list.push(boundsOf([t.from || {}]), boundsOf([t.to || {}]))
  return list.filter(Boolean)
}
