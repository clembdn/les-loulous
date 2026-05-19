import { useMemo } from 'react'
import { AUTHORIZED_UIDS, getPerson } from '../../config/people.js'
import { getCategory } from '../../config/categories.js'
import {
  getMonthSpendingByPerson,
  getMonthSpendingByCategory,
} from '../../utils/cashflow.js'

function formatEUR(n) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

export default function MonthBreakdown({ transactions }) {
  const spendingByPerson = useMemo(
    () => getMonthSpendingByPerson(transactions),
    [transactions],
  )
  const spendingByCategory = useMemo(
    () => getMonthSpendingByCategory(transactions),
    [transactions],
  )

  const totalPerson = AUTHORIZED_UIDS.reduce(
    (sum, uid) => sum + (spendingByPerson[uid] || 0),
    0,
  )

  const topCategories = useMemo(() => {
    const entries = Object.entries(spendingByCategory)
      .map(([id, amount]) => ({ cat: getCategory(id), amount }))
      .filter((e) => e.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
    return entries
  }, [spendingByCategory])

  const totalSpending = topCategories.reduce((s, e) => s + e.amount, 0)

  if (totalPerson === 0 && topCategories.length === 0) return null

  return (
    <div className="space-y-8">
      {totalPerson > 0 && (
        <section>
          <p className="text-xs uppercase tracking-[0.18em] text-white/30 mb-3">Qui a payé</p>
          <div className="space-y-2">
            {AUTHORIZED_UIDS.map((uid) => {
              const person = getPerson(uid)
              const amount = spendingByPerson[uid] || 0
              const pct = totalPerson > 0 ? (amount / totalPerson) * 100 : 0
              return (
                <div key={uid} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className={`inline-flex items-center gap-2 text-sm font-medium ${person.textClass}`}>
                      <span className={`h-2 w-2 rounded-full ${person.dotClass}`} />
                      {person.label}
                    </span>
                    <span className="text-sm font-semibold text-white tabular">
                      {formatEUR(amount)}
                    </span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${person.dotClass} transition-all duration-500 ease-out`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/30 tabular mt-1.5">
                    {Math.round(pct)}% des dépenses du mois
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {topCategories.length > 0 && (
        <section>
          <p className="text-xs uppercase tracking-[0.18em] text-white/30 mb-3">Top dépenses</p>
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-1">
            {topCategories.map(({ cat, amount }) => {
              const Icon = cat.icon
              const pct = totalSpending > 0 ? (amount / totalSpending) * 100 : 0
              return (
                <div key={cat.id} className="px-3 py-3 flex items-center gap-3">
                  <div className={`h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center ${cat.bgClass} ${cat.textClass}`}>
                    <Icon size={14} strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-sm text-white font-medium">{cat.label}</span>
                      <span className="text-sm font-semibold text-white tabular">
                        {formatEUR(amount)}
                      </span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-500 ease-out"
                        style={{ width: `${pct}%`, background: cat.hex }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
