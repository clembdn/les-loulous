// Dérouler un lien Google Maps jusqu'à un lieu : nom, adresse, coordonnées.
//
// Le navigateur ne peut pas suivre `maps.app.goo.gl/…` (CORS) : ce module
// tourne dans la fonction Vercel `api/resolve-maps`. Du plus fiable au plus
// approximatif :
//   1. suivre les redirections et lire l'URL finale (cf. parseMapsUrl) ;
//   2. un lien de partage récent ne donne que l'identifiant du lieu (ftid) :
//      la recherche de Google Maps, interrogée avec le nom, rend ce lieu-là
//      avec ses coordonnées exactes ; on ne garde que le résultat qui porte
//      CE ftid, et seulement s'il tombe dans la zone que le ftid encode ;
//   3. à défaut, la zone du ftid elle-même (quelques centaines de mètres) ;
//   4. sans ftid, le nom (et l'adresse) dans OpenStreetMap (Photon).
//
// Jamais de coordonnées lues dans le HTML de la page : Google y met le centre
// de la carte par défaut, déduit de l'adresse IP… du serveur. Tous les liens
// atterrissaient ainsi près de Washington (région Vercel iad1).
//
// Liste blanche stricte : on ne suit QUE des liens Google Maps, à chaque saut.
// Sans elle, cette fonction publique servirait de relais pour aller chercher
// n'importe quelle URL au nom de notre serveur.
//
// Les dépendances réseau sont injectées (`fetchImpl`) : testé sous `node --test`,
// et contre le vrai Google avec `node api/_lib/mapsResolver.live.mjs`.

import { isMapsUrl, isShortMapsUrl, parseMapsUrl, toUrl } from '../../src/apps/trip/utils/mapsUrl.js'
import { ftidArea, mapsFtid } from '../../src/apps/trip/utils/ftid.js'
import { haversineM } from '../../src/apps/trip/utils/geo.js'
import { photonPlaces, photonUrl } from '../../src/apps/trip/utils/photon.js'

const MAX_HOPS = 5
const TIMEOUT_MS = 5000
const MAX_BODY = 3_000_000
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
// Le robot d'aperçu de liens : Google lui sert le nom et l'adresse du lieu
// (og:title), qu'il ne met pas dans la page servie à un navigateur.
const PREVIEW_AGENT = 'facebookexternalhit/1.1'
// Écart toléré entre la zone du ftid et la position trouvée (2,5 km mesurés
// pour la tour Eiffel ; au-delà, ce n'est pas le même lieu).
const MAX_AREA_GAP_M = 10_000

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

/**
 * Les coordonnées du lieu `ftid` dans une réponse de la recherche Google
 * Maps (`/search?tbm=map`, du JSON précédé de `)]}'`). Chaque résultat y est
 * un tableau qui contient, entre autres, son ftid et `[null, null, lat, lng]` :
 * on cherche le tableau qui porte les deux, sans dépendre des positions
 * exactes, que Google change sans prévenir. `null` si le lieu n'y est pas.
 */
export function findPlaceInSearch(text, ftid) {
  let data
  try {
    data = JSON.parse(text.replace(/^\)\]\}'\s*/, '').replace(/\/\*""\*\/\s*$/, ''))
  } catch {
    return null
  }
  const isLatLng = (x) => Array.isArray(x) && x.length >= 4 && x[0] === null && x[1] === null
    && Number.isFinite(x[2]) && Number.isFinite(x[3]) && Math.abs(x[2]) <= 90 && Math.abs(x[3]) <= 180
  const stack = [data]
  while (stack.length) {
    const node = stack.pop()
    if (!Array.isArray(node)) continue
    if (node.includes(ftid)) {
      const coords = node.find(isLatLng)
      if (coords) return { lat: coords[2], lng: coords[3] }
    }
    for (const child of node) if (Array.isArray(child)) stack.push(child)
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

  const ftid = mapsFtid(url)
  const area = ftidArea(ftid)
  const near = (p) => !area || haversineM(area, p) <= MAX_AREA_GAP_M

  // Le nom et l'adresse, s'il faut les demander à Google (lien sans `q=`).
  let place = parsed
  if (!place.name && !isShortMapsUrl(url)) {
    const title = await fetchTitle(fetchImpl, url)
    if (title) place = { ...place, name: title.name, address: place.address || title.address }
  }
  const query = [place.name, place.address].filter(Boolean).join(', ')

  // 2. Le lieu exact, par la recherche Google Maps, apparié par son ftid.
  if (ftid && query) {
    const found = await searchGoogle(fetchImpl, query, ftid)
    if (found && near(found)) return ok({ ...place, ...found }, url)
  }

  // 3-4. OpenStreetMap, orienté vers la zone du ftid quand on l'a ;
  // sinon la zone elle-même. Dans les deux cas : « à vérifier ».
  if (query) {
    const hit = await searchPhoton(fetchImpl, query, area)
    if (hit && near(hit)) {
      return ok({ name: place.name || hit.name, address: place.address || hit.address, lat: hit.lat, lng: hit.lng }, url, { approximate: true })
    }
  }
  if (area) return ok({ ...place, ...area }, url, { approximate: true })

  return { status: 422, body: { error: 'coords-not-found', name: place.name || null, address: place.address || null, url } }
}

// Chaque appel ci-dessous peut échouer (réseau, format changé, Google qui
// refuse le serveur) : il rend alors `null`, et on passe à l'étage suivant.

async function fetchTitle(fetchImpl, url) {
  try {
    const res = await timedFetch(fetchImpl, url, {
      headers: { 'user-agent': PREVIEW_AGENT, 'accept-language': 'fr-FR,fr;q=0.9' },
    })
    return res.ok ? extractTitle((await res.text()).slice(0, MAX_BODY)) : null
  } catch {
    return null
  }
}

async function searchGoogle(fetchImpl, query, ftid) {
  const params = new URLSearchParams({ tbm: 'map', hl: 'fr', q: query })
  try {
    const res = await timedFetch(fetchImpl, `https://www.google.com/search?${params}`, {
      headers: { 'user-agent': USER_AGENT, 'accept-language': 'fr-FR,fr;q=0.9' },
    })
    return res.ok ? findPlaceInSearch((await res.text()).slice(0, MAX_BODY), ftid) : null
  } catch {
    return null
  }
}

async function searchPhoton(fetchImpl, query, near) {
  try {
    const res = await timedFetch(fetchImpl, photonUrl(query, { near, limit: 1 }))
    const [hit] = res.ok ? photonPlaces(await res.json()) : []
    return hit || null
  } catch {
    return null
  }
}
