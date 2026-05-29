import { Pencil } from 'lucide-react'
import { useCurrency } from '../../context/CurrencyContext.jsx'

function getProgressColor(pct) {
  if (pct < 60) return '#10B981'   // emerald
  if (pct < 90) return '#F59E0B'   // amber
  return '#EF4444'                 // red
}

function getStatusClass(pct) {
  if (pct < 60) return 'text-emerald-400'
  if (pct < 90) return 'text-amber-400'
  return 'text-red-400'
}

export default function BudgetCard({ category, budget, spent, onEdit }) {
  const { format: formatEUR } = useCurrency()
  const Icon = category.icon
  const safeBudget = budget > 0 ? budget : 0
  const pct = safeBudget > 0 ? (spent / safeBudget) * 100 : 0
  const remaining = safeBudget - spent
  const progressColor = getProgressColor(pct)
  const statusClass = getStatusClass(pct)

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.03] transition">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center ${category.bgClass} ${category.textClass}`}>
            <Icon size={16} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{category.label}</p>
            <p className="text-[11px] text-white/40 tabular">
              {formatEUR(spent)} <span className="text-white/30">/ {formatEUR(safeBudget)}</span>
            </p>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="text-white/30 hover:text-white p-1.5 rounded-lg transition"
          aria-label="Modifier"
        >
          <Pencil size={14} />
        </button>
      </div>

      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-500 ease-out rounded-full"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: progressColor,
            boxShadow: `0 0 8px ${progressColor}55`,
          }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-[11px] tabular">
        <span className="text-white/50">{Math.round(pct)}% utilisé</span>
        <span className={`font-medium ${statusClass}`}>
          {remaining >= 0
            ? `Reste ${formatEUR(remaining)}`
            : `Dépassé ${formatEUR(Math.abs(remaining))}`}
        </span>
      </div>
    </div>
  )
}
