// GET /api/resolve-maps?url=<lien Google Maps>
//
// Fonction Vercel (runtime Node, gratuite au volume de deux personnes) qui
// déroule les liens courts `maps.app.goo.gl` — illisibles depuis le
// navigateur. Toute la logique est dans `_lib/mapsResolver.js` ; ici, rien
// que l'adaptation HTTP. Signature Node `(req, res)` sans aides propres à
// Vercel : le même fichier est servi en dev par le plugin de vite.config.js.

import { resolveMapsLink } from './_lib/mapsResolver.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('allow', 'GET')
    res.end()
    return
  }

  const target = new URL(req.url, 'http://localhost').searchParams.get('url')
  let result
  try {
    result = await resolveMapsLink(target)
  } catch {
    result = { status: 502, body: { error: 'upstream-unavailable' } }
  }

  res.statusCode = result.status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  // Un même lien mène toujours au même lieu : le CDN garde la réponse un
  // jour, et la resservira à l'autre téléphone sans rappeler Google.
  res.setHeader('cache-control', result.status === 200
    ? 'public, s-maxage=86400, stale-while-revalidate=604800'
    : 'no-store')
  res.end(JSON.stringify(result.body))
}
