// Liens Google Maps : les reconnaître, les lire, en fabriquer.
//
// Un lien LONG (google.com/maps/place/…) contient déjà le nom et les
// coordonnées : il se lit ici, dans le navigateur, même hors-ligne. Un lien
// COURT (maps.app.goo.gl/…, celui du bouton « Partager » de l'app) ne dit
// rien tant qu'on ne l'a pas suivi — et le navigateur ne peut pas le suivre
// (CORS) : c'est le travail de la fonction Vercel `api/resolve-maps`, qui
// réutilise ce même module.
//
// Module pur, sans dépendance : importé par l'app ET par la fonction serveur,
// testé sous `node --test`.

const SHORT_HOSTS = new Set(['maps.app.goo.gl'])
// google.com, www.google.fr, maps.google.co.uk, www.google.com.au…
const GOOGLE_HOST_RE = /^(?:www\.|maps\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/

const COORDS_RE = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/

export function toUrl(text) {
  if (typeof text !== 'string') return null
  try {
    const url = new URL(text.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

/** Le texte ressemble-t-il à un lien (et pas à un nom de lieu) ? */
export function looksLikeUrl(text) {
  return typeof text === 'string' && /^\s*https?:\/\/\S+\s*$/i.test(text)
}

function isGoogleMapsUrl(url) {
  if (SHORT_HOSTS.has(url.hostname)) return true
  if (url.hostname === 'goo.gl') return url.pathname.startsWith('/maps')
  if (!GOOGLE_HOST_RE.test(url.hostname)) return false
  return url.hostname.startsWith('maps.') || url.pathname.startsWith('/maps')
}

/** Un lien Google Maps, court ou long. C'est aussi la liste blanche du serveur. */
export function isMapsUrl(text) {
  const url = toUrl(text)
  return !!url && isGoogleMapsUrl(url)
}

/** Un lien qu'il faut suivre pour savoir où il mène. */
export function isShortMapsUrl(text) {
  const url = toUrl(text)
  if (!url) return false
  return SHORT_HOSTS.has(url.hostname) || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps'))
}

function validCoords(lat, lng) {
  const la = Number(lat)
  const ln = Number(lng)
  return Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180
    ? { lat: la, lng: ln }
    : null
}

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment.replace(/\+/g, ' ')).trim()
  } catch {
    return segment.replace(/\+/g, ' ').trim()
  }
}

// « Pastéis de Belém, Rua de Belém 84-92, Lisboa » : le nom avant la première
// virgule, l'adresse après. Un lien de partage met souvent les deux dans `q`.
function splitNameAddress(text) {
  const i = text.indexOf(',')
  if (i === -1) return { name: text, address: null }
  return { name: text.slice(0, i).trim(), address: text.slice(i + 1).trim() || null }
}

/**
 * Lit un lien Google Maps : `{ name, address, lat, lng }`, les coordonnées à
 * `null` quand le lien n'en contient pas. `null` si ce n'est pas un lien Maps.
 *
 * Ordre de confiance des coordonnées :
 *  1. `!3d<lat>!4d<lng>` — la position du LIEU lui-même ;
 *  2. `q=`, `query=`, `ll=`, `destination=` quand ils contiennent des nombres ;
 *  3. `@<lat>,<lng>` — le centre de la carte affichée, proche mais pas exact.
 * Un lien d'itinéraire (`/maps/dir/`) n'a pas de lieu : son `@` est ignoré.
 */
export function parseMapsUrl(text) {
  const url = toUrl(text)
  if (!url || !isGoogleMapsUrl(url)) return null

  const href = decodeSegment(url.pathname + url.search + url.hash)
  const result = { name: '', address: null, lat: null, lng: null }

  // Nom : /maps/place/<nom>/… ou /maps/search/<texte>/…
  const named = url.pathname.match(/\/maps\/(?:place|search)\/([^/@]+)/)
  if (named) result.name = decodeSegment(named[1])

  let coords = null
  const pins = [...href.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)]
  if (pins.length) coords = validCoords(pins.at(-1)[1], pins.at(-1)[2])

  for (const key of ['q', 'query', 'll', 'destination', 'daddr']) {
    const value = url.searchParams.get(key)
    if (!value) continue
    const numeric = value.match(COORDS_RE)
    if (numeric) {
      coords ||= validCoords(numeric[1], numeric[2])
    } else if (!result.name && key !== 'll') {
      const { name, address } = splitNameAddress(value.trim())
      result.name = name
      result.address = address
    }
  }

  if (!coords && !url.pathname.includes('/maps/dir')) {
    const at = href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    if (at) coords = validCoords(at[1], at[2])
  }

  if (coords) Object.assign(result, coords)
  return result
}

function roundCoord(n) {
  return Math.round(n * 1e6) / 1e6
}

function destinationParam(place) {
  if (Number.isFinite(place?.lat) && Number.isFinite(place?.lng)) {
    return `${roundCoord(place.lat)},${roundCoord(place.lng)}`
  }
  return [place?.name, place?.address].filter(Boolean).join(', ')
}

/**
 * « Y aller » : l'itinéraire Google Maps jusqu'au lieu, depuis là où l'on se
 * trouve. Sur téléphone, le lien ouvre directement l'application.
 */
export function directionsUrl(place, { origin = null, mode = null } = {}) {
  const params = new URLSearchParams({ api: '1', destination: destinationParam(place) })
  if (origin) params.set('origin', destinationParam(origin))
  if (mode) params.set('travelmode', mode)
  return `https://www.google.com/maps/dir/?${params}`
}

/**
 * Tout le parcours d'une journée dans Google Maps : départ, étapes, arrivée.
 * Google n'accepte que 9 étapes intermédiaires sur mobile : au-delà, on garde
 * les premières, l'arrivée reste la vraie.
 */
export function dayRouteUrl(places) {
  const located = places.filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
  if (located.length < 2) return null
  const params = new URLSearchParams({
    api: '1',
    origin: destinationParam(located[0]),
    destination: destinationParam(located.at(-1)),
  })
  const waypoints = located.slice(1, -1).slice(0, 9).map(destinationParam)
  if (waypoints.length) params.set('waypoints', waypoints.join('|'))
  return `https://www.google.com/maps/dir/?${params}`
}

/** Montrer le lieu : le lien d'origine s'il y en a un, sinon une recherche. */
export function placeUrl(place) {
  if (place?.mapsUrl) return place.mapsUrl
  const query = destinationParam(place)
  if (!query) return null
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query })}`
}
