import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useCurrency } from '../../context/CurrencyContext.jsx'
import { allocation } from '../../data/portfolio.js'

export default function AllocationDonut() {
  const { format } = useCurrency()
  const total = allocation.reduce((sum, a) => sum + a.value, 0)

  return (
    <section className="card">
      <header className="mb-2">
        <p className="stat-label">Répartition des actifs</p>
        <p className="stat-value">{format(total)}</p>
      </header>

      <div className="h-48 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={allocation}
              dataKey="value"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={2}
              stroke="none"
            >
              {allocation.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#11151C',
                border: '1px solid #1F2632',
                borderRadius: 8,
              }}
              labelStyle={{ color: '#9AA3B2' }}
              formatter={(v, n) => [format(v), n]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <p className="text-xs text-text-muted">Suivi</p>
            <p className="text-lg font-semibold tabular-nums">{format(total, { compact: true })}</p>
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {allocation.map((a) => {
          const pct = ((a.value / total) * 100).toFixed(1)
          return (
            <li key={a.name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
                <span className="text-text-secondary">{a.name}</span>
              </span>
              <span className="tabular-nums">
                {format(a.value)} <span className="text-text-muted">({pct}%)</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
