import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'

function CustomTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-3 shadow-2xl min-w-[200px]">
      <p className="text-sm font-semibold text-text-primary mb-2">{d.label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">Capital projeté</span>
          <span className={`font-semibold tabular-nums ${d.projectedBalance >= 0 ? 'text-text-primary' : 'text-danger'}`}>
            {format(d.projectedBalance)}
          </span>
        </div>
        <div className="h-px bg-border-subtle" />
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">Revenus mensuels</span>
          <span className="text-success tabular-nums">+{format(d.monthlyIncome)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">Dépenses mensuelles</span>
          <span className="text-danger tabular-nums">−{format(d.monthlyExpenses)}</span>
        </div>
        {(d.oneOffIncome > 0 || d.oneOffExpenses > 0) && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Impact occasionnel</span>
            <span className={`tabular-nums ${d.netOneOff >= 0 ? 'text-success' : 'text-danger'}`}>
              {d.netOneOff >= 0 ? '+' : '−'}{format(Math.abs(d.netOneOff))}
            </span>
          </div>
        )}
        <div className="h-px bg-border-subtle" />
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">Mouvement net</span>
          <span className={`font-semibold tabular-nums ${d.netMovement >= 0 ? 'text-success' : 'text-danger'}`}>
            {d.netMovement >= 0 ? '+' : '−'}{format(Math.abs(d.netMovement))}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function ForecastChart({ forecastData, safetyBuffer, format }) {
  // Determine line color based on health
  const { lineColor, gradientColors } = useMemo(() => {
    let hasRed = false
    let hasOrange = false

    for (const point of forecastData) {
      if (point.projectedBalance <= 0) {
        hasRed = true
        break
      }
      if (point.projectedBalance < safetyBuffer) {
        hasOrange = true
      }
    }

    if (hasRed) return {
      lineColor: '#EF4444',
      gradientColors: ['rgba(239,68,68,0.3)', 'rgba(239,68,68,0)'],
    }
    if (hasOrange) return {
      lineColor: '#F59E0B',
      gradientColors: ['rgba(245,158,11,0.3)', 'rgba(245,158,11,0)'],
    }
    return {
      lineColor: '#22C55E',
      gradientColors: ['rgba(34,197,94,0.3)', 'rgba(34,197,94,0)'],
    }
  }, [forecastData, safetyBuffer])

  // Find current month index for the vertical reference line
  const currentMonthKey = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const currentMonthLabel = useMemo(() => {
    const match = forecastData.find(d => d.key === currentMonthKey)
    return match?.label || null
  }, [forecastData, currentMonthKey])

  if (forecastData.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-text-muted text-sm">
        Aucune donnée de prévision disponible.
      </div>
    )
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={forecastData} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradientColors[0]} stopOpacity={1} />
              <stop offset="100%" stopColor={gradientColors[1]} stopOpacity={1} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#1F2632" vertical={false} />

          <XAxis
            dataKey="label"
            tick={{ fill: '#6B7280', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#1F2632' }}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={50}
          />

          <YAxis
            tick={{ fill: '#6B7280', fontSize: 11 }}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            tickLine={false}
            axisLine={{ stroke: '#1F2632' }}
            width={50}
          />

          <Tooltip
            content={<CustomTooltip format={format} />}
            cursor={{ stroke: '#2A3242', strokeWidth: 1, strokeDasharray: '4 4' }}
          />

          {/* Safety buffer horizontal dashed line */}
          <ReferenceLine
            y={safetyBuffer}
            stroke="#F59E0B"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{
              value: `Seuil: ${format(safetyBuffer)}`,
              fill: '#F59E0B',
              fontSize: 10,
              position: 'right',
            }}
          />

          {/* Zero line */}
          <ReferenceLine
            y={0}
            stroke="#EF4444"
            strokeDasharray="4 4"
            strokeWidth={1}
          />

          {/* Current month vertical dashed line */}
          {currentMonthLabel && (
            <ReferenceLine
              x={currentMonthLabel}
              stroke="#2D7FF9"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: 'Aujourd\'hui',
                fill: '#2D7FF9',
                fontSize: 10,
                position: 'top',
              }}
            />
          )}

          <Area
            type="monotone"
            dataKey="projectedBalance"
            stroke={lineColor}
            strokeWidth={2.5}
            fill="url(#forecastGrad)"
            dot={false}
            activeDot={{ r: 5, fill: lineColor, stroke: '#11151C', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
