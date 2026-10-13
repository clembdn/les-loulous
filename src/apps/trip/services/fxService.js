// Les taux de change du jour, pour l'équivalent en euros des prix
// (cf. utils/fx.js). Demandés à Frankfurter (taux de référence de la BCE,
// sans clé), au plus deux fois par jour, et gardés sur l'appareil : hors-ligne,
// on garde les derniers connus. Donnée dérivée, propre à l'appareil — jamais
// dans Firestore.

import { normalizeRates } from '../utils/fx.js'

const KEY = 'trip:fxRates'
export const FX_URL = 'https://api.frankfurter.dev/v1/latest?base=EUR'
const MAX_AGE_MS = 12 * 3600 * 1000

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    const rates = normalizeRates(raw)
    return rates ? { ...rates, fetchedAt: Number(raw.fetchedAt) || 0 } : null
  } catch {
    return null
  }
}

function save(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // Stockage plein ou navigation privée : on redemandera.
  }
}

let current
const listeners = new Set()
let inFlight = null

/** Les taux connus (`{ date, rates, fetchedAt }`), ou `null`. */
export function getRates() {
  if (current === undefined) current = load()
  return current
}

export function subscribeRates(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Va chercher les taux du jour s'ils sont trop vieux. Ne rejette jamais. */
export function refreshRates({ fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  const known = getRates()
  if (known && now - known.fetchedAt < MAX_AGE_MS) return Promise.resolve(known)
  if (inFlight) return inFlight
  inFlight = fetchImpl(FX_URL)
    .then((res) => (res.ok ? res.json() : null))
    .then((raw) => {
      const rates = normalizeRates(raw)
      if (!rates || !Object.keys(rates.rates).length) return known
      current = { ...rates, fetchedAt: now }
      save(current)
      listeners.forEach((l) => l())
      return current
    })
    .catch(() => known)
    .finally(() => { inFlight = null })
  return inFlight
}
