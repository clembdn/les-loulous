// FinAuzi — les fenêtres de temps du tableau de bord.
//
// Un seul sélecteur pilote tout l'écran : la courbe, les totaux (revenus /
// dépenses / net) et la répartition des dépenses. Avoir une durée pour le
// graphe et un « ce mois-ci » figé en dessous faisait lire deux périodes
// différentes sur la même page.
//
// Deux façons de décrire la même plage, parce que les deux lectures n'ont pas
// les mêmes besoins :
//   mode / pastMonths  — pour la courbe, en mois glissants
//   getRangePeriod()   — pour les totaux, en MOIS CIVILS entiers : un budget
//                        se lit du 1er au 31, pas sur les 30 derniers jours.

import { startOfMonth, endOfMonth, addMonths } from '../utils/forecast.js'

export const RANGES = [
  { id: '1M',  label: '1M',        periodLabel: 'Ce mois-ci',        mode: 'past',   pastMonths: 1,  months: 1 },
  { id: '3M',  label: '3M',        periodLabel: '3 derniers mois',   mode: 'past',   pastMonths: 3,  months: 3 },
  { id: '6M',  label: '6M',        periodLabel: '6 derniers mois',   mode: 'past',   pastMonths: 6,  months: 6 },
  { id: '1A',  label: '1A',        periodLabel: '12 derniers mois',  mode: 'past',   pastMonths: 12, months: 12 },
  { id: 'ALL', label: 'Tout',      periodLabel: 'Depuis le début',   mode: 'all' },
  { id: 'FWD', label: 'Prévision', periodLabel: '12 prochains mois', mode: 'future' },
]

export const DEFAULT_RANGE_ID = '6M'

export function getRangeById(id) {
  return RANGES.find((r) => r.id === id) || RANGES.find((r) => r.id === DEFAULT_RANGE_ID)
}

// Plage de dates couverte par une durée, en mois civils.
//
// `transactions` ne sert qu'au mode « Tout » : on remonte à la première
// transaction saisie plutôt qu'à une profondeur arbitraire, sinon « Tout »
// mentirait dès que l'historique dépasse la fenêtre choisie.
export function getRangePeriod(rangeId, { transactions = [], refDate = new Date() } = {}) {
  const range = getRangeById(rangeId)

  if (range.mode === 'future') {
    return {
      from: startOfMonth(addMonths(refDate, 1)),
      to: endOfMonth(addMonths(refDate, 12)),
      isForecast: true,
    }
  }

  const to = endOfMonth(refDate)

  if (range.mode === 'all') {
    return { from: startOfMonth(getEarliestDate(transactions, refDate)), to, isForecast: false }
  }

  return { from: startOfMonth(addMonths(refDate, -(range.months - 1))), to, isForecast: false }
}

function getEarliestDate(transactions, fallback) {
  let earliest = null
  for (const tx of transactions) {
    if (tx.isActive === false || !tx.date) continue
    const date = tx.date instanceof Date ? tx.date : new Date(tx.date)
    if (Number.isNaN(date.getTime())) continue
    if (!earliest || date < earliest) earliest = date
  }
  return earliest || fallback
}
