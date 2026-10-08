// Trajets calculés : l'appel à notre fonction api/route.js (qui garde la
// clé OpenRouteService). Les réponses sont gardée un mois par le CDN.

/**
 * Calcule une course (cf. `legRuns`, utils/legs.js). Rend
 * `[[clé du trajet, { status, distanceM, durationS, polyline }], …]`.
 * Une erreur `fatal` (pas de clé, clé refusée) ne sert à rien d'être retentée.
 */
export async function fetchRun(run) {
  const points = run.points.map((p) => `${p.lat},${p.lng}`).join(';')
  const res = await fetch(`/api/route?${new URLSearchParams({ mode: run.mode, points })}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.error || `http-${res.status}`)
    err.fatal = res.status === 503 || res.status === 400
    throw err
  }
  return run.legs.map((leg, i) => [leg.key, body.legs?.[i] || { status: 'none' }])
}

// Les matrices déjà reçues, le temps de la session : rouvrir l'optimisation
// d'une journée qui n'a pas changé ne rappelle pas le réseau.
const matrices = new Map()

/**
 * Temps et distances entre tous les lieux `places` (`{ lat, lng }`), à pied
 * et en voiture (cf. api/matrix.js) : `{ walk, car }`, ou une erreur.
 */
export async function fetchMatrix(places) {
  const points = places.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')
  if (matrices.has(points)) return matrices.get(points)
  const res = await fetch(`/api/matrix?${new URLSearchParams({ points })}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.walk || !body.car) throw new Error(body.error || `http-${res.status}`)
  matrices.set(points, body)
  return body
}
