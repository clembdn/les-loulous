import { ArrowDownRight, ArrowUpRight, Lock, LineChart, Shield, TrendingUp } from 'lucide-react'
import { useCurrency } from '../../context/CurrencyContext.jsx'
import RiskMeter from '../ui/RiskMeter.jsx'

const ICONS = { shield: Shield, trending: TrendingUp, lock: Lock, chart: LineChart }
const CATEGORY_TONE = {
  Sécurité: 'text-brand-glow bg-brand/10 border-brand/30',
  Investissement: 'text-success bg-success/10 border-success/30',
  Bloqué: 'text-warning bg-warning/10 border-warning/30',
}

export default function AccountCard({ account }) {
  const { format } = useCurrency()
  const Icon = ICONS[account.icon] ?? Shield
  const positive = account.change24h >= 0
  const ChangeIcon = positive ? ArrowUpRight : ArrowDownRight
  const changeColor = positive ? 'text-success' : 'text-danger'

  return (
    <article className="card card-hover group cursor-pointer">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`grid h-10 w-10 place-items-center rounded-lg border ${CATEGORY_TONE[account.category]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{account.name}</p>
            <p className="text-xs text-text-muted truncate">{account.institution}</p>
          </div>
        </div>
        <span className={`pill border ${CATEGORY_TONE[account.category]}`}>{account.category}</span>
      </header>

      <div className="space-y-1">
        <p className="stat-label">Balance</p>
        <p className="stat-value">{format(account.balance)}</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`pill ${changeColor}`}>
            <ChangeIcon className="h-3 w-3" />
            {account.change24h === 0
              ? 'Stable'
              : `${positive ? '+' : '−'}${format(Math.abs(account.change24h))}`}
          </span>
          <span className="text-xs text-text-muted tabular-nums">APY {account.apy.toFixed(1)}%</span>
        </div>
        <RiskMeter level={account.risk} />
      </div>
    </article>
  )
}
