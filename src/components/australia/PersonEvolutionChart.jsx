import React, { useState, useMemo } from 'react'
import { AreaChart, Area, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { getHistoricalEvolution } from '../../utils/cashflow.js'
import { CLEMENT_UID, LISE_UID, getPersonWithColor } from '../../config/people.js'

export default function PersonEvolutionChart({ transactions, format, settings }) {
  const [range, setRange] = useState('1M') // '1W', '1M', '1Y', 'MAX'

  const data = useMemo(() => getHistoricalEvolution(transactions, [CLEMENT_UID, LISE_UID]), [transactions])

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return []
    const now = Date.now()
    let cutoff = 0
    if (range === '1W') cutoff = now - 7 * 24 * 60 * 60 * 1000
    if (range === '1M') cutoff = now - 30 * 24 * 60 * 60 * 1000
    if (range === '1Y') cutoff = now - 365 * 24 * 60 * 60 * 1000

    let filtered = data.filter(d => d.timestamp >= cutoff)
    
    // Ensure we have at least a starting point if the first transaction is after the cutoff
    if (filtered.length > 0 && cutoff > 0 && filtered[0].timestamp > cutoff) {
       // Find the last known state before cutoff
       const before = data.filter(d => d.timestamp < cutoff)
       if (before.length > 0) {
         filtered.unshift({ ...before[before.length - 1], timestamp: cutoff })
       }
    } else if (filtered.length === 0 && data.length > 0) {
      // If no points in range, just take the last known state
      const last = data[data.length - 1]
      filtered = [{ ...last, timestamp: cutoff }, { ...last, timestamp: now }]
    }
    
    return filtered
  }, [data, range])

  // Get current and start values
  const startValues = filteredData.length > 0 ? filteredData[0] : { [CLEMENT_UID]: 0, [LISE_UID]: 0 }
  const currentValues = filteredData.length > 0 ? filteredData[filteredData.length - 1] : { [CLEMENT_UID]: 0, [LISE_UID]: 0 }

  const clementColor = getPersonWithColor(CLEMENT_UID, settings?.personColors)
  const liseColor = getPersonWithColor(LISE_UID, settings?.personColors)

  const renderStats = (uid, colorConfig) => {
    const start = startValues[uid]
    const current = currentValues[uid]
    const delta = current - start
    const isPositive = delta >= 0
    // Trade Republic style %
    let pct = 0
    if (Math.abs(start) > 0) {
      pct = (delta / Math.abs(start)) * 100
    }

    return (
      <div className="flex-1">
        <p className="text-[10px] sm:text-xs text-text-muted mb-1 font-medium tracking-wide flex items-center gap-1.5 uppercase">
          <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: hexColors[colorConfig.color] || '#EAB308' }} />
          {colorConfig.shortLabel}
        </p>
        <p className="text-xl sm:text-3xl font-bold tabular-nums tracking-tight text-text-primary">
          {format(current)}
        </p>
        <p className={`text-xs sm:text-sm font-semibold mt-1 flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? '+' : '−'}{format(Math.abs(delta))} 
          {Math.abs(start) > 0 && (
            <span className="opacity-75 font-medium ml-0.5 bg-current/10 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs">
              {isPositive ? '+' : ''}{pct.toFixed(2)}%
            </span>
          )}
        </p>
      </div>
    )
  }

  const hexColors = {
    yellow: '#EAB308',
    purple: '#A855F7',
    emerald: '#10B981',
    blue: '#3B82F6',
    rose: '#F43F5E',
    orange: '#F97316'
  }

  const cHex = hexColors[clementColor.color] || '#EAB308'
  const lHex = hexColors[liseColor.color] || '#A855F7'

  return (
    <div className="card p-4 sm:p-6 mt-6">
      <div className="flex items-start sm:items-center justify-between mb-6 flex-col sm:flex-row gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Évolution du Cashflow</h3>
          <p className="text-[11px] sm:text-sm text-text-muted">Balance nette globale par personne</p>
        </div>
        <div className="flex p-1 rounded-lg bg-bg-elevated border border-border-subtle w-full sm:w-auto overflow-x-auto scrollbar-hide">
          {['1W', '1M', '1Y', 'MAX'].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                range === r ? 'bg-bg-card shadow-sm text-text-primary' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6 mb-8">
        {renderStats(CLEMENT_UID, clementColor)}
        <div className="w-px h-16 bg-border-subtle/50" />
        {renderStats(LISE_UID, liseColor)}
      </div>

      <div className="h-[200px] sm:h-[300px] mt-4 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorClement" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={cHex} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={cHex} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorLise" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lHex} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={lHex} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-bg-card border border-border-subtle rounded-xl p-3 shadow-xl min-w-[150px]">
                      <p className="text-xs text-text-muted mb-2 font-medium">
                        {new Date(payload[0].payload.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      {payload.map(p => (
                        <div key={p.dataKey} className="flex items-center gap-3 justify-between mt-1.5">
                          <span className="flex items-center gap-1.5 text-[11px] text-text-secondary font-medium">
                            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                            {p.dataKey === CLEMENT_UID ? clementColor.shortLabel : liseColor.shortLabel}
                          </span>
                          <span className="text-xs font-semibold tabular-nums">{format(p.value)}</span>
                        </div>
                      ))}
                    </div>
                  )
                }
                return null
              }}
            />
            <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="3 3" />
            <Area
              type="linear"
              dataKey={CLEMENT_UID}
              stroke={cHex}
              strokeWidth={2}
              fill="url(#colorClement)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: cHex }}
            />
            <Area
              type="linear"
              dataKey={LISE_UID}
              stroke={lHex}
              strokeWidth={2}
              fill="url(#colorLise)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: lHex }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
