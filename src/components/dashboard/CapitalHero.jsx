import { useMemo } from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { formatDateShort } from '../../utils/cashflow.js'

function formatEUR(n) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

export default function CapitalHero({ label = 'Capital total', currentBalance, hoveredPoint, baselineBalance }) {
  const displayBalance = hoveredPoint?.balance ?? currentBalance
  const reference = baselineBalance ?? currentBalance

  const variation = useMemo(() => {
    if (reference == null) return null
    const diff = displayBalance - reference
    const pct = reference !== 0 ? (diff / Math.abs(reference)) * 100 : 0
    return { diff, pct, positive: diff >= 0 }
  }, [displayBalance, reference])

  const dateLabel = hoveredPoint
    ? formatDateShort(hoveredPoint.date || hoveredPoint.timestamp)
    : 'Aujourd\'hui'

  return (
    <div className="px-1">
      <p className="text-xs uppercase tracking-[0.18em] text-white/30 mb-2">{label}</p>
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white tabular">
          {formatEUR(displayBalance)}
        </h1>
      </div>
      <div className="flex items-center gap-3 mt-2 text-sm">
        {variation && (
          <span className={`inline-flex items-center gap-1 font-medium tabular ${variation.positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {variation.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {variation.positive ? '+' : ''}{formatEUR(variation.diff)}
            <span className="text-white/40 font-normal ml-1">
              ({variation.positive ? '+' : ''}{variation.pct.toFixed(1)}%)
            </span>
          </span>
        )}
        <span className="text-white/40 text-xs">{dateLabel}</span>
      </div>
    </div>
  )
}
