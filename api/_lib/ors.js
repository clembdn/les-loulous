// Trajets calculés par OpenRouteService (HeiGIT), offre gratuite « Standard » :
// 2 000 itinéraires par jour, 40 par minute. Largement assez : chaque trajet
// n'est demandé qu'une fois, puis rangé dans le jour (cf. utils/legs.js).
//
// La clé reste côté serveur (`ORS_API_KEY`, variable Vercel) : jamais
// dans le JavaScript envoyé aux téléphones.

import { LEG_MODE_IDS, getLegMode, MAX_RUN_POINTS } from '../../src/apps/trip/utils/legs.js'
import { decodePolyline, encodePolyline, simplifyPoints } from '../../src/apps/trip/utils/polyline.js'

const ORS_URL = 'https://api.openrouteservice.org/v2/directions'

/** `"38.69160,-9.21600;38.69750,-9.20320"` → `[{ lat, lng }, …]`, ou `null`. */
export function parsePoints(text) {
  if (typeof text !== 'string' || text.length > 2000) return null
  const points = text.split(';').map((pair) => {
    const [lat, lng] = pair.split(',').map(Number)
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng }
      : null
  })
  if (points.length < 2 || points.length > MAX_RUN_POINTS || points.some((p) => !p)) return null
  return points
}

class OrsError extends Error {
  constructor(status, code) {
    super(code)
    this.status = status
    this.code = code
  }
}

async function directions(profile, points, { key, fetchImpl }) {
  const res = await fetchImpl(`${ORS_URL}/${profile}/json`, {
    method: 'POST',
    headers: {
      authorization: key,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      coordinates: points.map((p) => [p.lng, p.lat]),
      // Indispensable : sans instructions, ORS ne rend pas `segments`, donc
      // ni la distance ni la durée de chaque tronçon (constaté le 2026-10-08).
      // Le guidage pas à pas qui vient avec est ignoré.
      instructions: true,
      // Un lieu au bord de l'eau ou au fond d'une allée : chercher la route
      // jusqu'à 1 km autour plutôt que d'échouer (350 m par défaut).
      radiuses: points.map(() => 1000),
    }),
  })
  if (res.status === 401 || res.status === 403) throw new OrsError(503, 'bad-key')
  if (res.status === 429) throw new OrsError(429, 'rate-limited')
  // 400 / 404 : pas de route entre ces points (île, trop loin, point
  // introuvable). Une réponse, pas une panne.
  if (res.status === 400 || res.status === 404) return null
  if (!res.ok) throw new OrsError(502, 'upstream-error')
  const json = await res.json()
  return json?.routes?.[0] || null
}

// Un tracé de voiture sur 300 km compte des milliers de points : on le
// simplifie à ~10 m près, ce qui suffit à une carte de téléphone.
function legFromRoute(route, i) {
  const segment = route.segments?.[i]
  const points = decodePolyline(route.geometry)
  const start = route.way_points?.[i]
  const end = route.way_points?.[i + 1]
  if (!segment || !Number.isInteger(start) || !Number.isInteger(end) || end < start || end >= points.length) {
    return { status: 'none' }
  }
  const line = simplifyPoints(points.slice(start, end + 1))
  return {
    status: 'ok',
    distanceM: Math.round(segment.distance),
    durationS: Math.round(segment.duration),
    polyline: encodePolyline(line),
  }
}

/**
 * Calcule les tronçons A → B → C… dans le mode `mode` ('car', 'walk', 'bike').
 * Rend `{ status, body }` : `body.legs[i]` est le tronçon i →  i+1,
 * `{ status: 'ok', distanceM, durationS, polyline }` ou `{ status: 'none' }`.
 *
 * Si la course entière échoue (un seul point sans route suffit), chaque
 * tronçon est redemandé seul : les autres ne doivent pas en pâtir.
 */
export async function computeRun(mode, pointsText, { key = process.env.ORS_API_KEY, fetchImpl = fetch } = {}) {
  if (!LEG_MODE_IDS.includes(mode)) return { status: 400, body: { error: 'bad-mode' } }
  const points = parsePoints(pointsText)
  if (!points) return { status: 400, body: { error: 'bad-points' } }
  if (!key) return { status: 503, body: { error: 'no-key' } }

  const profile = getLegMode(mode).profile
  const ctx = { key, fetchImpl }
  try {
    const route = await directions(profile, points, ctx)
    if (route) {
      return { status: 200, body: { legs: points.slice(1).map((_, i) => legFromRoute(route, i)) } }
    }
    if (points.length === 2) return { status: 200, body: { legs: [{ status: 'none' }] } }
    const legs = []
    for (let i = 0; i < points.length - 1; i++) {
      const single = await directions(profile, [points[i], points[i + 1]], ctx)
      legs.push(single ? legFromRoute(single, 0) : { status: 'none' })
    }
    return { status: 200, body: { legs } }
  } catch (err) {
    if (err instanceof OrsError) return { status: err.status, body: { error: err.code } }
    return { status: 502, body: { error: 'upstream-unavailable' } }
  }
}
