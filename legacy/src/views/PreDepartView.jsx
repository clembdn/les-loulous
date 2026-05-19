import { useMemo, useState } from 'react'
import { Luggage, ChevronDown, ChevronUp, TrendingDown } from 'lucide-react'
import { useAustraliaData } from '../hooks/useAustraliaData.js'
import CategoryBadge, { getCategoryConfig } from '../components/australia/CategoryBadge.jsx'
import { getPersonWithColor } from '../config/people.js'

const PRE_DEPART_CATEGORIES = ['admin', 'travel', 'health', 'housing', 'transport', 'other']

export default function PreDepartView() {
  const { transactions, format, isLoading, settings } = useAustraliaData()
  const [expandedCategory, setExpandedCategory] = useState(null)

  const preDepartTxs = useMemo(() => {
    if (!transactions) return []
    const now = new Date()
    return transactions
      .filter(tx => tx.recurrence === 'one-off' && tx.type === 'expense' && tx.isActive)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [transactions])

  const totalPreDepart = useMemo(() => {
    return preDepartTxs.reduce((sum, tx) => sum + (tx.amountEUR || 0), 0)
  }, [preDepartTxs])

  const byCategory = useMemo(() => {
    const map = {}
    for (const tx of preDepartTxs) {
      const cat = tx.category || 'other'
      if (!map[cat]) map[cat] = { items: [], total: 0 }
      map[cat].items.push(tx)
      map[cat].total += tx.amountEUR || 0
    }
    return map
  }, [preDepartTxs])

  const pastTxs = useMemo(() => {
    const now = new Date()
    return preDepartTxs.filter(tx => new Date(tx.date) <= now)
  }, [preDepartTxs])

  const futureTxs = useMemo(() => {
    const now = new Date()
    return preDepartTxs.filter(tx => new Date(tx.date) > now)
  }, [preDepartTxs])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <span className="inline-block h-6 w-6 border-2 border-brand/30 border-t-brand-glow rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 lg:pb-0 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Luggage className="h-6 w-6 text-brand" /> Pré-départ
        </h1>
        <p className="text-sm text-text-secondary">
          Toutes les dépenses engagées avant de poser le pied en Australie.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card border-brand/20 bg-brand/5">
          <p className="stat-label mb-1">Total Pré-départ</p>
          <p className="text-2xl font-bold tabular-nums text-brand-glow">{format(totalPreDepart)}</p>
          <p className="text-xs text-text-muted mt-1">{preDepartTxs.length} dépense{preDepartTxs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card">
          <p className="stat-label mb-1">Déjà payé</p>
          <p className="text-2xl font-bold tabular-nums text-text-primary">
            {format(pastTxs.reduce((s, t) => s + (t.amountEUR || 0), 0))}
          </p>
          <p className="text-xs text-text-muted mt-1">{pastTxs.length} dépense{pastTxs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card">
          <p className="stat-label mb-1">À venir</p>
          <p className="text-2xl font-bold tabular-nums text-amber-400">
            {format(futureTxs.reduce((s, t) => s + (t.amountEUR || 0), 0))}
          </p>
          <p className="text-xs text-text-muted mt-1">{futureTxs.length} dépense{futureTxs.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Par catégorie</h2>
        {Object.entries(byCategory)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([cat, data]) => {
            const config = getCategoryConfig(cat)
            const pct = totalPreDepart > 0 ? (data.total / totalPreDepart) * 100 : 0
            const isExpanded = expandedCategory === cat

            return (
              <div key={cat} className="bg-bg-card rounded-2xl border border-border-subtle overflow-hidden">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CategoryBadge category={cat} />
                    <div className="text-left">
                      <p className="text-sm font-medium">{config.label}</p>
                      <p className="text-xs text-text-muted">{data.items.length} dépense{data.items.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums">{format(data.total)}</p>
                      <p className="text-[10px] text-text-muted">{pct.toFixed(0)}%</p>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
                  </div>
                </button>

                {/* Progress bar */}
                <div className="mx-4 mb-3">
                  <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${config.bg} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Expanded items */}
                {isExpanded && (
                  <div className="border-t border-border-subtle/50 px-4 py-2 space-y-1.5">
                    {data.items.map(tx => {
                      const isPast = new Date(tx.date) <= new Date()
                      const payer = getPersonWithColor(tx.paidByUid, settings?.personColors)
                      return (
                        <div key={tx.id} className={`flex items-center justify-between py-2 px-3 rounded-xl ${isPast ? 'bg-bg-elevated' : 'bg-amber-500/5 border border-amber-500/10'}`}>
                          <div>
                            <p className="text-sm font-medium">{tx.title}</p>
                            <p className="text-[10px] text-text-muted">
                              {new Date(tx.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {payer && <> · <span className={payer.text}>{payer.shortLabel}</span></>}
                              {!isPast && <span className="ml-1 text-amber-400">· À venir</span>}
                            </p>
                          </div>
                          <p className="text-sm font-semibold tabular-nums">{format(tx.amountEUR)}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {preDepartTxs.length === 0 && (
        <div className="text-center py-12 px-4 border border-dashed border-border-strong rounded-2xl">
          <TrendingDown className="h-8 w-8 text-text-muted mx-auto mb-3" />
          <h3 className="text-lg font-medium text-text-primary mb-2">Aucune dépense pré-départ</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto">
            Les dépenses occasionnelles (visa, billets, assurance) apparaîtront ici automatiquement.
          </p>
        </div>
      )}
    </div>
  )
}
