// node api/_lib/ors.live.mjs
//
// Les trajets contre le VRAI OpenRouteService, à lancer à la main après toute
// modification de ors.js ou de legs.js : les tests `node --test` simulent la
// réponse, et ne verraient pas ORS changer de format.
// La clé est lue dans ORS_API_KEY, ou dans le fichier .env à la racine.
// Volontairement hors du motif *.test.mjs : il lui faut Internet.

import { readFileSync } from 'node:fs'
import { computeRun } from './ors.js'
import { decodePolyline } from '../../src/apps/trip/utils/polyline.js'
import { haversineM } from '../../src/apps/trip/utils/geo.js'

function keyFromEnvFile() {
  try {
    const line = readFileSync(new URL('../../.env', import.meta.url), 'utf8')
      .split('\n').find((l) => l.startsWith('ORS_API_KEY='))
    return line?.slice('ORS_API_KEY='.length).trim().replace(/^["']|["']$/g, '') || ''
  } catch {
    return ''
  }
}

const key = process.env.ORS_API_KEY || keyFromEnvFile()
if (!key) {
  console.error('ORS_API_KEY absente (variable ou .env).')
  process.exit(1)
}

// Belém → Pastéis de Belém → Graça → Sintra, et un tronçon impossible (Lisbonne → Açores).
const BELEM = '38.6916,-9.2160'
const PASTEIS = '38.6975,-9.2032'
const GRACA = '38.7166,-9.1310'
const SINTRA = '38.7876,-9.3906'
const ACORES = '37.7412,-25.6756'

const CASES = [
  // [libellé, mode, points, tronçons attendus : [statut, distance mini, distance maxi]]
  ['à pied, deux tronçons en une course', 'walk', `${BELEM};${PASTEIS};${GRACA}`, [['ok', 1000, 2500], ['ok', 6000, 10000]]],
  ['en voiture vers Sintra', 'car', `${GRACA};${SINTRA}`, [['ok', 20000, 40000]]],
  ['à vélo', 'bike', `${BELEM};${PASTEIS}`, [['ok', 1000, 2500]]],
  ['une île au milieu : tronçon sans route, les autres calculés', 'car', `${BELEM};${GRACA};${ACORES}`, [['ok', 6000, 12000], ['none']]],
]

let failed = 0
for (const [label, mode, points, expected] of CASES) {
  const { status, body } = await computeRun(mode, points, { key })
  const legs = body.legs || []
  const problems = []
  if (status !== 200) problems.push(`HTTP ${status} ${JSON.stringify(body)}`)
  expected.forEach(([st, min, max], i) => {
    const leg = legs[i]
    if (leg?.status !== st) return problems.push(`tronçon ${i} : ${leg?.status} au lieu de ${st}`)
    if (st !== 'ok') return
    if (leg.distanceM < min || leg.distanceM > max) problems.push(`tronçon ${i} : ${leg.distanceM} m hors de [${min}, ${max}]`)
    const line = decodePolyline(leg.polyline)
    const [from, to] = [points.split(';')[i], points.split(';')[i + 1]].map((p) => {
      const [lat, lng] = p.split(',').map(Number)
      return { lat, lng }
    })
    const start = { lat: line[0][0], lng: line[0][1] }
    const end = { lat: line.at(-1)[0], lng: line.at(-1)[1] }
    if (haversineM(start, from) > 1000 || haversineM(end, to) > 1000) problems.push(`tronçon ${i} : le tracé ne relie pas ses bouts`)
  })
  if (problems.length) failed++
  console.log(problems.length ? '✗' : '✓', label, legs.map((l) => (l.status === 'ok' ? `${l.distanceM} m / ${Math.round(l.durationS / 60)} min / ${decodePolyline(l.polyline).length} pts` : l.status)).join(' · '))
  problems.forEach((p) => console.log('   ', p))
  // 40 requêtes par minute au plus.
  await new Promise((r) => setTimeout(r, 2000))
}
process.exit(failed ? 1 : 0)
