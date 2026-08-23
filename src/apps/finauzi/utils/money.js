// FinAuzi — conversion de devises.
//
// Deux devises seulement : EUR (comptes persos) et AUD (compte joint).
// L'EUR est la devise canonique de référence pour tout ce qui doit être
// comparé entre comptes (apports, dettes, patrimoine total).

export const DEFAULT_EUR_TO_AUD = 1.65

export function normalizeRate(rate) {
  const r = Number(rate)
  return isFinite(r) && r > 0 ? r : DEFAULT_EUR_TO_AUD
}

export function convert(amount, from, to, eurToAud) {
  const value = Number(amount) || 0
  if (from === to) return value
  const rate = normalizeRate(eurToAud)
  if (from === 'EUR' && to === 'AUD') return value * rate
  if (from === 'AUD' && to === 'EUR') return value / rate
  return value
}

export function toEUR(amount, currency, eurToAud) {
  return convert(amount, currency === 'AUD' ? 'AUD' : 'EUR', 'EUR', eurToAud)
}

// Arrondi monétaire au centime — évite les 0.30000000000000004 en cascade.
export function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

// ─── Taux figé à la saisie ────────────────────────────────────────────────
// Une transaction née après l'ajout du champ `rate` porte le taux qui avait
// cours le jour où elle a eu lieu : son montant converti ne bouge plus
// jamais. Les lignes plus anciennes, elles, n'ont pas de taux propre et
// retombent sur le taux global des réglages — c'est le comportement d'avant,
// conservé pour ne pas réécrire l'historique existant.
export function txRate(tx, fallbackRate) {
  const r = Number(tx?.rate)
  return isFinite(r) && r > 0 ? r : normalizeRate(fallbackRate)
}
