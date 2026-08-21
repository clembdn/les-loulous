import { useMemo } from 'react'
import { AUTHORIZED_UIDS, getPerson } from '@/shared/config/people.js'
import { getCategory } from '../../config/categories.js'
import { SPLIT_COMMON, getAccountCurrency } from '../../config/accounts.js'
import { getSpendingByCategory, getSpendingBySplit } from '../../utils/ledger.js'
import { getMonthRange } from '../../utils/cashflow.js'
import { useAppData } from '../../context/AppDataContext.jsx'
import { useCurrency } from '../../context/CurrencyContext.jsx'

// Deux lectures des dépenses du mois : à la charge de qui, et pour quoi.
// « À la charge de » remplace l'ancien « qui a payé » — avec un compte joint,
// le payeur ne dit plus grand-chose, c'est la répartition qui compte.
export default function MonthBreakdown({ accountId = null }) {
  const { transactions, settings } = useAppData()
  const { format, formatNative } = useCurrency()
  const rate = settings.eurToAud

  // Vue d'un compte → sa devise. Vue consolidée → euros convertis à l'affichage.
  const currency = accountId ? getAccountCurrency(accountId) : 'EUR'
  const money = accountId ? (v) => formatNative(v, currency) : format

  const { from, to } = useMemo(() => getMonthRange(), [])

  const spendingBySplit = useMemo(
    () => getSpendingBySplit(transactions, { from, to, rate, currency }),
    [transactions, from, to, rate, currency],
  )

  const spendingByCategory = useMemo(
    () => getSpendingByCategory(transactions, { accountId, from, to, rate, currency }),
    [transactions, accountId, from, to, rate, currency],
  )

  const splitRows = useMemo(() => {
    const rows = [{
      key: SPLIT_COMMON,
      label: 'Commun',
      amount: spendingBySplit[SPLIT_COMMON] || 0,
      dotClass: 'bg-sky-400',
      textClass: 'text-sky-400',
    }]
    for (const uid of AUTHORIZED_UIDS) {
      const person = getPerson(uid, settings.userColors)
      rows.push({
        key: uid,
        label: person.label,
        amount: spendingBySplit[uid] || 0,
        dotClass: person.dotClass,
        textClass: person.textClass,
      })
    }
    return rows.filter((r) => r.amount > 0)
  }, [spendingBySplit, settings.userColors])

  const splitTotal = splitRows.reduce((sum, r) => sum + r.amount, 0)

  const topCategories = useMemo(() => (
    Object.entries(spendingByCategory)
      .map(([id, amount]) => ({ cat: getCategory(id), amount }))
      .filter((e) => e.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  ), [spendingByCategory])

  const categoryTotal = topCategories.reduce((s, e) => s + e.amount, 0)

  if (splitRows.length === 0 && topCategories.length === 0) return null

  return (
    <div className="space-y-8">
      {splitRows.length > 0 && !accountId && (
        <section>
          <p className="text-xs uppercase tracking-[0.18em] text-white/30 mb-3">À la charge de</p>
          <div className="space-y-2">
            {splitRows.map((row) => {
              const pct = splitTotal > 0 ? (row.amount / splitTotal) * 100 : 0
              return (
                <div key={row.key} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className={`inline-flex items-center gap-2 text-sm font-medium ${row.textClass}`}>
                      <span className={`h-2 w-2 rounded-full ${row.dotClass}`} />
                      {row.label}
                    </span>
                    <span className="text-sm font-semibold text-white tabular">
                      {money(row.amount)}
                    </span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${row.dotClass} transition-all duration-500 ease-out`}
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
              const pct = categoryTotal > 0 ? (amount / categoryTotal) * 100 : 0
              return (
                <div key={cat.id} className="px-3 py-3 flex items-center gap-3">
                  <div className={`h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center ${cat.bgClass} ${cat.textClass}`}>
                    <Icon size={14} strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-sm text-white font-medium">{cat.label}</span>
                      <span className="flex items-baseline gap-1.5">
                        <span className="text-[11px] text-white/40 tabular">{Math.round(pct)}%</span>
                        <span className="text-sm font-semibold text-white tabular">{money(amount)}</span>
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
