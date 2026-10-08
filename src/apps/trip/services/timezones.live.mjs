// node src/apps/trip/services/timezones.live.mjs
//
// Les fuseaux contre le VRAI Open-Meteo, à lancer à la main après toute
// modification de timezones.js (cf. api/_lib/ors.live.mjs). Hors du motif
// *.test.mjs : il lui faut Internet.

import { cachedTimezone, resolveTimezones } from './timezones.js'

// localStorage du navigateur, en mémoire.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
}

const CASES = [
  ['Lisbonne', { lat: 38.7105, lng: -9.144 }, 'Europe/Lisbon'],
  ['Ponta Delgada (Açores)', { lat: 37.7412, lng: -25.6756 }, 'Atlantic/Azores'],
  ['Funchal (Madère)', { lat: 32.6669, lng: -16.9241 }, 'Atlantic/Madeira'],
  ['Sydney', { lat: -33.8688, lng: 151.2093 }, 'Australia/Sydney'],
  ['Perth', { lat: -31.9523, lng: 115.8613 }, 'Australia/Perth'],
  ['Nouméa', { lat: -22.2758, lng: 166.458 }, 'Pacific/Noumea'],
]

const left = await resolveTimezones(CASES.map(([, p]) => p))
let failed = left ? 1 : 0
for (const [label, p, expected] of CASES) {
  const tz = cachedTimezone(p)
  if (tz !== expected) failed++
  console.log(tz === expected ? '✓' : '✗', label, tz, tz === expected ? '' : `(attendu ${expected})`)
}
// Un seul lieu : Open-Meteo rend un objet, pas une liste.
store.clear()
await resolveTimezones([{ lat: 41.1496, lng: -8.611 }])
const porto = cachedTimezone({ lat: 41.1496, lng: -8.611 })
if (porto !== 'Europe/Lisbon') failed++
console.log(porto === 'Europe/Lisbon' ? '✓' : '✗', 'un seul lieu (Porto)', porto)
process.exit(failed ? 1 : 0)
