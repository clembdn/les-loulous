import { useMemo } from 'react'
import { ArrowUpRight, ArrowDownRight, Plane } from 'lucide-react'
import { formatDateShort, getDaysToDeparture } from '../../utils/cashflow.js'
import { useCurrency } from '../../context/CurrencyContext.jsx'

function departureBadge(departureDate) {
  const days = getDaysToDeparture(departureDate)
  if (days == null) return null
  if (days > 0) return { text: `J−${days} · Départ`, tone: 'prep' }
  if (days === 0) return { text: 'Jour J · Australie', tone: 'australia' }
  return { text: `J+${-days} · Australie`, tone: 'australia' }
}

export default function CapitalHero({ label = 'Capital total', currentBalance, hoveredPoint, baselineBalance, rightSlot, departureDate }) {
  const { format: formatEUR } = useCurrency()
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

  const badge = !hoveredPoint ? departureBadge(departureDate) : null

  return (
    <div className="px-1">
      <p className="text-xs uppercase tracking-[0.18em] text-white/30 mb-2">{label}</p>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white tabular leading-none">
          {formatEUR(displayBalance)}
        </h1>
        {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
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
        {badge && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-md">
            <Plane size={9} strokeWidth={2.4} />
            {badge.text}
          </span>
        )}
      </div>
    </div>
  )
}
