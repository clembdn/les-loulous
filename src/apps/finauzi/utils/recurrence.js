// FinAuzi — génération des occurrences d'une transaction récurrente.
//
// Le moteur ne fait plus d'approximation type « hebdo × 52/12 » : chaque
// échéance est datée pour de vrai. C'est ce qui permet de dire « le compte
// joint passe sous le seuil le 14 novembre » et pas « vers mi-novembre ».
//
// `fortnightly` (toutes les 2 semaines) est le standard australien pour les
// loyers et les salaires — d'où sa présence à côté de weekly/monthly.

// Sert UNIQUEMENT à estimer un point de départ d'itération, jamais à dater une
// échéance : une journée locale ne dure pas toujours 24 h (cf. `addDaysLocal`).
const MS_PER_DAY = 86400000

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

// Une clé « AAAA-MM-JJ » est relue en heure LOCALE, jamais en UTC.
//
// C'est la règle absolue de `@/shared/lib/dates.js`, et ce fichier l'enfreignait
// : `new Date("2026-01-31")` est interprété comme minuit UTC par la spec JS, ce
// qui donne le 30 janvier dès qu'on est à l'ouest de Greenwich. Depuis
// l'Australie l'erreur ne se voyait pas — l'heure locale est en avance, on
// retombait sur le bon jour — mais le moteur d'échéances entier était faux d'un
// jour pour qui ouvre l'app depuis les Amériques.
//
// La règle n'est pas importée d'ici : ce module est le moteur de dates de
// FinAuzi et doit rester sans dépendance, pour que `recurrence.test.mjs` puisse
// le passer au banc dans plusieurs fuseaux sans monter d'alias.
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function parseDate(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  if (!value) return null

  const key = typeof value === 'string' ? value.trim().match(DATE_KEY_RE) : null
  if (key) return new Date(+key[1], +key[2] - 1, +key[3])

  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// Ajoute n jours CALENDAIRES, pas n × 24 h.
//
// L'arithmétique en millisecondes (`start.getTime() + n * 86400000`) dérive au
// changement d'heure : après le retour à l'heure d'hiver, une journée locale
// dure 25 h, la date construite retombe à 23 h la veille et se normalise sur le
// JOUR PRÉCÉDENT. Une quinzaine ancrée un dimanche devenait un samedi d'avril à
// octobre à Sydney, puis redevenait un dimanche — un loyer déplacé d'un jour la
// moitié de l'année, et une échéance du 1er comptée dans le mois d'avant.
//
// Le constructeur `Date(y, m, d + n)` reporte les débordements sur le mois et
// l'année, et pose toujours minuit LOCAL, quel que soit le fuseau du jour.
function addDaysLocal(anchor, n) {
  return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + n)
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
    // Saut direct près de la première échéance dans la fenêtre — pas
    // d'itération depuis la date de début, qui peut être des années en arrière.
    //
    // L'estimation se fait en millisecondes et peut donc tomber un cran trop
    // loin quand un changement d'heure s'est glissé dans l'intervalle : on
    // recule d'un pas et c'est le `d >= windowStart` de la boucle qui tranche,
    // comme dans la branche mensuelle juste en dessous.
    let index = 0
    if (start < windowStart) {
      const estimate = Math.floor(
        (windowStart.getTime() - start.getTime()) / (stepDays * MS_PER_DAY),
      )
      index = Math.max(estimate - 1, 0)
    }
    for (;;) {
      const day = addDaysLocal(start, index * stepDays)
      if (day > last) break
      if (day >= windowStart) dates.push(day)
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

// Montant ramené au mois — pour comparer des charges de fréquences
// différentes (le loyer hebdo face à l'abonnement mensuel).
export function getMonthlyEquivalent(tx) {
  const amount = Number(tx.amount) || 0
  const perYear = RECURRENCES_BY_ID[normalizeRecurrence(tx.recurrence)]?.perYear
  if (!perYear) return 0
  return (amount * perYear) / 12
}
