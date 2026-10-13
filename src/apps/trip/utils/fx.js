// Les prix en euros, pour lire le budget sans convertir de tête.
//
// Un repère, jamais stocké : le prix d'origine fait foi (c'est lui qu'on
// paie), l'équivalent en euros se calcule à l'affichage au taux du jour
// (cf. services/fxService.js).
//
// Imports RELATIFS (pas d'alias `@/`) : ce module est testé sous `node --test`.

// Monnaies à parité FIXE avec l'euro, inconnues de la BCE : le franc
// Pacifique (Nouvelle-Calédonie, Polynésie) vaut 8,38 € les 1 000 F.
export const FX_PEGS = { XPF: 1000 / 8.38 }

const CURRENCY_RE = /^[A-Z]{3}$/

/**
 * Taux relus du stockage (ou de la BCE) : `{ date, rates }`, `rates` donnant
 * combien d'unités de chaque devise vaut 1 €. `null` si inutilisable.
 */
export function normalizeRates(raw) {
  if (!raw || typeof raw.rates !== 'object' || !raw.rates) return null
  const rates = {}
  for (const [code, value] of Object.entries(raw.rates)) {
    if (CURRENCY_RE.test(code) && Number.isFinite(value) && value > 0) rates[code] = value
  }
  return { date: typeof raw.date === 'string' ? raw.date : null, rates }
}

/** Combien d'unités de `currency` vaut 1 € ; `null` si on ne sait pas. */
export function eurRate(currency, rates) {
  if (!currency || currency === 'EUR') return 1
  if (FX_PEGS[currency]) return FX_PEGS[currency]
  return rates?.rates?.[currency] ?? null
}

/** Le montant en euros, au centime ; `null` sans taux ni montant. */
export function toEur(amount, currency, rates) {
  if (!Number.isFinite(amount)) return null
  const rate = eurRate(currency || 'EUR', rates)
  return rate ? Math.round((amount / rate) * 100) / 100 : null
}

/** Faut-il montrer l'équivalent en euros ? Seulement hors euro, et si on sait le calculer. */
export function showsEur(currency, rates) {
  return !!currency && currency !== 'EUR' && eurRate(currency, rates) != null
}

/**
 * Le total en euros de plusieurs montants `{ price, currency }` (ou
 * `{ total, currency }`). `missing` : combien n'ont pas pu être convertis.
 */
export function eurTotal(items, rates) {
  let total = 0
  let missing = 0
  for (const item of items) {
    const amount = item.price ?? item.total
    if (!Number.isFinite(amount)) continue
    const eur = toEur(amount, item.currency, rates)
    if (eur == null) missing++
    else total += eur
  }
  return { total: Math.round(total * 100) / 100, missing }
}
