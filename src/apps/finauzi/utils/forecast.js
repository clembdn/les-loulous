// FinAuzi — projections par compte.
//
// La question utile n'est pas « combien vaut notre patrimoine agrégé », mais
// « le compte joint tient jusqu'à quand, et combien faut-il y remettre ? ».
// Tout ici est calculé compte par compte, dans la devise du compte, à partir
// des échéances réelles (pas d'un montant mensuel moyenné).

import { getAccountBalanceAt, getAccountDelta, expandOccurrences, touchesAccount } from './ledger.js'
import { RECURRENCES_BY_ID, normalizeRecurrence, isRecurring } from './recurrence.js'
import { round2 } from './money.js'

const DAY_MS = 86400000

function startOfDay(d) {
  const date = d instanceof Date ? d : new Date(d)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

export function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
}

export function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

function shortLabel(d) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function monthLabel(d) {
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

// Série de soldes pour le graphe, dans la devise du compte.
// On part du solde exact à `from`, puis on accumule les échéances une à une :
// une seule passe, et chaque point tombe sur une vraie date de mouvement.
export function buildAccountSeries(transactions, accountId, opening, { from, to, rate, maxPoints = 80, now = new Date() }) {
  const start = startOfDay(from)
  const end = startOfDay(to)
  const today = startOfDay(now)

  let balance = getAccountBalanceAt(transactions, accountId, opening, start, rate)

  const points = [{
    date: start,
    timestamp: start.getTime(),
    label: end - start > 400 * DAY_MS ? monthLabel(start) : shortLabel(start),
    balance: round2(balance),
    isFuture: start > today,
  }]

  const events = expandOccurrences(transactions, { accountId, from: addDays(start, 1), to: end })
  const useMonthLabels = end - start > 400 * DAY_MS

  let i = 0
  while (i < events.length) {
    const timestamp = events[i].timestamp
    // Tous les mouvements du même jour fusionnent en un seul point.
    while (i < events.length && events[i].timestamp === timestamp) {
      balance += getAccountDelta(events[i].tx, accountId, rate)
      i += 1
    }
    const date = new Date(timestamp)
    points.push({
      date,
      timestamp,
      label: useMonthLabels ? monthLabel(date) : shortLabel(date),
      balance: round2(balance),
      isFuture: date > today,
    })
  }

  // Point final à la borne droite pour que la courbe aille au bout.
  const last = points[points.length - 1]
  if (last.timestamp !== end.getTime()) {
    points.push({
      date: end,
      timestamp: end.getTime(),
      label: end.getTime() === today.getTime() ? 'Auj.' : (useMonthLabels ? monthLabel(end) : shortLabel(end)),
      balance: round2(balance),
      isFuture: end > today,
    })
  }

  return downsample(points, maxPoints)
}

// Réduit le nombre de points sans jamais bouger le premier ni le dernier —
// la courbe garde ses extrémités exactes.
function downsample(points, maxPoints) {
  if (points.length <= maxPoints) return points
  const step = (points.length - 1) / (maxPoints - 1)
  const out = []
  for (let i = 0; i < maxPoints - 1; i++) {
    out.push(points[Math.round(i * step)])
  }
  out.push(points[points.length - 1])
  return out
}

// Charge mensuelle nette d'un compte : ce qui tombe tous les mois, ramené au
// mois. Positif = le compte se remplit, négatif = il se vide.
export function getMonthlyNetFlow(transactions, accountId, rate, now = new Date()) {
  const today = startOfDay(now)
  let flow = 0
  for (const tx of transactions) {
    if (tx.isActive === false) continue
    if (!isRecurring(tx)) continue
    if (!touchesAccount(tx, accountId)) continue
    if (tx.endDate && startOfDay(tx.endDate) < today) continue
    const perYear = RECURRENCES_BY_ID[normalizeRecurrence(tx.recurrence)]?.perYear
    if (!perYear) continue
    flow += (getAccountDelta(tx, accountId, rate) * perYear) / 12
  }
  return flow
}

// Autonomie du compte : à quelle date il passe sous le seuil de sécurité,
// puis à quelle date il tombe à zéro.
export function getRunway(transactions, accountId, opening, { buffer = 0, rate, horizonMonths = 36, now = new Date() }) {
  const today = startOfDay(now)
  const horizon = addMonths(today, horizonMonths)
  const currentBalance = getAccountBalanceAt(transactions, accountId, opening, today, rate)

  const events = expandOccurrences(transactions, { accountId, from: addDays(today, 1), to: horizon })

  let balance = currentBalance
  let bufferDate = null
  let zeroDate = null
  let lowest = { balance: currentBalance, date: today }

  for (const event of events) {
    balance += getAccountDelta(event.tx, accountId, rate)
    if (balance < lowest.balance) lowest = { balance, date: event.date }
    if (bufferDate === null && balance < buffer) bufferDate = event.date
    if (zeroDate === null && balance < 0) zeroDate = event.date
    if (zeroDate !== null) break
  }

  const monthlyNetFlow = getMonthlyNetFlow(transactions, accountId, rate, now)

  return {
    currentBalance: round2(currentBalance),
    balanceAtHorizon: round2(balance),
    monthlyNetFlow: round2(monthlyNetFlow),
    buffer,
    bufferDate,
    zeroDate,
    lowest: { balance: round2(lowest.balance), date: lowest.date },
    // Jours restants avant de toucher le seuil. null = on ne l'atteint jamais
    // dans l'horizon considéré.
    daysToBuffer: bufferDate ? Math.round((startOfDay(bufferDate) - today) / DAY_MS) : null,
    daysToZero: zeroDate ? Math.round((startOfDay(zeroDate) - today) / DAY_MS) : null,
    isSustainable: bufferDate === null,
  }
}

// Combien faut-il remettre sur le compte pour tenir jusqu'à `until` sans
// jamais passer sous le seuil ? Et donc combien chacun doit virer.
export function getTopUpNeeded(transactions, accountId, opening, { buffer = 0, rate, until, now = new Date() }) {
  const today = startOfDay(now)
  const target = startOfDay(until)
  const currentBalance = getAccountBalanceAt(transactions, accountId, opening, today, rate)

  const events = expandOccurrences(transactions, { accountId, from: addDays(today, 1), to: target })

  let balance = currentBalance
  let lowest = currentBalance
  let lowestDate = today
  for (const event of events) {
    balance += getAccountDelta(event.tx, accountId, rate)
    if (balance < lowest) {
      lowest = balance
      lowestDate = event.date
    }
  }

  const shortfall = Math.max(buffer - lowest, 0)
  return {
    total: round2(shortfall),
    perPerson: round2(shortfall / 2),
    lowest: round2(lowest),
    lowestDate,
    balanceAtTarget: round2(balance),
    isNeeded: shortfall > 0,
  }
}

// Détail mois par mois d'un compte — le tableau « ce qui tombe quand ».
export function buildMonthlyBreakdown(transactions, accountId, opening, { rate, months = 12, now = new Date() }) {
  const base = startOfMonth(now)
  const rows = []
  let balance = getAccountBalanceAt(transactions, accountId, opening, endOfMonth(addMonths(base, -1)), rate)

  for (let i = 0; i < months; i++) {
    const monthStart = addMonths(base, i)
    const monthEnd = endOfMonth(monthStart)
    const events = expandOccurrences(transactions, { accountId, from: monthStart, to: monthEnd })

    let inflow = 0
    let outflow = 0
    for (const event of events) {
      const delta = getAccountDelta(event.tx, accountId, rate)
      if (delta >= 0) inflow += delta
      else outflow += -delta
    }

    balance += inflow - outflow
    rows.push({
      date: monthStart,
      key: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      label: monthStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      inflow: round2(inflow),
      outflow: round2(outflow),
      net: round2(inflow - outflow),
      balance: round2(balance),
      isFuture: monthStart > now,
    })
  }
  return rows
}
