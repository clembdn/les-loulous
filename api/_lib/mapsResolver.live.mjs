// node api/_lib/mapsResolver.live.mjs
//
// Le résolveur contre le VRAI Google Maps, à lancer à la main après toute
// modification de mapsResolver.js, mapsUrl.js ou ftid.js : les tests
// `node --test` simulent le réseau, et ne voient donc pas Google changer ses
// pages (c'est ainsi que tous les lieux ont atterri près de Washington :
// le test simulait une page qui n'existe pas).
//
// Volontairement hors du motif *.test.mjs : il lui faut Internet.
// Liens courts publics trouvés sur GitHub ; coordonnées exactes selon Google.

import { resolveMapsLink } from './mapsResolver.js'
import { haversineM } from '../../src/apps/trip/utils/geo.js'

const CASES = [
  // Partage Android : redirige vers /maps/place/<adresse>/data=…!1s<ftid>, sans coordonnées.
  ['partage Android (ftid seul)', 'https://maps.app.goo.gl/3H4T2CQN8PfLSBbt6', -25.384152, 28.2720638],
  ['lien court, place + @', 'https://maps.app.goo.gl/apPpRtV9mj14K5JS8', 45.507348, -73.560264],
  ['lien court, adresse', 'https://maps.app.goo.gl/3hWxRhEpYAC6wH3i9', 50.068677, 14.4246229],
  ['lien court, point nu', 'https://maps.app.goo.gl/3UofRQcmJy12LZc37', 16.064556, 108.231402],
  ['lien long, ftid sans nom', 'https://www.google.com/maps/place/data=!4m2!3m1!1s0xd1ecb452efd715b:0xffeff6c6b46d9665', 38.6975105, -9.2032276],
  ['lien long, q + ftid', 'https://maps.google.com/maps?q=Tour+Eiffel&ftid=0x47e66e2964e34e2d:0x8ddca9ee380ef7e0&entry=gps', 48.8583701, 2.2944813],
  ['lien long, q + ftid', 'https://maps.google.com/?q=Praia+do+Camilo&ftid=0xd1b31dd791d72a7:0x65cce4d0d6f8a4', 37.0873925, -8.6684868],
]
const TOLERANCE_M = 300

let failed = 0
const seen = new Map()
for (const [label, url, lat, lng] of CASES) {
  const { status, body } = await resolveMapsLink(url)
  const located = status === 200 && Number.isFinite(body.lat)
  const gap = located ? haversineM(body, { lat, lng }) : Infinity
  const key = located ? `${body.lat.toFixed(3)},${body.lng.toFixed(3)}` : null
  const duplicate = key && seen.has(key)
  const ok = gap <= TOLERANCE_M && !duplicate
  if (!ok) failed += 1
  if (key) seen.set(key, label)
  console.log(
    `${ok ? '✓' : '✗'} ${label.padEnd(28)} ${String(status).padEnd(4)}`,
    located ? `${Math.round(gap)} m${body.approximate ? ' (approximatif)' : ''}` : body.error,
    duplicate ? `— MÊME POINT que « ${seen.get(key)} »` : '',
    body.name ? `· ${body.name}` : '',
  )
}
console.log(failed ? `\n${failed} échec(s)` : '\nTout est au bon endroit.')
process.exit(failed ? 1 : 0)
