// FinAuzi — génération des occurrences d'une transaction récurrente.
//
// Le moteur ne fait plus d'approximation type « hebdo × 52/12 » : chaque
// échéance est datée pour de vrai. C'est ce qui permet de dire « le compte
// joint passe sous le seuil le 14 novembre » et pas « vers mi-novembre ».
//
// `fortnightly` (toutes les 2 semaines) est le standard australien pour les
// loyers et les salaires — d'où sa présence à côté de weekly/monthly.

const DAY_MS = 86400000

export const RECURRENCES = [
  { id: 'one-off', label: 'Ponctuelle', short: 'Ponct.' },
  { id: 'weekly', label: 'Hebdo', short: 'Hebdo', perYear: 52 },
  { id: 'fortnightly', label: '2 semaines', short: '2 sem.', perYear: 26 },
  { id: 'monthly', label: 'Mensuelle', short: 'Mensuel', perYear: 12 },
]

export const RECURRENCE_IDS = RECURRENCES.map((r) => r.id)
export const RECURRENCES_BY_ID = Object.fromEntries(RECURRENCES.map((r) => [r.id, r]))

export function isValidRecurrence(id) {
  return RECURRENCE_IDS.includes(id)
}

export function normalizeRecurrence(id) {
  return isValidRecurrence(id) ? id : 'one-off'
}

export function isRecurring(tx) {
  return tx.recurrence && tx.recurrence !== 'one-off'
}

export function getRecurrenceLabel(id) {
  return RECURRENCES_BY_ID[id]?.short || null
}

function parseDate(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// Ajoute n mois en gardant le jour du mois quand c'est possible.
// Le 31 janvier + 1 mois → 28/29 février, puis on retrouve le 31 en mars.
function addMonthsClamped(anchor, n) {
  const target = new Date(anchor.getFullYear(), anchor.getMonth() + n, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(anchor.getDate(), lastDay))
}

// Toutes les dates d'échéance de `tx` dans [from, to] (bornes incluses).
// Retourne un tableau vide si la transaction est inactive ou hors fenêtre.
export function getOccurrences(tx, from, to) {
  if (!tx || tx.isActive === false) return []

  const start = parseDate(tx.date)
  if (!start) return []

  const windowStart = parseDate(from)
  const windowEnd = parseDate(to)
  if (!windowStart || !windowEnd || windowEnd < windowStart) return []

  const txEnd = parseDate(tx.endDate)
  const last = txEnd && txEnd < windowEnd ? txEnd : windowEnd
  if (last < start) return []

  const recurrence = normalizeRecurrence(tx.recurrence)

  if (recurrence === 'one-off') {
    return start >= windowStart && start <= last ? [start] : []
  }

  const dates = []

  if (recurrence === 'weekly' || recurrence === 'fortnightly') {
    const stepDays = recurrence === 'weekly' ? 7 : 14
    // Saut direct à la première échéance dans la fenêtre — pas d'itération
    // depuis la date de début, qui peut être des années en arrière.
    let index = 0
    if (start < windowStart) {
      index = Math.ceil((windowStart.getTime() - start.getTime()) / (stepDays * DAY_MS))
    }
    for (;;) {
      const d = new Date(start.getTime() + index * stepDays * DAY_MS)
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      if (day > last) break
      dates.push(day)
      index += 1
    }
    return dates
  }

  // monthly
  let index = 0
  if (start < windowStart) {
    const months = (windowStart.getFullYear() - start.getFullYear()) * 12
      + (windowStart.getMonth() - start.getMonth())
    index = Math.max(months - 1, 0)
  }
  for (;;) {
    const d = addMonthsClamped(start, index)
    if (d > last) break
    if (d >= windowStart) dates.push(d)
    index += 1
    // Garde-fou : une fenêtre raisonnable ne dépasse jamais quelques siècles.
    if (index > 12000) break
  }
  return dates
}

// Nombre d'échéances dans [from, to] sans matérialiser le tableau.
// Montant ramené au mois — pour comparer des charges de fréquences
// différentes (le loyer hebdo face à l'abonnement mensuel).
export function getMonthlyEquivalent(tx) {
  const amount = Number(tx.amount) || 0
  const perYear = RECURRENCES_BY_ID[normalizeRecurrence(tx.recurrence)]?.perYear
  if (!perYear) return 0
  return (amount * perYear) / 12
}
