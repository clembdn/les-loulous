// FinAuzi — Cashflow Forecasting Engine
// Pure utility functions. All amounts are in EUR.
// Display conversion is handled at the component level.

import { normalizeTransactionAllocation } from './transactionAllocation.js'

/**
 * Generate an array of the next N months starting from a base date.
 * Each entry: { year, month, label, key }
 */
export function generateNextMonths(count = 12, baseDate = new Date()) {
  const months = []
  for (let i = 0; i < count; i++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1)
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(), // 0-indexed
      label: d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    })
  }
  return months
}

/**
 * Check if a recurring transaction is active for a given month.
 */
export function isTransactionActiveForMonth(tx, year, month) {
  if (!tx.isActive) return false
  if (tx.recurrence !== 'monthly') return false

  const startDate = new Date(tx.date)
  const startYear = startDate.getFullYear()
  const startMonth = startDate.getMonth()

  // The forecast month must be >= start date month
  if (year < startYear || (year === startYear && month < startMonth)) return false

  // If endDate exists, the forecast month must be <= end date month
  if (tx.endDate) {
    const endDate = new Date(tx.endDate)
    const endYear = endDate.getFullYear()
    const endMonth = endDate.getMonth()
    if (year > endYear || (year === endYear && month > endMonth)) return false
  }

  return true
}

/**
 * Check if a one-off transaction falls in a specific month.
 */
export function isOneOffInMonth(tx, year, month) {
  if (tx.recurrence !== 'one-off') return false
  const d = new Date(tx.date)
  return d.getFullYear() === year && d.getMonth() === month
}

/**
 * Calculate the net monthly cashflow from all active recurring transactions.
 * Returns { totalIncome, totalExpenses, netCashflow }
 */
export function getMonthlyNetCashflow(transactions) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  let totalIncome = 0
  let totalExpenses = 0

  for (const tx of transactions) {
    if (tx.recurrence !== 'monthly') continue
    if (!isTransactionActiveForMonth(tx, year, month)) continue

    if (tx.type === 'income') {
      totalIncome += tx.amountEUR
    } else {
      totalExpenses += tx.amountEUR
    }
  }

  return {
    totalIncome,
    totalExpenses,
    netCashflow: totalIncome - totalExpenses,
  }
}

/**
 * Build a 12-month forecast projection.
 * Returns an array of monthly data points.
 */
export function getForecastData(transactions, initialCapital, monthCount = 12) {
  const months = generateNextMonths(monthCount)
  const data = []
  let balance = initialCapital

  for (const m of months) {
    let monthlyIncome = 0
    let monthlyExpenses = 0
    let oneOffIncome = 0
    let oneOffExpenses = 0

    for (const tx of transactions) {
      if (tx.recurrence === 'monthly') {
        if (isTransactionActiveForMonth(tx, m.year, m.month)) {
          if (tx.type === 'income') monthlyIncome += tx.amountEUR
          else monthlyExpenses += tx.amountEUR
        }
      } else if (tx.recurrence === 'one-off') {
        if (isOneOffInMonth(tx, m.year, m.month)) {
          if (tx.type === 'income') oneOffIncome += tx.amountEUR
          else oneOffExpenses += tx.amountEUR
        }
      }
    }

    const netRecurring = monthlyIncome - monthlyExpenses
    const netOneOff = oneOffIncome - oneOffExpenses
    const netMovement = netRecurring + netOneOff
    balance += netMovement

    data.push({
      ...m,
      monthlyIncome,
      monthlyExpenses,
      oneOffIncome,
      oneOffExpenses,
      netOneOff,
      netRecurring,
      netMovement,
      projectedBalance: Math.round(balance),
    })
  }

  return data
}

/**
 * Calculate runway: how many months before capital reaches zero.
 * Returns the month index (1-based) or null if it never reaches zero.
 */
export function getRunway(forecastData) {
  for (let i = 0; i < forecastData.length; i++) {
    if (forecastData[i].projectedBalance <= 0) {
      return i + 1
    }
  }
  return null // Never reaches zero within the forecast period
}

/**
 * Find the lowest projected balance and the month it occurs.
 * Returns { amount, month (label), index }
 */
export function getLowestBalance(forecastData) {
  if (forecastData.length === 0) return { amount: 0, label: '—', index: 0 }

  let lowest = forecastData[0]
  let lowestIndex = 0

  for (let i = 1; i < forecastData.length; i++) {
    if (forecastData[i].projectedBalance < lowest.projectedBalance) {
      lowest = forecastData[i]
      lowestIndex = i
    }
  }

  return {
    amount: lowest.projectedBalance,
    label: lowest.label,
    index: lowestIndex,
  }
}

/**
 * Get the final projected capital (last month of forecast).
 */
export function getFinalProjectedCapital(forecastData) {
  if (forecastData.length === 0) return 0
  return forecastData[forecastData.length - 1].projectedBalance
}

/**
 * Determine the health status based on forecast data and safety buffer.
 * Returns 'green' | 'orange' | 'red'
 */
export function getHealthStatus(forecastData, safetyBuffer) {
  let belowBuffer = false
  let belowZero = false

  for (const point of forecastData) {
    if (point.projectedBalance <= 0) {
      belowZero = true
      break
    }
    if (point.projectedBalance < safetyBuffer) {
      belowBuffer = true
    }
  }

  if (belowZero) return 'red'
  if (belowBuffer) return 'orange'
  return 'green'
}

// ─── Person-based calculation helpers ───

/**
 * Get allocated amount for a given person on a transaction.
 */
export function getAllocatedAmountForPerson(transaction, personUid) {
  const allocation = normalizeTransactionAllocation(transaction, personUid)
  const split = allocation.splits.find(item => item.personUid === personUid)
  if (!split) return 0
  return Number(transaction.amountEUR) * (split.percentage / 100)
}

/**
 * Get monthly income for a specific person.
 */
export function getMonthlyIncomeByPerson(transactions, personUid) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  let totalIncome = 0

  for (const tx of transactions) {
    if (tx.recurrence !== 'monthly') continue
    if (tx.type !== 'income') continue
    if (!isTransactionActiveForMonth(tx, year, month)) continue
    totalIncome += getAllocatedAmountForPerson(tx, personUid)
  }

  return totalIncome
}

/**
 * Get monthly expenses for a specific person.
 */
export function getMonthlyExpensesByPerson(transactions, personUid) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  let totalExpenses = 0

  for (const tx of transactions) {
    if (tx.recurrence !== 'monthly') continue
    if (tx.type !== 'expense') continue
    if (!isTransactionActiveForMonth(tx, year, month)) continue
    totalExpenses += getAllocatedAmountForPerson(tx, personUid)
  }

  return totalExpenses
}

/**
 * Get monthly net cashflow for a specific person.
 */
export function getMonthlyNetCashflowByPerson(transactions, personUid) {
  const totalIncome = getMonthlyIncomeByPerson(transactions, personUid)
  const totalExpenses = getMonthlyExpensesByPerson(transactions, personUid)

  return {
    totalIncome,
    totalExpenses,
    netCashflow: totalIncome - totalExpenses,
  }
}

/**
 * Get the total one-off impact for a specific person over the forecast period.
 */
export function getOneOffImpactByPerson(transactions, personUid, monthCount = 12) {
  const months = generateNextMonths(monthCount)
  let totalIncome = 0
  let totalExpenses = 0

  for (const m of months) {
    for (const tx of transactions) {
      if (tx.recurrence !== 'one-off') continue
      if (!isOneOffInMonth(tx, m.year, m.month)) continue

      const allocatedAmount = getAllocatedAmountForPerson(tx, personUid)
      if (tx.type === 'income') totalIncome += allocatedAmount
      else totalExpenses += allocatedAmount
    }
  }

  return {
    totalIncome,
    totalExpenses,
    netOneOff: totalIncome - totalExpenses,
  }
}

/**
 * Get a full breakdown by person.
 * Returns an object with each personUid mapped to their cashflow summary.
 */
export function getPersonBreakdown(transactions, personUids) {
  const breakdown = {}

  for (const uid of personUids) {
    const monthly = getMonthlyNetCashflowByPerson(transactions, uid)
    const oneOff = getOneOffImpactByPerson(transactions, uid)
    breakdown[uid] = {
      monthly,
      oneOff,
      totalNet: monthly.netCashflow + oneOff.netOneOff,
    }
  }

  return breakdown
}

/**
 * Generate historical evolution of net position for given UIDs.
 * Expands all transactions up to `now`.
 */
export function getHistoricalEvolution(transactions, authorizedUids) {
  const now = new Date()
  const events = []

  // Add one-offs up to now
  transactions.filter(t => t.isActive && t.recurrence === 'one-off').forEach(tx => {
    const txDate = new Date(tx.date)
    if (txDate <= now) {
      events.push({ date: txDate, tx })
    }
  })

  // Expand recurring up to now
  transactions.filter(t => t.isActive && t.recurrence === 'monthly').forEach(tx => {
    const startDate = new Date(tx.date)
    const endDate = tx.endDate ? new Date(tx.endDate) : now
    const limitDate = endDate < now ? endDate : now

    let current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
    while (current <= limitDate) {
      events.push({ date: new Date(current), tx })
      current.setMonth(current.getMonth() + 1)
    }
  })

  // Sort events chronologically
  events.sort((a, b) => a.date - b.date)

  // Calculate cumulative per person
  const evolution = []
  const currentBalances = {}
  authorizedUids.forEach(uid => currentBalances[uid] = 0)
  
  // Start point
  if (events.length > 0 && events[0].date > new Date(now.getFullYear(), now.getMonth() - 12, 1)) {
    // Add an initial point with 0 balances before the first event
    evolution.push({
      timestamp: new Date(events[0].date.getTime() - 86400000).getTime(),
      dateStr: new Date(events[0].date.getTime() - 86400000).toISOString(),
      ...currentBalances
    })
  }

  events.forEach(event => {
    const { tx, date } = event
    const isIncome = tx.type === 'income'

    authorizedUids.forEach(uid => {
      const share = getAllocatedAmountForPerson(tx, uid)
      if (isIncome) {
        currentBalances[uid] += share
      } else {
        currentBalances[uid] -= share
      }
    })

    evolution.push({
      timestamp: date.getTime(),
      dateStr: date.toISOString(),
      ...currentBalances
    })
  })

  // End point
  evolution.push({
    timestamp: now.getTime(),
    dateStr: now.toISOString(),
    ...currentBalances
  })

  return evolution
}
