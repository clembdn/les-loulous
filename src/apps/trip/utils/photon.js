// Photon (photon.komoot.io) : la recherche de lieux d'OpenStreetMap. Gratuite,
// sans clé, ouverte au navigateur (CORS) — le secours quand on n'a pas de lien
// Google Maps sous la main : une gare, un aéroport, une plage dont on connaît
// le nom.
//
// Module pur : l'app ET la fonction serveur s'en servent. Testé sous `node --test`.

import { guessCategory } from './categoryGuess.js'

const ENDPOINT = 'https://photon.komoot.io/api/'

/** URL de recherche, biaisée vers `near` ({ lat, lng }) s'il est fourni. */
export function photonUrl(query, { near = null, limit = 6 } = {}) {
  const params = new URLSearchParams({ q: query.trim(), limit: String(limit), lang: 'fr' })
  if (Number.isFinite(near?.lat) && Number.isFinite(near?.lng)) {
    params.set('lat', String(near.lat))
    params.set('lon', String(near.lng))
  }
  return `${ENDPOINT}?${params}`
}

/**
 * Une réponse Photon (GeoJSON) → `{ name, address, lat, lng }`, plus
 * `category` quand les tags OpenStreetMap ou le nom permettent de la deviner.
 * L'adresse est reconstruite à partir de ce qu'OpenStreetMap connaît : rue,
 * ville, pays — sans répéter le nom.
 */
export function photonPlace(feature) {
  const [lng, lat] = feature?.geometry?.coordinates || []
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const p = feature.properties || {}
  const street = [p.housenumber, p.street].filter(Boolean).join(' ')
  const city = p.city || p.town || p.village || p.county || null
  const name = p.name || street || city || p.country || ''
  if (!name) return null
  const parts = [street, city, p.country].filter((part) => part && part !== name)
  const category = guessCategory({ osmKey: p.osm_key, osmValue: p.osm_value, name })
  return {
    name,
    address: [...new Set(parts)].join(', ') || null,
    lat,
    lng,
    ...(category ? { category } : {}),
  }
}

/**
 * Toutes les réponses utilisables, sans doublon : OpenStreetMap décrit souvent
 * un même monument trois fois (le point, le bâtiment, l'enceinte), sous le
 * même nom à la même adresse.
 */
export function photonPlaces(body) {
  const seen = new Set()
  return (body?.features || []).map(photonPlace).filter((place) => {
    if (!place) return false
    const key = `${place.name}|${place.address}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Recherche inverse : qu'y a-t-il en ce point ? (noms en français) */
export function photonReverseUrl({ lat, lng }) {
  return `https://photon.komoot.io/reverse?${new URLSearchParams({ lat: String(lat), lon: String(lng), lang: 'fr', limit: '1' })}`
}

/**
 * La ville et le pays d'une réponse de recherche inverse : `{ city,
 * countryCode }`. Une commune portugaise arrive avec ses paroisses entre
 * parenthèses (« Sintra (Santa Maria e São Miguel, …) ») : on garde « Sintra ».
 */
export function photonCity(body) {
  const p = body?.features?.[0]?.properties
  if (!p) return null
  const raw = p.city || p.town || p.village || p.county || p.state || null
  const city = raw ? raw.replace(/\s*\(.*\)\s*$/, '').trim() || null : null
  const countryCode = regionCode(p.countrycode, p.state)
  return city || countryCode ? { city, countryCode } : null
}

// Pour OpenStreetMap, la Nouvelle-Calédonie ou La Réunion sont « en France »
// (code FR, région « Nouvelle-Calédonie »). Pour nous, ce sont des
// destinations à part : Ouvéa ne doit compter ni pour la France, ni allumer
// la métropole. (La Guyane reste en France : c'est une terre du contour
// français de Natural Earth.)
const OVERSEAS = {
  FR: {
    'nouvelle-caledonie': 'NC', 'polynesie francaise': 'PF', 'wallis-et-futuna': 'WF',
    'saint-pierre-et-miquelon': 'PM', 'saint-barthelemy': 'BL', 'saint-martin': 'MF',
    'la reunion': 'RE', mayotte: 'YT', guadeloupe: 'GP', martinique: 'MQ',
  },
  US: {
    'porto rico': 'PR', guam: 'GU', 'samoa americaines': 'AS', 'iles vierges des etats-unis': 'VI',
  },
}

const plain = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/** Le code pays (ISO à deux lettres) d'un résultat Photon, outre-mer compris. */
export function regionCode(countrycode, state) {
  if (typeof countrycode !== 'string' || !/^[A-Za-z]{2}$/.test(countrycode)) return null
  const code = countrycode.toUpperCase()
  return (typeof state === 'string' && OVERSEAS[code]?.[plain(state)]) || code
}

const KIND_LABEL = { country: 'Pays', island: 'Île', place: 'Ville ou lieu' }

/**
 * Un résultat de recherche pour « Ajouter un pays ou un lieu » déjà visité :
 * `{ name, lat, lng, country, kind, radiusKm, label, detail }`. `kind` :
 * 'country' (tout le pays), 'island', ou 'place' (une ville, une région).
 * `radiusKm` : la taille du lieu (son emprise), pour son halo sur la carte.
 */
export function photonArea(feature) {
  const [lng, lat] = feature?.geometry?.coordinates || []
  const p = feature?.properties || {}
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !p.name) return null
  const country = regionCode(p.countrycode, p.state)
  if (!country) return null
  const kind = p.osm_value === 'country' || p.type === 'country'
    ? 'country'
    : ['island', 'islet', 'archipelago'].includes(p.osm_value) ? 'island' : 'place'
  let radiusKm = 8
  if (Array.isArray(p.extent) && p.extent.length === 4) {
    const [west, north, east, south] = p.extent
    const kmLat = Math.abs(north - south) * 111
    const kmLng = Math.abs(east - west) * 111 * Math.cos(((north + south) / 2) * Math.PI / 180)
    radiusKm = Math.round(Math.min(150, Math.max(4, Math.hypot(kmLat, kmLng) / 2)))
  }
  const where = [p.state, p.country].filter((part, i, all) => part && part !== p.name && all.indexOf(part) === i)
  return {
    name: p.name,
    lat: Math.round(lat * 1e4) / 1e4,
    lng: Math.round(lng * 1e4) / 1e4,
    country,
    kind,
    radiusKm,
    label: KIND_LABEL[kind],
    detail: where.join(', ') || null,
  }
}

/** Les résultats utilisables, sans doublon (la commune et l'île d'Ouvéa : on garde l'île). */
export function photonAreas(body) {
  const out = []
  for (const area of (body?.features || []).map(photonArea)) {
    if (!area) continue
    const twin = out.find((a) => a.name === area.name && a.country === area.country && Math.abs(a.lat - area.lat) < 0.5 && Math.abs(a.lng - area.lng) < 0.5)
    if (!twin) out.push(area)
    else if (area.kind === 'island' && twin.kind !== 'island') Object.assign(twin, area)
  }
  return out
}
