// PersonBreakdown — shows per-person income/expense/net cards.
import { FINAUZI_PEOPLE, getPersonWithColor } from '../../config/people.js'

export default function PersonBreakdown({ personBreakdown, format, settings }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {FINAUZI_PEOPLE.map(p => {
        const person = getPersonWithColor(p.uid, settings?.personColors)
        const data = personBreakdown[person.uid]
        if (!data) return null
        const net = data.monthly.netCashflow
        const netColor = net > 0 ? 'text-emerald-400' : net < 0 ? 'text-rose-400' : 'text-text-primary'

        return (
          <div key={person.uid} className="card">
            {/* Person badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${person.bg} ${person.text} border ${person.border}`}>
                {person.label}
              </span>
            </div>

            {/* Monthly metrics */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Revenus mensuels</span>
                <span className="text-sm font-semibold tabular-nums text-emerald-400">
                  +{format(data.monthly.totalIncome)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Dépenses mensuelles</span>
                <span className="text-sm font-semibold tabular-nums text-rose-400">
                  −{format(data.monthly.totalExpenses)}
                </span>
              </div>
              <div className="h-px bg-border-subtle" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted font-medium">Net mensuel</span>
                <span className={`text-sm font-bold tabular-nums ${netColor}`}>
                  {net >= 0 ? '+' : '−'}{format(Math.abs(net))}
                </span>
              </div>
            </div>

            {/* One-off impact */}
            {(data.oneOff.totalIncome > 0 || data.oneOff.totalExpenses > 0) && (
              <div className="mt-3 pt-3 border-t border-border-subtle/60">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Impact ponctuel (12 mois)</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Net</span>
                  <span className={`text-xs font-semibold tabular-nums ${data.oneOff.netOneOff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {data.oneOff.netOneOff >= 0 ? '+' : '−'}{format(Math.abs(data.oneOff.netOneOff))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Compact mobile version of person breakdown.
 */
export function MobilePersonBreakdown({ personBreakdown, format, settings }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {FINAUZI_PEOPLE.map(p => {
        const person = getPersonWithColor(p.uid, settings?.personColors)
        const data = personBreakdown[person.uid]
        if (!data) return null
        const net = data.monthly.netCashflow
        const netColor = net > 0 ? 'text-emerald-400' : net < 0 ? 'text-rose-400' : 'text-text-primary'

        return (
          <div key={person.uid} className="rounded-2xl border border-border-subtle bg-bg-card p-4">
            {/* Person badge */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${person.bg} ${person.text} border ${person.border} mb-2.5`}>
              {person.label}
            </span>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-muted">Revenus mensuels</span>
                <span className="text-xs font-semibold tabular-nums text-emerald-400">+{format(data.monthly.totalIncome)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-muted">Dépenses mensuelles</span>
                <span className="text-xs font-semibold tabular-nums text-rose-400">−{format(data.monthly.totalExpenses)}</span>
              </div>
              <div className="h-px bg-border-subtle/60" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-muted font-medium">Net mensuel</span>
                <span className={`text-sm font-bold tabular-nums ${netColor}`}>
                  {net >= 0 ? '+' : '−'}{format(Math.abs(net))}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
