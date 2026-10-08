// GET /api/route?mode=car&points=lat,lng;lat,lng;…
//
// Fonction Vercel : le trajet calculé (voiture, marche, vélo) entre les lieux
// d'une journée, par OpenRouteService. Toute la logique est dans
// `_lib/ors.js` ; ici, rien que l'adaptation HTTP (même signature Node que
// resolve-maps.js, servie en dev par vite.config.js).

import { computeRun } from './_lib/ors.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('allow', 'GET')
    res.end()
    return
  }

  const params = new URL(req.url, 'http://localhost').searchParams
  const result = await computeRun(params.get('mode'), params.get('points'))

  res.statusCode = result.status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  // Mêmes points, même route : le CDN garde la réponse un mois, et la
  // resservira à l'autre téléphone sans rappeler OpenRouteService.
  res.setHeader('cache-control', result.status === 200
    ? 'public, s-maxage=2592000, stale-while-revalidate=2592000'
    : 'no-store')
  res.end(JSON.stringify(result.body))
}
