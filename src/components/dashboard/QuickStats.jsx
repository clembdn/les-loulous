import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'

function formatEUR(n) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function StatCard({ icon: Icon, label, value, valueClass }) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2 text-white/40">
        <Icon size={14} />
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-semibold tabular ${valueClass || 'text-white'}`}>{value}</p>
    </div>
  )
}

export default function QuickStats({ summary }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <StatCard
        icon={TrendingUp}
        label="Revenus"
        value={`+${formatEUR(summary.totalIncome)}`}
        valueClass="text-emerald-400"
      />
      <StatCard
        icon={TrendingDown}
        label="Dépenses"
        value={`−${formatEUR(summary.totalExpenses)}`}
        valueClass="text-red-400"
      />
      <StatCard
        icon={Wallet}
        label="Net"
        value={`${summary.net >= 0 ? '+' : '−'}${formatEUR(Math.abs(summary.net))}`}
        valueClass={summary.net >= 0 ? 'text-white' : 'text-red-400'}
      />
    </div>
  )
}
