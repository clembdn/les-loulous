import { Area, AreaChart, ResponsiveContainer } from 'recharts'

export default function Sparkline({ data, positive = true, height = 32 }) {
  const series = data.map((v, i) => ({ i, v }))
  const stroke = positive ? '#22C55E' : '#EF4444'
  const id = `spark-${positive ? 'up' : 'dn'}-${Math.random().toString(36).slice(2, 7)}`
  return (
    <div style={{ width: 80, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
