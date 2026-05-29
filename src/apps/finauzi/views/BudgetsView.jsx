import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useCurrency } from '../context/CurrencyContext.jsx'
import { EXPENSE_CATEGORIES, getCategory } from '../config/categories.js'
import { getMonthSpendingByCategory, formatMonthLong } from '../utils/cashflow.js'
import BudgetCard from '../components/budgets/BudgetCard.jsx'
import BudgetEditModal from '../components/budgets/BudgetEditModal.jsx'

function getProgressColor(pct) {
  if (pct < 60) return '#10B981'
  if (pct < 90) return '#F59E0B'
  return '#EF4444'
}

export default function BudgetsView() {
  const { transactions, settings, isLoading } = useAppData()
  const { currentUser } = useAuth()
  const { format: formatEUR } = useCurrency()
  const [editing, setEditing] = useState(null)

  const budgets = settings.budgets || {}
  const spendingByCat = useMemo(
    () => getMonthSpendingByCategory(transactions),
    [transactions],
  )

  const { withBudget, withoutBudget } = useMemo(() => {
    const w = []
    const wo = []
    for (const cat of EXPENSE_CATEGORIES) {
      if (budgets[cat.id] != null) w.push(cat)
      else wo.push(cat)
    }
    return { withBudget: w, withoutBudget: wo }
  }, [budgets])

  const totals = useMemo(() => {
    let totalBudget = 0
    let totalSpent = 0
    for (const cat of withBudget) {
      totalBudget += budgets[cat.id] || 0
      totalSpent += spendingByCat[cat.id] || 0
    }
    return { totalBudget, totalSpent, pct: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0 }
  }, [withBudget, budgets, spendingByCat])

  const monthLabel = formatMonthLong(new Date())

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <span className="h-6 w-6 border-2 border-white/15 border-t-white/80 rounded-full animate-spin" />
      </div>
    )
  }

  const progressColor = getProgressColor(totals.pct)
  const remaining = totals.totalBudget - totals.totalSpent

  return (
    <div className="fade-in pb-32 lg:pb-12">
      <div className="max-w-3xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 pt-8 lg:pt-10">
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Budgets</h1>
        <p className="text-xs text-white/40 capitalize mb-8">{monthLabel}</p>

        {/* Total summary */}
        {withBudget.length > 0 && (
          <div className="mb-8 bg-white/[0.03] border border-white/5 rounded-2xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/30 mb-2">Total ce mois</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-2xl font-semibold text-white tabular">
                {formatEUR(totals.totalSpent)}
              </span>
              <span className="text-sm text-white/40 tabular">
                / {formatEUR(totals.totalBudget)}
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500 ease-out rounded-full"
                style={{
                  width: `${Math.min(totals.pct, 100)}%`,
                  background: progressColor,
                  boxShadow: `0 0 10px ${progressColor}66`,
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-2.5 text-xs tabular">
              <span className="text-white/50">{Math.round(totals.pct)}% utilisé</span>
              <span className={`font-medium ${remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {remaining >= 0
                  ? `${formatEUR(remaining)} restant`
                  : `${formatEUR(Math.abs(remaining))} dépassé`}
              </span>
            </div>
          </div>
        )}

        {/* Active budgets */}
        {withBudget.length > 0 && (
          <Section title="Mes budgets">
            <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 lg:gap-4 xl:gap-5">
              {withBudget.map((cat) => (
                <BudgetCard
                  key={cat.id}
                  category={cat}
                  budget={budgets[cat.id] || 0}
                  spent={spendingByCat[cat.id] || 0}
                  onEdit={() => setEditing(cat)}
                />
              ))}
            </div>
          </Section>
        )}

        {/* No budget yet */}
        {withBudget.length === 0 && (
          <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-8 text-center mb-8">
            <p className="text-sm text-white/60 mb-1">Aucun budget pour l'instant</p>
            <p className="text-xs text-white/30">
              Définis une limite par catégorie pour suivre tes dépenses du mois.
            </p>
          </div>
        )}

        {/* Categories without budget */}
        {withoutBudget.length > 0 && (
          <Section title={withBudget.length > 0 ? 'Ajouter un budget' : 'Catégories'}>
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {withoutBudget.map((cat) => {
                const Icon = cat.icon
                const spent = spendingByCat[cat.id] || 0
                return (
                  <button
                    key={cat.id}
                    onClick={() => setEditing(cat)}
                    className="flex items-center gap-2.5 px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] hover:border-white/10 transition text-left"
                  >
                    <div className={`h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center ${cat.bgClass} ${cat.textClass}`}>
                      <Icon size={14} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white truncate">{cat.label}</p>
                      <p className="text-[10px] text-white/30 tabular">
                        {spent > 0 ? formatEUR(spent) : '—'}
                      </p>
                    </div>
                    <Plus size={14} className="text-white/30 flex-shrink-0" />
                  </button>
                )
              })}
            </div>
          </Section>
        )}
      </div>

      {editing && (
        <BudgetEditModal
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          category={editing}
          currentBudgets={budgets}
          currentUid={currentUser?.uid}
        />
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/30 mb-3 px-1">{title}</p>
      {children}
    </section>
  )
}
