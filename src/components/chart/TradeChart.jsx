import { useMemo, useId } from 'react'
import {
  AreaChart, Area, XAxis, YAxis,
  ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'

// Trade Republic-inspired minimalist line chart.
// - no axes, no grid
// - color = green if last >= first, red otherwise (or `accent` override)
// - on hover: vertical scrubber + dot, hover payload pushed to parent via onHover
export default function TradeChart({
  data,
  height = 280,
  accent,
  onHover,
  baselineIndex,
}) {
  const gradientId = useId().replace(/:/g, '')

  const lineColor = useMemo(() => {
    if (accent) return accent
    if (!data || data.length < 2) return '#9AA3B2'
    const first = data[0].balance
    const last = data[data.length - 1].balance
    return last >= first ? '#22C55E' : '#EF4444'
  }, [data, accent])

  const yDomain = useMemo(() => {
    if (!data || data.length === 0) return [0, 1]
    const values = data.map(d => d.balance)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || Math.abs(max) || 1
    const pad = span * 0.12
    return [min - pad, max + pad]
  }, [data])

  // Index where future starts (for the dashed future segment)
  const firstFutureIdx = useMemo(() => {
    if (!data) return -1
    return data.findIndex(d => d.isFuture)
  }, [data])

  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-white/30 text-xs">
        Pas encore de données.
      </div>
    )
  }

  // Two area series: solid up to today, dashed from today onwards.
  // Recharts trick: each series renders only its portion via undefined values elsewhere.
  const hasFuture = firstFutureIdx >= 0
  const solidData = data.map((d, i) => ({
    ...d,
    balanceSolid: !hasFuture || i < firstFutureIdx ? d.balance : null,
    balanceDashed: hasFuture && i >= Math.max(firstFutureIdx - 1, 0) ? d.balance : null,
  }))

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={solidData}
          margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
          onMouseMove={(state) => {
            if (state?.activePayload?.[0]?.payload) {
              onHover?.(state.activePayload[0].payload)
            }
          }}
          onMouseLeave={() => onHover?.(null)}
        >
          <defs>
            <linearGradient id={`g-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} hide />
          <YAxis domain={yDomain} hide />

          <Tooltip
            content={() => null}
            cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1, strokeDasharray: '2 4' }}
            isAnimationActive={false}
          />

          {typeof baselineIndex === 'number' && data[baselineIndex] && (
            <ReferenceLine
              y={data[baselineIndex].balance}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          )}

          {/* Past — solid filled area */}
          <Area
            type="monotone"
            dataKey="balanceSolid"
            stroke={lineColor}
            strokeWidth={1.8}
            fill={`url(#g-${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: lineColor, stroke: '#0B0E13', strokeWidth: 2 }}
            isAnimationActive
            animationDuration={500}
            connectNulls={false}
          />

          {/* Future — dashed line, no fill */}
          {hasFuture && (
            <Area
              type="monotone"
              dataKey="balanceDashed"
              stroke={lineColor}
              strokeWidth={1.6}
              strokeDasharray="4 4"
              fill="transparent"
              dot={false}
              activeDot={{ r: 4, fill: lineColor, stroke: '#0B0E13', strokeWidth: 2 }}
              isAnimationActive
              animationDuration={500}
              connectNulls={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
