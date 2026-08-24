// FinAuzi — façade du moteur financier.
//
// Le calcul vit dans des modules dédiés :
//   ledger.js     — soldes et agrégats par compte
//   settlement.js — apports au pot commun et dettes croisées
//   forecast.js   — projections, autonomie du compte, réappro
//   recurrence.js — échéances réelles des transactions récurrentes
//
// Ce fichier ne garde que les helpers partagés (dates, départ) et des
// raccourcis « ce mois-ci » pour les écrans qui n'ont pas besoin de plus.

import { startOfMonth, endOfMonth } from './forecast.js'
import { getSpendingByCategory } from './ledger.js'

const DAY_MS = 86400000

export { startOfMonth, endOfMonth, addMonths } from './forecast.js'

// ─── Raccourcis « mois courant » ──────────────────────────────────────────

export function getMonthRange(refDate = new Date()) {
  return { from: startOfMonth(refDate), to: endOfMonth(refDate) }
}

export function getMonthSpendingByCategory(transactions, { rate, accountId = null, currency = 'EUR', refDate = new Date() } = {}) {
  const { from, to } = getMonthRange(refDate)
  return getSpendingByCategory(transactions, { accountId, from, to, rate, currency })
}

// ─── Formatage ────────────────────────────────────────────────────────────

export function formatDateShort(d) {
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatMonthLong(d) {
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

// ─── Départ ───────────────────────────────────────────────────────────────

// Jours entiers d'ici au départ. Positif = il reste des jours,
// 0 = jour J, négatif = jours depuis l'arrivée.
export function getDaysToDeparture(departureDate, now = new Date()) {
  if (!departureDate) return null
  const dep = departureDate instanceof Date ? departureDate : new Date(departureDate)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDep = new Date(dep.getFullYear(), dep.getMonth(), dep.getDate())
  return Math.round((startOfDep.getTime() - startOfToday.getTime()) / DAY_MS)
}
