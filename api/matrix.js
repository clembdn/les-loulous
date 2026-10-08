// GET /api/matrix?points=lat,lng;lat,lng;…
//
// Fonction Vercel : les temps de trajet entre tous les lieux d'une journée,
// à pied et en voiture (OpenRouteService), pour en optimiser l'ordre. Toute
// la logique est dans `_lib/ors.js`.

import { computeMatrix } from './_lib/ors.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('allow', 'GET')
    res.end()
    return
  }

  const params = new URL(req.url, 'http://localhost').searchParams
  const result = await computeMatrix(params.get('points'))

  res.statusCode = result.status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  // Mêmes lieux, mêmes temps : le CDN garde la réponse un mois.
  res.setHeader('cache-control', result.status === 200
    ? 'public, s-maxage=2592000, stale-while-revalidate=2592000'
    : 'no-store')
  res.end(JSON.stringify(result.body))
}
