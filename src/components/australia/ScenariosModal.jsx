import { X, TrendingUp, TrendingDown, Target } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

function ScenarioTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl px-3 py-2 shadow-2xl">
      <p className="text-[11px] text-text-muted mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-xs font-semibold tabular-nums" style={{ color: entry.color }}>
          {entry.name}: {format(entry.value)}
        </p>
      ))}
    </div>
  )
}

export default function ScenariosModal({ isOpen, onClose, scenarioData, format, safetyBuffer }) {
  if (!isOpen || !scenarioData) return null

  const { prudent, realiste, optimiste } = scenarioData

  // Merge data for chart
  const chartData = prudent.map((p, i) => ({
    label: p.label,
    Prudent: p.projectedBalance,
    Réaliste: realiste[i]?.projectedBalance || 0,
    Optimiste: optimiste[i]?.projectedBalance || 0,
  }))

  const finalPrudent = prudent[prudent.length - 1]?.projectedBalance || 0
  const finalRealiste = realiste[realiste.length - 1]?.projectedBalance || 0
  const finalOptimiste = optimiste[optimiste.length - 1]?.projectedBalance || 0

  const scenarios = [
    {
      label: 'Prudent',
      description: 'Pas de job, pas de revenus France',
      icon: TrendingDown,
      final: finalPrudent,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
    },
    {
      label: 'Réaliste',
      description: 'Revenus France + job mois 3',
      icon: Target,
      final: finalRealiste,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'Optimiste',
      description: 'Job dès le mois 1 + loyer réduit',
      icon: TrendingUp,
      final: finalOptimiste,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-bg-card border border-border-subtle rounded-2xl shadow-2xl animate-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle shrink-0">
          <h2 className="text-lg font-semibold">Scénarios de projection</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6 overflow-y-auto">
          {/* Scenario Cards */}
          <div className="grid grid-cols-3 gap-3">
            {scenarios.map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className={`rounded-xl border p-4 ${s.bg} ${s.border}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className={`h-4 w-4 ${s.color}`} />
                    <span className={`text-xs font-semibold ${s.color}`}>{s.label}</span>
                  </div>
                  <p className={`text-xl font-bold tabular-nums ${s.color}`}>{format(s.final)}</p>
                  <p className="text-[10px] text-text-muted mt-1">{s.description}</p>
                </div>
              )
            })}
          </div>

          {/* Chart */}
          <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
            <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-3">Projection comparative 12 mois</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 2, left: 0 }}>
                  <defs>
                    <linearGradient id="gradPrudent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(244,63,94,0.15)" />
                      <stop offset="100%" stopColor="rgba(244,63,94,0)" />
                    </linearGradient>
                    <linearGradient id="gradRealiste" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(245,158,11,0.15)" />
                      <stop offset="100%" stopColor="rgba(245,158,11,0)" />
                    </linearGradient>
                    <linearGradient id="gradOptimiste" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(34,197,94,0.15)" />
                      <stop offset="100%" stopColor="rgba(34,197,94,0)" />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} axisLine={false} width={50} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ScenarioTooltip format={format} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Prudent" stroke="#F43F5E" strokeWidth={2} fill="url(#gradPrudent)" dot={false} />
                  <Area type="monotone" dataKey="Réaliste" stroke="#F59E0B" strokeWidth={2} fill="url(#gradRealiste)" dot={false} />
                  <Area type="monotone" dataKey="Optimiste" stroke="#22C55E" strokeWidth={2} fill="url(#gradOptimiste)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-subtle shrink-0 flex justify-end">
          <button onClick={onClose} className="px-4 h-9 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-elevated border border-border-subtle hover:border-border-strong transition-colors">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
