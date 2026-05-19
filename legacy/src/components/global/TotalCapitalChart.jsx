import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useCurrency } from '../../context/CurrencyContext.jsx'
import { totalCapitalSeries } from '../../data/portfolio.js'

const RANGES = [
  { id: '3M', months: 3 },
  { id: '6M', months: 6 },
  { id: '1Y', months: 12 },
  { id: 'ALL', months: 999 },
]

export default function TotalCapitalChart() {
  const { format, symbol } = useCurrency()
  const [range, setRange] = useState('1Y')

  const data = useMemo(() => {
    const months = RANGES.find((r) => r.id === range)?.months ?? 12
    return totalCapitalSeries.slice(-months)
  }, [range])

  const first = data[0]?.value ?? 0
  const last = data[data.length - 1]?.value ?? 0
  const delta = last - first
  const pct = first ? ((delta / first) * 100).toFixed(2) : '0.00'
  const positive = delta >= 0

  return (
    <section className="card">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="stat-label">Capital Total</p>
          <p className="stat-value">{format(last)}</p>
          <p className={`text-xs tabular-nums mt-1 ${positive ? 'text-success' : 'text-danger'}`}>
            {positive ? '+' : '−'}
            {format(Math.abs(delta))} ({positive ? '+' : '−'}
            {Math.abs(pct)}%) sur {range}
          </p>
        </div>
        <div className="inline-flex p-0.5 rounded-lg bg-bg-elevated border border-border-subtle">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-3 h-7 rounded-md text-xs font-medium transition-colors ${
                range === r.id ? 'bg-brand text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {r.id}
            </button>
          ))}
        </div>
      </header>

      <div className="h-64 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="capitalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2D7FF9" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#2D7FF9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1F2632" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: '#6B7280', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#1F2632' }}
            />
            <YAxis
              tick={{ fill: '#6B7280', fontSize: 11 }}
              tickFormatter={(v) => `${symbol}${(v / 1000).toFixed(0)}k`}
              tickLine={false}
              axisLine={{ stroke: '#1F2632' }}
              width={48}
            />
            <Tooltip
              cursor={{ stroke: '#2A3242', strokeWidth: 1 }}
              contentStyle={{
                backgroundColor: '#11151C',
                border: '1px solid #1F2632',
                borderRadius: 8,
              }}
              labelStyle={{ color: '#9AA3B2', fontSize: 12 }}
              formatter={(v) => [format(v), 'Total']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#4A95FF"
              strokeWidth={2}
              fill="url(#capitalGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
