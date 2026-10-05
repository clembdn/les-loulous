// Dérouler un lien Google Maps jusqu'à un lieu : nom, adresse, coordonnées.
//
// Le navigateur ne peut pas suivre `maps.app.goo.gl/…` (CORS) : ce module
// tourne dans la fonction Vercel `api/resolve-maps`. Trois étages, du plus
// fiable au plus approximatif :
//   1. suivre les redirections et lire l'URL finale (cf. parseMapsUrl) ;
//   2. à défaut, lire les coordonnées dans la page elle-même ;
//   3. à défaut, chercher le nom dans OpenStreetMap (Photon).
//
// Liste blanche stricte : on ne suit QUE des liens Google Maps, à chaque saut.
// Sans elle, cette fonction publique servirait de relais pour aller chercher
// n'importe quelle URL au nom de notre serveur.
//
// Les dépendances réseau sont injectées (`fetchImpl`) : testé sous `node --test`.

import { isMapsUrl, isShortMapsUrl, parseMapsUrl, toUrl } from '../../src/apps/trip/utils/mapsUrl.js'
import { photonPlaces, photonUrl } from '../../src/apps/trip/utils/photon.js'

const MAX_HOPS = 5
const TIMEOUT_MS = 5000
const MAX_HTML = 3_000_000
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

async function timedFetch(fetchImpl, url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// Depuis l'Europe, Google intercale sa page de consentement ; l'adresse
// visée est dans son paramètre `continue`.
function unwrapConsent(href) {
  const url = toUrl(href)
  if (url?.hostname === 'consent.google.com') return url.searchParams.get('continue') || href
  return href
}

function validCoords(lat, lng) {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return null
  if (la === 0 && ln === 0) return null
  return { lat: la, lng: ln }
}

/**
 * Coordonnées d'un lieu dans le HTML d'une page Google Maps. Fragile par
 * nature — Google ne s'y engage à rien — d'où plusieurs motifs, et le repli
 * sur Photon si aucun ne répond.
 */
export function extractCoordsFromHtml(html) {
  const patterns = [
    // Image d'aperçu : …/staticmap?center=38.69%2C-9.21&…
    /staticmap\?center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/,
    /center=(-?\d+\.\d+),(-?\d+\.\d+)/,
    // État initial de l'app : [null,null,38.69,-9.21]
    /\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    const coords = m && validCoords(m[1], m[2])
    if (coords) return coords
  }
  return null
}

/** « Pastéis de Belém · Rua de Belém 84-92, Lisboa » (og:title) → nom et adresse. */
export function extractTitle(html) {
  const m = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
    || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i)
  if (!m) return null
  const text = m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim()
  const [name, ...rest] = text.split(' · ')
  if (!name || /^Google Maps$/i.test(name)) return null
  return { name: name.trim(), address: rest.join(' · ').trim() || null }
}

function ok(place, url, extra = {}) {
  return {
    status: 200,
    body: {
      name: place.name || '',
      address: place.address || null,
      lat: place.lat,
      lng: place.lng,
      url,
      ...extra,
    },
  }
}

/**
 * `{ status, body }` — le corps est déjà la réponse JSON de l'API :
 *   200 `{ name, address, lat, lng, url, approximate? }`
 *   400 lien invalide ou pas Google Maps
 *   422 lien lu mais sans coordonnées (`name`/`address` quand on les a)
 */
export async function resolveMapsLink(raw, { fetchImpl = fetch } = {}) {
  if (typeof raw !== 'string' || raw.length > 2000 || !isMapsUrl(raw)) {
    return { status: 400, body: { error: 'not-a-maps-link' } }
  }

  // 1. Suivre les redirections, saut par saut, sans jamais sortir de Google Maps.
  let url = raw.trim()
  for (let hop = 0; isShortMapsUrl(url) && hop < MAX_HOPS; hop += 1) {
    const res = await timedFetch(fetchImpl, url, { redirect: 'manual', headers: { 'user-agent': USER_AGENT } })
    const location = res.headers.get('location')
    if (!location) break
    const next = unwrapConsent(new URL(location, url).href)
    if (!isMapsUrl(next)) return { status: 422, body: { error: 'unexpected-redirect' } }
    url = next
  }

  const parsed = parseMapsUrl(url) || { name: '', address: null, lat: null, lng: null }
  if (parsed.lat !== null) return ok(parsed, url)

  // 2. Les coordonnées dans la page.
  let place = parsed
  if (!isShortMapsUrl(url)) {
    try {
      const res = await timedFetch(fetchImpl, url, {
        headers: { 'user-agent': USER_AGENT, 'accept-language': 'fr-FR,fr;q=0.9' },
      })
      if (res.ok) {
        const html = (await res.text()).slice(0, MAX_HTML)
        const title = extractTitle(html)
        place = { ...parsed, name: parsed.name || title?.name || '', address: parsed.address || title?.address || null }
        const coords = extractCoordsFromHtml(html)
        if (coords) return ok({ ...place, ...coords }, url)
      }
    } catch {
      // Page inaccessible : on tente OpenStreetMap avec ce qu'on sait déjà.
    }
  }

  // 3. Le nom (et l'adresse) dans OpenStreetMap.
  const query = [place.name, place.address].filter(Boolean).join(', ')
  if (query) {
    try {
      const res = await timedFetch(fetchImpl, photonUrl(query, { limit: 1 }))
      const [hit] = res.ok ? photonPlaces(await res.json()) : []
      if (hit) {
        return ok({ name: place.name || hit.name, address: place.address || hit.address, lat: hit.lat, lng: hit.lng }, url, { approximate: true })
      }
    } catch {
      // Photon injoignable : on rend ce qu'on a.
    }
  }

  return { status: 422, body: { error: 'coords-not-found', name: place.name || null, address: place.address || null, url } }
}
