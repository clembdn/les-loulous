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
