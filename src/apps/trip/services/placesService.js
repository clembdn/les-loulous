// Trouver un lieu à partir de ce qu'on colle ou tape.
//
//  · lien LONG Google Maps → lu sur place (utils/mapsUrl), y compris hors-ligne ;
//  · lien COURT → déroulé par la fonction Vercel `/api/resolve-maps` ;
//  · texte → recherche Photon (OpenStreetMap), gratuite et sans clé.
// Sans réseau, le lieu est gardé tel quel — un nom, un lien — et localisé
// plus tard : on ne bloque jamais la saisie d'une étape pour une coordonnée.

import { ftidArea, mapsFtid } from '../utils/ftid.js'
import { isShortMapsUrl, parseMapsUrl } from '../utils/mapsUrl.js'
import { photonPlaces, photonUrl } from '../utils/photon.js'

// Le serveur public de Photon met parfois plusieurs secondes à répondre :
// on patiente (la roue tourne) plutôt que d'abandonner trop tôt.
const TIMEOUT_MS = 12000
// Le CDN de Vercel garde chaque réponse de `/api/resolve-maps` un jour (une
// semaine en version périmée), clé = l'URL : changer la version quand le
// résolveur change de réponse, sinon les anciennes resservent.
// v2 : plus de coordonnées lues dans la page (c'était le centre déduit de l'IP).
const RESOLVER_VERSION = '2'

// `signal` : la recherche n'a plus lieu d'être (on a continué de taper).
async function fetchWithTimeout(url, signal = null) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Un lien Google Maps → `{ place, located, message }`.
 *   `place`   : `{ name, address, lat, lng, mapsUrl }`, coordonnées éventuellement nulles ;
 *   `located` : les coordonnées sont là ;
 *   `message` : pourquoi elles n'y sont pas, ou qu'elles sont approximatives.
 * Rend `null` si ce n'est pas un lien Google Maps.
 */
export async function resolveMapsLink(text) {
  const mapsUrl = text.trim()
  const parsed = parseMapsUrl(mapsUrl)
  if (!parsed) return null

  const place = { name: parsed.name, address: parsed.address, lat: parsed.lat, lng: parsed.lng, mapsUrl }
  if (parsed.lat !== null) return { place, located: true, message: null }

  // Un lien long porte souvent l'identifiant du lieu, qui en donne la zone
  // sans réseau (cf. utils/ftid.js) : de quoi le placer, en le disant approximatif.
  const area = ftidArea(mapsFtid(mapsUrl))
  const approximate = (p) => (area
    ? { place: { ...p, ...area }, located: true, message: 'Position approximative : à vérifier sur la carte.' }
    : null)

  if (isOffline()) {
    return approximate(place)
      || { place, located: false, message: 'Hors-ligne : le lien est gardé, le lieu sera localisé plus tard.' }
  }

  try {
    const params = new URLSearchParams({ v: RESOLVER_VERSION, url: mapsUrl })
    const res = await fetchWithTimeout(`/api/resolve-maps?${params}`)
    const body = await res.json().catch(() => ({}))
    const name = body.name || place.name
    const address = body.address || place.address
    if (res.ok && Number.isFinite(body.lat) && Number.isFinite(body.lng)) {
      return {
        place: { name, address, lat: body.lat, lng: body.lng, mapsUrl },
        located: true,
        message: body.approximate ? 'Position approximative : à vérifier sur la carte.' : null,
      }
    }
    return approximate({ ...place, name, address }) || {
      place: { ...place, name, address },
      located: false,
      message: isShortMapsUrl(mapsUrl) && !name
        ? 'Lien illisible : tapez le nom du lieu et cherchez-le.'
        : 'Pas de coordonnées dans ce lien : cherchez le lieu par son nom.',
    }
  } catch {
    return approximate(place)
      || { place, located: false, message: 'Le lien n’a pas pu être lu : réessayez avec du réseau.' }
  }
}

/**
 * Recherche par nom, biaisée vers `near` (un lieu du voyage). Rend `[]`
 * hors-ligne. `signal` annule une recherche dépassée par la frappe.
 */
export async function searchPlaces(query, { near = null, signal = null } = {}) {
  if (!query.trim() || isOffline()) return []
  const res = await fetchWithTimeout(photonUrl(query, { near }), signal)
  if (!res.ok) throw new Error(`Photon ${res.status}`)
  return photonPlaces(await res.json())
}
