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
