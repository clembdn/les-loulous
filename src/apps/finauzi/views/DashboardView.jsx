import { useMemo, useState } from 'react'
import { Plus, Wallet } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { getPerson } from '@/shared/config/people.js'
import { DEPARTURE_DATE } from '../config/journey.js'
import { getOrderedAccounts, getAccount } from '../config/accounts.js'
import { getOpeningBalance } from '../services/settingsService.js'
import { getAllBalances, getNetWorthEUR } from '../utils/ledger.js'
import { buildAccountSeries, addMonths } from '../utils/forecast.js'
import { summarizePeriod } from '../utils/ledger.js'
import { DEFAULT_RANGE_ID, getRangeById, getRangePeriod } from '../config/ranges.js'
import TradeChart from '../components/chart/TradeChart.jsx'
import CapitalHero from '../components/dashboard/CapitalHero.jsx'
import RangeSelector from '../components/dashboard/RangeSelector.jsx'
import QuickStats from '../components/dashboard/QuickStats.jsx'
import SpendingBreakdown from '../components/dashboard/SpendingBreakdown.jsx'
import FlowDetailModal from '../components/dashboard/FlowDetailModal.jsx'

const TOTAL_VIEW = 'all'

export default function DashboardView() {
  const { transactions, settings, isLoading } = useAppData()
  const { currentUser } = useAuth()
  const { openForm, openSettings } = useUI()
  const me = getPerson(currentUser?.uid, settings.userColors)
  const [accountView, setAccountView] = useState(TOTAL_VIEW)
  const [rangeId, setRangeId] = useState(DEFAULT_RANGE_ID)
  const [hovered, setHovered] = useState(null)
  // Quel flux est ouvert en détail : 'in', 'out', ou rien.
  const [detailFlow, setDetailFlow] = useState(null)

  const rate = settings.eurToAud
  const orderedAccounts = useMemo(() => getOrderedAccounts(currentUser?.uid), [currentUser?.uid])

  // Chaque compte garde son solde dans sa propre devise ; seul le total
  // consolidé est converti.
  const balances = useMemo(
    () => getAllBalances(transactions, settings.openingBalances, rate),
    [transactions, settings.openingBalances, rate],
  )
  const netWorthEUR = useMemo(() => getNetWorthEUR(balances, rate), [balances, rate])

  const isTotal = accountView === TOTAL_VIEW
  const selectedAccount = isTotal ? null : getAccount(accountView)

  // Une seule durée pour tout l'écran : la courbe, les totaux et la
  // répartition regardent la même fenêtre de temps.
  const range = getRangeById(rangeId)
  const mode = range.mode
  const period = useMemo(
    () => getRangePeriod(rangeId, { transactions }),
    [rangeId, transactions],
  )

  const summary = useMemo(
    () => summarizePeriod(transactions, {
      accountId: isTotal ? null : accountView,
      from: period.from,
      to: period.to,
      rate,
    }),
    [transactions, rate, accountView, isTotal, period],
  )

  // La courbe n'a de sens que compte par compte : additionner un solde en A$
  // et deux soldes en € donnerait une ligne dépendante du taux du jour.
  const series = useMemo(() => {
    if (isTotal) return []
    const now = new Date()
    // La courbe part du début de la période choisie — sauf « Prévision »,
    // qui commence aujourd'hui — et va jusqu'à un an devant dès qu'on
    // regarde l'avenir.
    const from = mode === 'future' ? now : period.from
    const to = mode === 'past' ? now : addMonths(now, 12)
    return buildAccountSeries(transactions, accountView, getOpeningBalance(settings, accountView), {
      from,
      to,
      rate,
    })
  }, [transactions, settings, accountView, mode, period, rate, isTotal])

  if (isLoading) return <Loader />

  return (
    <div className="fade-in pb-32 lg:pb-12">
      <div className="max-w-3xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 pt-8 lg:pt-10">
        <CapitalHero
          label={isTotal ? 'Patrimoine total' : selectedAccount.label}
          currentBalance={isTotal ? netWorthEUR : balances[accountView]}
          currency={isTotal ? null : selectedAccount.currency}
          hoveredPoint={isTotal ? null : hovered}
          baselineBalance={isTotal ? null : (series[0]?.balance ?? balances[accountView])}
          departureDate={DEPARTURE_DATE}
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

        {/* Sélecteur de compte */}
        <div className="mt-5 flex items-center gap-1 p-1 bg-white/[0.03] rounded-xl overflow-x-auto">
          <TabButton
            active={isTotal}
            onClick={() => setAccountView(TOTAL_VIEW)}
            icon={Wallet}
            label="Total"
            activeClass="bg-white text-black"
          />
          {orderedAccounts.map((account) => (
            <TabButton
              key={account.id}
              active={accountView === account.id}
              onClick={() => setAccountView(account.id)}
              icon={account.icon}
              label={account.short}
              activeClass={`${account.bgClass} ${account.textClass}`}
            />
          ))}
        </div>

        {isTotal ? (
          <AccountGrid accounts={orderedAccounts} balances={balances} onSelect={setAccountView} />
        ) : (
          <div className="mt-4">
            <TradeChart data={series} onHover={setHovered} height={260} baselineIndex={0} />
          </div>
        )}

        <div className="mt-4">
          <RangeSelector value={rangeId} onChange={setRangeId} />
        </div>

        <div className="mt-8 lg:mt-10 lg:grid lg:grid-cols-2 lg:gap-8 xl:gap-12">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/30 mb-3">
              {range.periodLabel}
              {!isTotal && <span className="text-white/50"> · {selectedAccount.label.toLowerCase()}</span>}
            </p>
            <QuickStats
              summary={summary}
              currency={isTotal ? null : selectedAccount.currency}
              onSelectFlow={setDetailFlow}
            />
          </div>

          <div className="mt-8 lg:mt-0">
            <SpendingBreakdown
              accountId={isTotal ? null : accountView}
              from={period.from}
              to={period.to}
              periodLabel={range.periodLabel}
            />
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

      <FlowDetailModal
        open={detailFlow !== null}
        onClose={() => setDetailFlow(null)}
        flow={detailFlow || 'out'}
        periodLabel={range.periodLabel}
        accountId={isTotal ? null : accountView}
        from={period.from}
        to={period.to}
      />
    </div>
  )
}

// Vue « Total » : les trois soldes côte à côte, chacun dans sa devise.
function AccountGrid({ accounts, balances, onSelect }) {
  return (
    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
      {accounts.map((account) => {
        const Icon = account.icon
        const balance = balances[account.id] || 0
        return (
          <button
            key={account.id}
            onClick={() => onSelect(account.id)}
            className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-left hover:bg-white/[0.05] hover:border-white/10 transition"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${account.bgClass} ${account.textClass}`}>
                <Icon size={14} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{account.short}</p>
                <p className="text-[10px] text-white/30">{account.sublabel}</p>
              </div>
            </div>
            <p className={`text-xl font-semibold tabular ${balance < 0 ? 'text-red-400' : 'text-white'}`}>
              <NativeAmount value={balance} currency={account.currency} />
            </p>
          </button>
        )
      })}
    </div>
  )
}

function NativeAmount({ value, currency }) {
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    currencyDisplay: currency === 'AUD' ? 'narrowSymbol' : 'symbol',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
  return <>{formatted}</>
}

function TabButton({ active, onClick, icon: Icon, label, activeClass }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-fit inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
        active ? activeClass : 'text-white/40 hover:text-white/70'
      }`}
    >
      <Icon size={12} strokeWidth={2.4} />
      {label}
    </button>
  )
}

function Loader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <span className="h-6 w-6 border-2 border-white/15 border-t-white/80 rounded-full animate-spin" />
    </div>
  )
}
