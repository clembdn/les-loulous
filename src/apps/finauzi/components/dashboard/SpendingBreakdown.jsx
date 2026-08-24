import { useMemo, useState } from 'react'
import { AUTHORIZED_UIDS, getPerson } from '@/shared/config/people.js'
import { getCategory } from '../../config/categories.js'
import { SPLIT_COMMON, getAccountCurrency } from '../../config/accounts.js'
import { getSpendingByCategory, getSpendingBySplit } from '../../utils/ledger.js'
import { useAppData } from '../../context/AppDataContext.jsx'
import { useCurrency } from '../../context/CurrencyContext.jsx'
import DonutChart, { collapseSlices } from '../chart/DonutChart.jsx'

// Deux lectures des dépenses de la période : à la charge de qui, et pour quoi.
// « À la charge de » remplace l'ancien « qui a payé » — avec un compte joint,
// le payeur ne dit plus grand-chose, c'est la répartition qui compte.
//
// La période (`from` / `to`) vient du sélecteur de durée du tableau de bord :
// tout l'écran regarde la même fenêtre, sinon on compare un graphe sur six
// mois à des dépenses sur trente jours sans s'en rendre compte.
export default function SpendingBreakdown({ accountId = null, from, to, periodLabel }) {
  const { transactions, settings } = useAppData()
  const { format, formatNative } = useCurrency()
  const rate = settings.eurToAud
  const [activeKey, setActiveKey] = useState(null)

  // Vue d'un compte → sa devise. Vue consolidée → euros convertis à l'affichage.
  const currency = accountId ? getAccountCurrency(accountId) : 'EUR'
  const money = accountId ? (v) => formatNative(v, currency) : format

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

  // Le camembert et la liste montrent exactement les mêmes parts : six
  // catégories au maximum, la queue regroupée dans « Autre ». Au-delà, les
  // arcs deviennent des traits — et deux découpages différents côte à côte
  // donneraient deux totaux qui ne se recoupent pas.
  const slices = useMemo(() => (
    collapseSlices(
      Object.entries(spendingByCategory)
        .filter(([, amount]) => amount > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([id, amount]) => {
          const cat = getCategory(id)
          return { key: id, label: cat.label, value: amount, hex: cat.hex, icon: cat.icon, bgClass: cat.bgClass, textClass: cat.textClass }
        }),
    )
  ), [spendingByCategory])

  const categoryTotal = slices.reduce((sum, s) => sum + s.value, 0)

  if (splitRows.length === 0 && slices.length === 0) return null

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
                    {Math.round(pct)}% des dépenses{periodLabel ? ` · ${periodLabel.toLowerCase()}` : ''}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {slices.length > 0 && (
        <section>
          <p className="text-xs uppercase tracking-[0.18em] text-white/30 mb-3">Où part l'argent</p>

          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 lg:flex-col lg:items-stretch xl:flex-row xl:items-center xl:gap-6">
              <DonutChart
                slices={slices}
                total={categoryTotal}
                formatValue={money}
                activeKey={activeKey}
                onActiveKeyChange={setActiveKey}
                centerLabel="Dépensé"
                className="w-40 h-40 sm:w-44 sm:h-44 mx-auto flex-shrink-0"
              />

              {/* La liste EST la légende : chaque part y a son nom et son
                  montant, pour que rien ne repose sur la seule couleur. */}
              <ul className="flex-1 min-w-0 space-y-2.5">
                {slices.map((slice) => {
                  const pct = categoryTotal > 0 ? (slice.value / categoryTotal) * 100 : 0
                  const active = activeKey === slice.key
                  return (
                    <li key={slice.key}>
                      <button
                        type="button"
                        onMouseEnter={() => setActiveKey(slice.key)}
                        onMouseLeave={() => setActiveKey(null)}
                        onClick={() => setActiveKey(active ? null : slice.key)}
                        className={`w-full text-left rounded-lg px-2 py-1 -mx-2 transition ${
                          active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2 mb-1.5">
                          <span className="inline-flex items-center gap-2 min-w-0">
                            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: slice.hex }} />
                            <span className="text-sm text-white font-medium truncate">{slice.label}</span>
                          </span>
                          <span className="flex items-baseline gap-1.5 flex-shrink-0">
                            <span className="text-[11px] text-white/40 tabular">{Math.round(pct)}%</span>
                            <span className="text-sm font-semibold text-white tabular">{money(slice.value)}</span>
                          </span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-500 ease-out"
                            style={{ width: `${pct}%`, background: slice.hex, opacity: activeKey && !active ? 0.35 : 1 }}
                          />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
