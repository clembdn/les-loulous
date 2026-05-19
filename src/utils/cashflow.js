// FinAuzi — Cashflow engine.
// All amounts in EUR. Pure functions, no side effects.

const WEEKLY_TO_MONTHLY = 52 / 12
const DAY_MS = 86400000

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(d) {
  return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
}

export function getEffectiveMonthlyAmount(tx) {
  const amount = Number(tx.amountEUR) || 0
  if (tx.recurrence === 'weekly') return amount * WEEKLY_TO_MONTHLY
  return amount
}

function isRecurringActiveInMonth(tx, year, month) {
  if (!tx.isActive) return false
  if (tx.recurrence !== 'monthly' && tx.recurrence !== 'weekly') return false
  const start = new Date(tx.date)
  const startY = start.getFullYear()
  const startM = start.getMonth()
  if (year < startY || (year === startY && month < startM)) return false
  if (tx.endDate) {
    const end = new Date(tx.endDate)
    const endY = end.getFullYear()
    const endM = end.getMonth()
    if (year > endY || (year === endY && month > endM)) return false
  }
  return true
}

function isOneOffInMonth(tx, year, month) {
  if (!tx.isActive) return false
  if (tx.recurrence !== 'one-off') return false
  const d = new Date(tx.date)
  return d.getFullYear() === year && d.getMonth() === month
}

// Balance at a given date, computed from initialCapital + all past transactions.
export function getBalanceAt(transactions, initialCapital, atDate) {
  let balance = Number(initialCapital) || 0
  const at = atDate.getTime()

  for (const tx of transactions) {
    if (!tx.isActive) continue
    const amount = Number(tx.amountEUR) || 0
    const sign = tx.type === 'income' ? 1 : -1
    const start = new Date(tx.date)

    if (tx.recurrence === 'one-off') {
      if (start.getTime() <= at) balance += sign * amount
      continue
    }

    if (tx.recurrence === 'monthly' || tx.recurrence === 'weekly') {
      const end = tx.endDate ? new Date(tx.endDate) : null
      const limit = end && end.getTime() < at ? end : atDate
      if (limit.getTime() < start.getTime()) continue

      if (tx.recurrence === 'monthly') {
        const months = (limit.getFullYear() - start.getFullYear()) * 12
          + (limit.getMonth() - start.getMonth()) + 1
        if (months > 0) balance += sign * amount * months
      } else {
        const weeks = Math.floor((limit.getTime() - start.getTime()) / (7 * DAY_MS)) + 1
        if (weeks > 0) balance += sign * amount * weeks
      }
    }
  }
  return Math.round(balance)
}

export function getCurrentBalance(transactions, initialCapital) {
  return getBalanceAt(transactions, initialCapital, new Date())
}

// Spending per person for one month (expenses only). Returns { [personUid]: amount }.
export function getMonthSpendingByPerson(transactions, refDate = new Date()) {
  const year = refDate.getFullYear()
  const month = refDate.getMonth()
  const byPerson = {}

  for (const tx of transactions) {
    if (!tx.isActive) continue
    if (tx.type !== 'expense') continue
    const uid = tx.personUid
    if (!uid) continue

    let amount = 0
    if (isRecurringActiveInMonth(tx, year, month)) {
      amount = getEffectiveMonthlyAmount(tx)
    } else if (isOneOffInMonth(tx, year, month)) {
      amount = Number(tx.amountEUR) || 0
    }
    if (amount > 0) byPerson[uid] = (byPerson[uid] || 0) + amount
  }
  return byPerson
}

// Spending per category for one month (expenses only). Returns { [categoryId]: amount }.
export function getMonthSpendingByCategory(transactions, refDate = new Date()) {
  const year = refDate.getFullYear()
  const month = refDate.getMonth()
  const byCat = {}

  for (const tx of transactions) {
    if (!tx.isActive) continue
    if (tx.type !== 'expense') continue
    const categoryId = tx.category || 'other-expense'

    let amount = 0
    if (isRecurringActiveInMonth(tx, year, month)) {
      amount = getEffectiveMonthlyAmount(tx)
    } else if (isOneOffInMonth(tx, year, month)) {
      amount = Number(tx.amountEUR) || 0
    }

    if (amount > 0) byCat[categoryId] = (byCat[categoryId] || 0) + amount
  }
  return byCat
}

// Summary for one month — used by QuickStats.
export function getMonthSummary(transactions, refDate = new Date()) {
  const year = refDate.getFullYear()
  const month = refDate.getMonth()
  let monthlyIncome = 0
  let monthlyExpenses = 0
  let oneOffIncome = 0
  let oneOffExpenses = 0

  for (const tx of transactions) {
    if (!tx.isActive) continue
    if (isRecurringActiveInMonth(tx, year, month)) {
      const amt = getEffectiveMonthlyAmount(tx)
      if (tx.type === 'income') monthlyIncome += amt
      else monthlyExpenses += amt
    } else if (isOneOffInMonth(tx, year, month)) {
      const amt = Number(tx.amountEUR) || 0
      if (tx.type === 'income') oneOffIncome += amt
      else oneOffExpenses += amt
    }
  }

  const totalIncome = monthlyIncome + oneOffIncome
  const totalExpenses = monthlyExpenses + oneOffExpenses
  return {
    monthlyIncome,
    monthlyExpenses,
    oneOffIncome,
    oneOffExpenses,
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
  }
}

// 12-month forward forecast (used for the "Prévision" range).
export function buildForecast(transactions, startBalance, monthCount = 12, baseDate = new Date()) {
  const base = startOfMonth(baseDate)
  const data = []
  let balance = Number(startBalance) || 0

  for (let i = 0; i < monthCount; i++) {
    const d = addMonths(base, i)
    const year = d.getFullYear()
    const month = d.getMonth()
    let income = 0
    let expenses = 0
    let oneOffNet = 0

    for (const tx of transactions) {
      if (!tx.isActive) continue
      if (isRecurringActiveInMonth(tx, year, month)) {
        const amt = getEffectiveMonthlyAmount(tx)
        if (tx.type === 'income') income += amt
        else expenses += amt
      } else if (isOneOffInMonth(tx, year, month)) {
        const amt = Number(tx.amountEUR) || 0
        oneOffNet += tx.type === 'income' ? amt : -amt
      }
    }

    balance += income - expenses + oneOffNet
    data.push({
      date: d,
      timestamp: d.getTime(),
      key: monthKey(d),
      label: monthLabel(d),
      income,
      expenses,
      oneOffNet,
      balance: Math.round(balance),
      isFuture: true,
    })
  }
  return data
}

// Find the date of the oldest active transaction (for "TOUT" range).
function getOldestTransactionDate(transactions) {
  let oldest = null
  for (const tx of transactions) {
    if (!tx.isActive) continue
    const d = new Date(tx.date)
    if (!oldest || d < oldest) oldest = d
  }
  return oldest
}

// Build a balance time-series for the chart.
// mode = 'past' (monthly snapshots ending today)
//      | 'future' (12 months forward projection)
//      | 'all' (oldest tx → +12 future)
// pastMonths controls how many months to look back in 'past' mode.
export function buildBalanceSeries(transactions, initialCapital, { mode = 'past', pastMonths = 6 } = {}) {
  const now = new Date()
  const series = []

  if (mode === 'future') {
    const base = getCurrentBalance(transactions, initialCapital)
    series.push({
      date: now,
      timestamp: now.getTime(),
      label: 'Auj.',
      balance: base,
      isFuture: true,
    })
    const forecast = buildForecast(transactions, base, 12, addMonths(startOfMonth(now), 1))
    series.push(...forecast)
    return series
  }

  let startDate
  if (mode === 'all') {
    const oldest = getOldestTransactionDate(transactions)
    startDate = oldest ? startOfMonth(oldest) : addMonths(startOfMonth(now), -6)
  } else {
    startDate = addMonths(startOfMonth(now), -pastMonths)
  }

  // Anchor point at startDate (balance at end of that month, or at startDate if it's the past)
  const anchor = startDate < now ? endOfMonth(startDate) : startDate
  series.push({
    date: startDate,
    timestamp: startDate.getTime(),
    label: monthLabel(startDate),
    balance: getBalanceAt(transactions, initialCapital, anchor),
    isFuture: false,
  })

  // Monthly snapshots up to today
  let cursor = addMonths(startDate, 1)
  while (cursor < now) {
    const snapDate = endOfMonth(cursor) < now ? endOfMonth(cursor) : now
    series.push({
      date: cursor,
      timestamp: cursor.getTime(),
      label: monthLabel(cursor),
      balance: getBalanceAt(transactions, initialCapital, snapDate),
      isFuture: false,
    })
    cursor = addMonths(cursor, 1)
  }

  // Today as the final point
  series.push({
    date: now,
    timestamp: now.getTime(),
    label: 'Auj.',
    balance: getCurrentBalance(transactions, initialCapital),
    isFuture: false,
  })
  return series
}

// Helpers exposed for the UI ---

export function formatDateShort(d) {
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatMonthLong(d) {
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}
