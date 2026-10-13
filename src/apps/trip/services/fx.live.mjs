// node src/apps/trip/services/fx.live.mjs
//
// Les taux contre la VRAIE API Frankfurter (BCE), à lancer à la main après
// toute modification de fxService.js. Hors du motif *.test.mjs : il lui faut
// Internet.

import { CURRENCIES } from '../config/reservations.js'
import { FX_PEGS, toEur } from '../utils/fx.js'
import { refreshRates } from './fxService.js'

// localStorage du navigateur, en mémoire.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
}

let failed = 0
const rates = await refreshRates()
if (!rates?.date) {
  console.log('✗ pas de taux')
  process.exit(1)
}
console.log(`✓ taux BCE du ${rates.date}`)
for (const code of CURRENCIES) {
  if (code === 'EUR') continue
  const eur = toEur(100000, code, rates)
  const ok = eur != null && eur > 0
  if (!ok) failed++
  console.log(ok ? '✓' : '✗', `100 000 ${code} ≈ ${eur} €${FX_PEGS[code] ? ' (parité fixe)' : ''}`)
}
// Bornes larges : un AUD vaut entre 0,4 et 0,9 €.
const aud = toEur(1, 'AUD', rates)
if (!(aud > 0.4 && aud < 0.9)) failed++
console.log(aud > 0.4 && aud < 0.9 ? '✓' : '✗', `1 AUD ≈ ${aud} €`)
// Taux encore frais : pas de 2e requête.
const again = await refreshRates({ fetchImpl: () => { throw new Error('requête de trop') } })
if (again !== rates) failed++
console.log(again === rates ? '✓' : '✗', 'gardés sur l’appareil')
process.exit(failed ? 1 : 0)
