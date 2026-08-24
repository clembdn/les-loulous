import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { useCurrency } from '../../context/CurrencyContext.jsx'

function StatCard({ icon: Icon, label, value, valueClass, onClick, hint }) {
  const content = (
    <>
      <div className="flex items-center gap-2 mb-2 text-white/40">
        <Icon size={14} />
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-semibold tabular ${valueClass || 'text-white'}`}>{value}</p>
      {hint && <p className="text-[10px] text-white/25 mt-1">{hint}</p>}
    </>
  )

  if (!onClick) {
    return <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">{content}</div>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-left hover:bg-white/[0.06] hover:border-white/10 active:scale-[0.98] transition"
    >
      {content}
    </button>
  )
}

// `summary` vient de `summarizePeriod` (ledger.js). On affiche `inflow` /
// `outflow` et non `income` / `expenses` : sur un compte donné, un virement
// reçu EST un revenu pour ce compte — le joint n'a que ça. En vue consolidée,
// les deux paires sont identiques, les virements internes étant neutralisés.
//
// `currency` : devise dans laquelle le résumé est déjà exprimé (vue d'un
// compte). Omis, les montants sont en euros et suivent la devise d'affichage.
//
// `onSelectFlow` : revenus et dépenses s'ouvrent sur leur détail. Le net, lui,
// n'est le détail de rien — c'est une soustraction, pas un flux.
export default function QuickStats({ summary, currency, onSelectFlow }) {
  const { format, formatNative } = useCurrency()
  const formatEUR = currency ? (v) => formatNative(v, currency) : format
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <StatCard
        icon={TrendingUp}
        label="Revenus"
        value={`+${formatEUR(summary.inflow)}`}
        valueClass="text-emerald-400"
        hint="Voir le détail"
        onClick={onSelectFlow ? () => onSelectFlow('in') : undefined}
      />
      <StatCard
        icon={TrendingDown}
        label="Dépenses"
        value={`−${formatEUR(summary.outflow)}`}
        valueClass="text-red-400"
        hint="Voir le détail"
        onClick={onSelectFlow ? () => onSelectFlow('out') : undefined}
      />
      <StatCard
        icon={Wallet}
        label="Net"
        value={`${summary.net >= 0 ? '+' : '−'}${formatEUR(Math.abs(summary.net))}`}
        valueClass={summary.net >= 0 ? 'text-white' : 'text-red-400'}
        hint="Revenus − dépenses"
      />
    </div>
  )
}
