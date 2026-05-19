import { useMemo, useState } from 'react'
import { Plus, Users, User, Wallet } from 'lucide-react'
import { useFinAuziData } from '../hooks/useFinAuziData.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { getPerson } from '../config/people.js'
import {
  getCurrentBalance,
  getMonthSummary,
  buildBalanceSeries,
} from '../utils/cashflow.js'
import TradeChart from '../components/chart/TradeChart.jsx'
import CapitalHero from '../components/dashboard/CapitalHero.jsx'
import RangeSelector, { getRangeById } from '../components/dashboard/RangeSelector.jsx'
import QuickStats from '../components/dashboard/QuickStats.jsx'
import MonthBreakdown from '../components/dashboard/MonthBreakdown.jsx'

const ACCOUNT_VIEWS = [
  { id: 'all',      label: 'Total',     icon: Wallet },
  { id: 'common',   label: 'Commun',    icon: Users },
  { id: 'personal', label: 'Personnel', icon: User },
]

const HERO_LABELS = {
  all: 'Capital total',
  common: 'Compte commun',
  personal: 'Compte personnel',
}

export default function DashboardView() {
  const { transactions, settings, isLoading } = useFinAuziData()
  const { currentUser } = useAuth()
  const { openForm, openSettings } = useUI()
  const me = getPerson(currentUser?.uid)
  const [accountView, setAccountView] = useState('all')
  const [rangeId, setRangeId] = useState('6M')
  const [hovered, setHovered] = useState(null)

  const { filteredTxs, effectiveInitial } = useMemo(() => {
    const totalInitial = settings.initialCapitalEUR || 0
    const commonInitial = settings.commonInitialCapitalEUR || 0

    if (accountView === 'common') {
      return {
        filteredTxs: transactions.filter((t) => (t.account || 'personal') === 'common'),
        effectiveInitial: commonInitial,
      }
    }
    if (accountView === 'personal') {
      return {
        filteredTxs: transactions.filter((t) => (t.account || 'personal') === 'personal'),
        effectiveInitial: Math.max(totalInitial - commonInitial, 0),
      }
    }
    return { filteredTxs: transactions, effectiveInitial: totalInitial }
  }, [transactions, settings.initialCapitalEUR, settings.commonInitialCapitalEUR, accountView])

  const currentBalance = useMemo(
    () => getCurrentBalance(filteredTxs, effectiveInitial),
    [filteredTxs, effectiveInitial],
  )

  const monthSummary = useMemo(
    () => getMonthSummary(filteredTxs),
    [filteredTxs],
  )

  const series = useMemo(() => {
    const range = getRangeById(rangeId)
    return buildBalanceSeries(filteredTxs, effectiveInitial, range)
  }, [filteredTxs, effectiveInitial, rangeId])

  const baselineBalance = series[0]?.balance ?? currentBalance

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <span className="h-6 w-6 border-2 border-white/15 border-t-white/80 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="fade-in pb-32 lg:pb-12">
      <div className="max-w-3xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-10">
        <CapitalHero
          label={HERO_LABELS[accountView]}
          currentBalance={currentBalance}
          hoveredPoint={hovered}
          baselineBalance={baselineBalance}
          rightSlot={
            me && (
              <button
                onClick={openSettings}
                className={`h-11 w-11 lg:hidden rounded-full flex items-center justify-center text-sm font-semibold border transition hover:scale-105 active:scale-95 ${me.bgClass} ${me.textClass} ${me.borderClass}`}
                aria-label="Ouvrir les réglages"
                title="Réglages"
              >
                {me.initial}
              </button>
            )
          }
        />

        {/* Account toggle */}
        <div className="mt-5 flex items-center gap-1 p-1 bg-white/[0.03] rounded-xl w-full sm:w-auto sm:inline-flex">
          {ACCOUNT_VIEWS.map((v) => {
            const Icon = v.icon
            const active = accountView === v.id
            return (
              <button
                key={v.id}
                onClick={() => setAccountView(v.id)}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition ${
                  active
                    ? v.id === 'common'
                      ? 'bg-sky-500/15 text-sky-400'
                      : v.id === 'personal'
                        ? 'bg-white/10 text-white'
                        : 'bg-white text-black'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                <Icon size={12} strokeWidth={2.4} />
                {v.label}
              </button>
            )
          })}
        </div>

        <div className="mt-4">
          <TradeChart
            data={series}
            onHover={setHovered}
            height={280}
            baselineIndex={0}
          />
        </div>

        <div className="mt-4">
          <RangeSelector value={rangeId} onChange={setRangeId} />
        </div>

        <div className="mt-8 lg:mt-10 lg:grid lg:grid-cols-2 lg:gap-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/30 mb-3">
              Ce mois-ci {accountView !== 'all' && <span className="text-white/50">· {HERO_LABELS[accountView].toLowerCase()}</span>}
            </p>
            <QuickStats summary={monthSummary} />
          </div>

          <div className="mt-8 lg:mt-0">
            <MonthBreakdown transactions={filteredTxs} />
          </div>
        </div>
      </div>

      <button
        onClick={() => openForm(null)}
        className="fixed bottom-24 right-5 sm:bottom-8 sm:right-8 lg:hidden z-30 h-14 w-14 rounded-full bg-white text-black shadow-lg shadow-black/40 flex items-center justify-center hover:scale-105 active:scale-95 transition"
        aria-label="Ajouter une transaction"
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>
    </div>
  )
}
