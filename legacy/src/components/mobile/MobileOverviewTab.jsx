import { useMemo } from 'react'
import { ShieldCheck, AlertTriangle, XCircle, TrendingUp, ArrowDown, Users } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis,
  ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'
import { getPersonByUid } from '../../config/people.js'
import { calculateCurrentMonthSettlement } from '../../utils/settlement.js'
import { ChevronRight } from 'lucide-react'
// ─── Status pill config ───
const STATUS_PILL = {
  green: { label: 'Sain', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25' },
  orange: { label: 'Attention', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25' },
  red: { label: 'Critique', bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/25' },
}

const STATUS_GRADIENT = {
  green: 'from-emerald-500/8 to-transparent',
  orange: 'from-amber-500/8 to-transparent',
  red: 'from-rose-500/8 to-transparent',
}

const STATUS_VALUE = {
  green: 'text-text-primary',
  orange: 'text-amber-400',
  red: 'text-rose-400',
}

const WARNING_MSG = {
  green: 'Ton capital reste au-dessus du seuil de sécurité.',
  orange: 'Ton capital passe sous le seuil pendant la période.',
  red: 'Ton capital atteint zéro ou passe en négatif.',
}

const WARNING_ICON = { green: ShieldCheck, orange: AlertTriangle, red: XCircle }
const WARNING_COLOR = { green: 'text-emerald-400', orange: 'text-amber-400', red: 'text-rose-400' }

// ─── Mini tooltip ───
function MiniTooltip({ active, payload, format }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl px-3 py-2 shadow-2xl">
      <p className="text-[11px] text-text-muted mb-0.5">{d.label}</p>
      <p className="text-sm font-semibold tabular-nums">{format(d.projectedBalance)}</p>
    </div>
  )
}

export default function MobileOverviewTab({ data }) {
  const {
    format,
    forecastData,
    monthlyCashflow,
    finalCapital,
    lowestBalance,
    settings,
    healthStatus,
    personBreakdown,
    compteCommunBalance,
    capitalProjet,
    getCashflowStatus,
    getFinalCapitalStatus,
    getRunwayLabel,
    getRunwayStatus,
    getLowestStatus,
    setActiveTab,
    transactions,
  } = data

  const settlement = useMemo(() => calculateCurrentMonthSettlement(transactions || []), [transactions])
  const payer = getPersonByUid(settlement.payerUid)
  const receiver = getPersonByUid(settlement.receiverUid)

  const pill = STATUS_PILL[getFinalCapitalStatus()] || STATUS_PILL.green

  // Chart color
  const { lineColor, gradientColors } = useMemo(() => {
    if (healthStatus === 'red') return { lineColor: '#F43F5E', gradientColors: ['rgba(244,63,94,0.25)', 'rgba(244,63,94,0)'] }
    if (healthStatus === 'orange') return { lineColor: '#F59E0B', gradientColors: ['rgba(245,158,11,0.25)', 'rgba(245,158,11,0)'] }
    return { lineColor: '#22C55E', gradientColors: ['rgba(34,197,94,0.25)', 'rgba(34,197,94,0)'] }
  }, [healthStatus])

  const currentMonthLabel = useMemo(() => {
    const now = new Date()
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return forecastData.find(d => d.key === key)?.label || null
  }, [forecastData])

  const cashflowStatus = getCashflowStatus()
  const runwayStatus = getRunwayStatus()
  const lowestStatus = getLowestStatus()

  const WarningIcon = WARNING_ICON[healthStatus]

  return (
    <div className="space-y-4">
      {/* ─── Hero Balance Card ─── */}
      <div className={`relative rounded-3xl border border-border-subtle overflow-hidden bg-gradient-to-b ${STATUS_GRADIENT[getFinalCapitalStatus()] || STATUS_GRADIENT.green}`}>
        <div className="relative z-10 px-6 pt-7 pb-6">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-1">Capital projeté</p>
          <p className={`text-4xl font-bold tabular-nums tracking-tight ${STATUS_VALUE[getFinalCapitalStatus()] || 'text-text-primary'}`}>
            {format(finalCapital)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-text-muted">Fin de période</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${pill.bg} ${pill.text} ${pill.border}`}>
              {pill.label}
            </span>
          </div>
        </div>
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-brand/5 blur-3xl" />
      </div>

      {/* ─── Compact Metrics Grid ─── */}
      <div className="grid grid-cols-3 gap-2">
        <MetricMini
          label="Cashflow"
          value={monthlyCashflow.netCashflow >= 0
            ? `+${format(monthlyCashflow.netCashflow)}`
            : `−${format(Math.abs(monthlyCashflow.netCashflow))}`
          }
          status={cashflowStatus}
        />
        <MetricMini
          label="Runway"
          value={getRunwayLabel()}
          status={runwayStatus}
        />
        <MetricMini
          label="Sécurité"
          value={format(settings.safetyBuffer)}
          status="neutral"
          muted
        />
        <MetricMini
          label="Point bas"
          value={format(lowestBalance.amount)}
          sub={lowestBalance.label}
          status={lowestStatus}
        />
        <MetricMini
          label="Compte Commun"
          value={format(compteCommunBalance)}
          status={compteCommunBalance > settings.safetyBuffer ? 'green' : compteCommunBalance > 0 ? 'orange' : 'red'}
        />
        <MetricMini
          label="Capital Projet"
          value={format(capitalProjet)}
          status="neutral"
        />
      </div>

      {/* ─── Équilibre Summary ─── */}
      <button 
        onClick={() => setActiveTab?.('equilibre')}
        className="w-full text-left bg-bg-card border border-border-subtle rounded-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-all"
      >
        <div>
          <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider mb-1">Équilibre du mois</p>
          {settlement.isBalanced ? (
            <p className="font-semibold text-emerald-400">Tout est équilibré</p>
          ) : (
            <p className="font-semibold">
              <span className={payer?.text}>{payer?.shortLabel}</span> doit <span className="tabular-nums">{format(settlement.amountEUR)}</span> à <span className={receiver?.text}>{receiver?.shortLabel}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-brand">
          Voir
          <ChevronRight className="h-4 w-4" />
        </div>
      </button>

      {/* ─── Forecast Mini Chart ─── */}
      <div className="rounded-2xl border border-border-subtle bg-bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Projection</p>
              <p className="text-[11px] text-text-muted mt-0.5">12 prochains mois</p>
            </div>
            <TrendingUp className={`h-4 w-4 ${WARNING_COLOR[healthStatus]}`} />
          </div>
        </div>
        <div className="h-48 px-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastData} margin={{ top: 8, right: 12, bottom: 2, left: 0 }}>
              <defs>
                <linearGradient id="mobileGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={gradientColors[0]} stopOpacity={1} />
                  <stop offset="100%" stopColor={gradientColors[1]} stopOpacity={1} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: '#4B5563', fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                interval={2}
              />
              <YAxis hide />
              <Tooltip
                content={<MiniTooltip format={format} />}
                cursor={false}
              />
              <ReferenceLine
                y={settings.safetyBuffer}
                stroke="#F59E0B"
                strokeDasharray="4 3"
                strokeWidth={1}
              />
              {currentMonthLabel && (
                <ReferenceLine
                  x={currentMonthLabel}
                  stroke="#2D7FF9"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                />
              )}
              <Area
                type="monotone"
                dataKey="projectedBalance"
                stroke={lineColor}
                strokeWidth={2}
                fill="url(#mobileGrad)"
                dot={false}
                activeDot={{ r: 4, fill: lineColor, stroke: '#0B0E13', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Insight message */}
        <div className="px-5 py-3 border-t border-border-subtle/60">
          <p className={`text-xs font-medium flex items-center gap-1.5 ${WARNING_COLOR[healthStatus]}`}>
            <WarningIcon className="h-3.5 w-3.5 shrink-0" />
            {WARNING_MSG[healthStatus]}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Mini Metric Card ───
function MetricMini({ label, value, sub, status = 'neutral', muted = false }) {
  const colors = {
    green: 'text-emerald-400',
    red: 'text-rose-400',
    orange: 'text-amber-400',
    neutral: muted ? 'text-text-muted' : 'text-text-primary',
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-card p-4 active:scale-[0.98] transition-transform">
      <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${colors[status]}`}>{value}</p>
      {sub && <p className="text-[10px] text-text-muted mt-0.5 truncate">{sub}</p>}
    </div>
  )
}
