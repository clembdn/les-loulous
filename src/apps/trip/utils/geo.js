// Géométrie de poche : distances et projection des mini-cartes.
//
// Pas de bibliothèque de carto : une mini-carte est un DESSIN du parcours
// (le plan du métro, pas la vue satellite). Une projection équirectangulaire
// corrigée par le cosinus de la latitude suffit, de la ruelle au pays entier.
// Module pur, testé sous `node --test`.

const EARTH_RADIUS_M = 6371008.8

export function hasCoords(p) {
  return Number.isFinite(p?.lat) && Number.isFinite(p?.lng)
}

/** Distance à vol d'oiseau, en mètres. */
export function haversineM(a, b) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** « 850 m », « 1,2 km », « 38 km » — arrondi à ce qu'on peut lire d'un coup d'œil. */
export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return ''
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`
  const km = meters / 1000
  // 9,96 km s'arrondirait en « 10,0 km » : la décimale s'arrête juste avant.
  if (km < 9.95) return `${km.toFixed(1).replace('.', ',')} km`
  return `${Math.round(km)} km`
}

// Écart minimal représenté, en degrés (~1 km) : deux étapes à cinquante
// mètres l'une de l'autre ne doivent pas se retrouver aux deux bouts du cadre,
// comme si elles étaient loin.
const MIN_SPAN_DEG = 0.01

/**
 * Place des points `{ lat, lng }` dans un cadre `width × height` en gardant
 * `pad` de marge. Rend des `[x, y]` dans le même ordre.
 *
 * Un parcours qui traverse l'antiméridien (Fidji, Nouvelle-Zélande ↔ Samoa)
 * est recousu : sans ça, deux îles voisines se retrouveraient chacune à un
 * bout du monde.
 */
export function projectPoints(points, width, height, pad = 0) {
  if (!points.length) return []
  const lngs = points.map((p) => p.lng)
  const wraps = Math.max(...lngs) - Math.min(...lngs) > 180
  const lats = points.map((p) => p.lat)
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const k = Math.cos((midLat * Math.PI) / 180)

  const xs = points.map((p) => (wraps && p.lng < 0 ? p.lng + 360 : p.lng) * k)
  const ys = points.map((p) => -p.lat)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const spanX = Math.max(...xs) - minX
  const spanY = Math.max(...ys) - minY

  const scale = Math.min(
    (width - 2 * pad) / Math.max(spanX, MIN_SPAN_DEG),
    (height - 2 * pad) / Math.max(spanY, MIN_SPAN_DEG),
  )
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2
  return xs.map((x, i) => [offsetX + (x - minX) * scale, offsetY + (ys[i] - minY) * scale])
}
