import { useMemo, useState } from 'react'
import { Plus, AlertTriangle, CheckCircle2, TrendingDown, Calendar, Repeat } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useCurrency } from '../context/CurrencyContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { getOpeningBalance, getSafetyBuffer } from '../services/settingsService.js'
import { JOINT_ACCOUNT_ID, getAccount } from '../config/accounts.js'
import { getCategory, FIXED_CHARGE_CATEGORY_IDS } from '../config/categories.js'
import { getRunway, getTopUpNeeded, buildAccountSeries, addMonths } from '../utils/forecast.js'
import { getMonthlyEquivalent, isRecurring, getRecurrenceLabel } from '../utils/recurrence.js'
import { formatDateShort, formatMonthLong } from '../utils/cashflow.js'
import { COMMON_SUBS } from '../config/navigation.js'
import TradeChart from '../components/chart/TradeChart.jsx'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'

const HORIZON_MONTHS = 6

export default function JointAccountView({ onNavigate }) {
  const { transactions, settings, isLoading } = useAppData()
  const { formatNative } = useCurrency()
  const { openForm } = useUI()
  const [hovered, setHovered] = useState(null)

  const rate = settings.eurToAud
  const opening = getOpeningBalance(settings, JOINT_ACCOUNT_ID)
  const buffer = getSafetyBuffer(settings, JOINT_ACCOUNT_ID)
  const account = getAccount(JOINT_ACCOUNT_ID)

  const runway = useMemo(
    () => getRunway(transactions, JOINT_ACCOUNT_ID, opening, { buffer, rate }),
    [transactions, opening, buffer, rate],
  )

  const topUp = useMemo(
    () => getTopUpNeeded(transactions, JOINT_ACCOUNT_ID, opening, {
      buffer, rate, until: addMonths(new Date(), HORIZON_MONTHS),
    }),
    [transactions, opening, buffer, rate],
  )

  const series = useMemo(() => {
    const now = new Date()
    return buildAccountSeries(transactions, JOINT_ACCOUNT_ID, opening, {
      from: addMonths(now, -2),
      to: addMonths(now, HORIZON_MONTHS),
      rate,
    })
  }, [transactions, opening, rate])

  // Les charges récurrentes qui tapent sur le joint — le socle incompressible.
  const fixedCharges = useMemo(() => {
    const today = new Date()
    return transactions
      .filter((tx) => tx.isActive !== false
        && tx.kind === 'expense'
        && tx.fromAccount === JOINT_ACCOUNT_ID
        && isRecurring(tx)
        && (!tx.endDate || new Date(tx.endDate) >= today))
      .map((tx) => ({ tx, monthly: getMonthlyEquivalent(tx) }))
      .sort((a, b) => b.monthly - a.monthly)
  }, [transactions])

  const fixedTotal = fixedCharges.reduce((sum, c) => sum + c.monthly, 0)
  const essentialTotal = fixedCharges
    .filter((c) => FIXED_CHARGE_CATEGORY_IDS.includes(c.tx.category))
    .reduce((sum, c) => sum + c.monthly, 0)

  if (isLoading) return <Loader />

  const displayBalance = hovered?.balance ?? runway.currentBalance
  const fmt = (v) => formatNative(v, account.currency)

  return (
    <div className="fade-in pb-32 lg:pb-12">
      <div className="max-w-3xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 pt-8 lg:pt-10">
        <SegmentedTabs items={COMMON_SUBS} active="joint" onChange={onNavigate} className="mb-6" />

        <header className="px-1">
          <p className="text-xs uppercase tracking-[0.18em] text-white/30 mb-2">
            Compte joint · Australie
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white tabular leading-none">
            {fmt(displayBalance)}
          </h1>
          <p className="text-xs text-white/40 mt-2">
            {hovered ? formatDateShort(hovered.date) : 'Aujourd\'hui'}
            {runway.monthlyNetFlow !== 0 && !hovered && (
              <span className={runway.monthlyNetFlow >= 0 ? 'text-emerald-400 ml-2' : 'text-white/40 ml-2'}>
                {runway.monthlyNetFlow >= 0 ? '+' : '−'}{fmt(Math.abs(runway.monthlyNetFlow))} / mois
              </span>
            )}
          </p>
        </header>

        <div className="mt-5">
          <TradeChart
            data={series}
            onHover={setHovered}
            height={220}
            baselineIndex={0}
          />
        </div>

        {/* Autonomie du compte — la réponse à « on tient jusqu'à quand ? » */}
        <div className="mt-6 lg:grid lg:grid-cols-2 lg:gap-5">
          <RunwayCard runway={runway} buffer={buffer} fmt={fmt} />
          <TopUpCard topUp={topUp} runway={runway} fmt={fmt} onAdd={() => openForm(null)} />
        </div>

        {/* Charges fixes */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between mb-3 px-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/30">
              Charges récurrentes du joint
            </p>
            <p className="text-xs text-white/50 tabular">
              {fmt(fixedTotal)} / mois
            </p>
          </div>

          {fixedCharges.length === 0 ? (
            <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-8 text-center">
              <p className="text-sm text-white/60 mb-1">Aucune charge récurrente</p>
              <p className="text-xs text-white/30">
                Ajoute le loyer, l'électricité et la box en dépenses récurrentes
                du compte joint pour que la prévision devienne juste.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-1 lg:grid lg:grid-cols-2 lg:gap-1">
                {fixedCharges.map(({ tx, monthly }) => {
                  const category = getCategory(tx.category)
                  const Icon = category.icon
                  const pct = fixedTotal > 0 ? (monthly / fixedTotal) * 100 : 0
                  return (
                    <button
                      key={tx.id}
                      onClick={() => openForm(tx)}
                      className="w-full px-3 py-3 flex items-center gap-3 hover:bg-white/[0.03] rounded-xl transition text-left"
                    >
                      <div className={`h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center ${category.bgClass} ${category.textClass}`}>
                        <Icon size={14} strokeWidth={2.2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <span className="text-sm text-white font-medium truncate">{tx.title}</span>
                          <span className="text-sm font-semibold text-white tabular flex-shrink-0">
                            {fmt(tx.amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/35">
                            <Repeat size={9} />
                            {getRecurrenceLabel(tx.recurrence)}
                          </span>
                          <span className="text-[10px] text-white/30 tabular">
                            ≈ {fmt(monthly)}/mois
                          </span>
                        </div>
                        <div className="h-0.5 bg-white/5 rounded-full overflow-hidden mt-1.5">
                          <div
                            className="h-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: category.hex }}
                          />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {essentialTotal > 0 && (
                <p className="text-[11px] text-white/35 mt-3 px-1">
                  Dont {fmt(essentialTotal)} de charges incompressibles
                  (loyer, électricité, box) — le socle à couvrir chaque mois.
                </p>
              )}
            </>
          )}
        </section>
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

function RunwayCard({ runway, buffer, fmt }) {
  const safe = runway.isSustainable
  const days = runway.daysToBuffer

  return (
    <div className={`rounded-2xl p-5 border ${
      safe
        ? 'bg-emerald-500/[0.06] border-emerald-500/20'
        : days != null && days < 45
          ? 'bg-red-500/[0.06] border-red-500/20'
          : 'bg-amber-500/[0.06] border-amber-500/20'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        {safe
          ? <CheckCircle2 size={15} className="text-emerald-400" />
          : <AlertTriangle size={15} className={days != null && days < 45 ? 'text-red-400' : 'text-amber-400'} />}
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">Autonomie</span>
      </div>

      {safe ? (
        <>
          <p className="text-xl font-semibold text-emerald-400">Le compte se maintient</p>
          <p className="text-xs text-white/45 mt-1.5">
            Avec les revenus et virements programmés, le solde ne passe jamais
            sous le seuil de {fmt(buffer)} dans les 3 prochaines années.
          </p>
        </>
      ) : (
        <>
          <p className="text-xl font-semibold text-white">
            {days === 0 ? 'Seuil atteint' : `${days} jours`}
          </p>
          <p className="text-xs text-white/45 mt-1.5">
            Le solde passe sous le seuil de {fmt(buffer)} le{' '}
            <span className="text-white/70">{formatDateShort(runway.bufferDate)}</span>.
            {runway.zeroDate && (
              <> Compte à zéro le{' '}
                <span className="text-red-400">{formatDateShort(runway.zeroDate)}</span>.
              </>
            )}
          </p>
        </>
      )}

      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">
        <Metric
          icon={TrendingDown}
          label="Flux mensuel"
          value={`${runway.monthlyNetFlow >= 0 ? '+' : '−'}${fmt(Math.abs(runway.monthlyNetFlow))}`}
          valueClass={runway.monthlyNetFlow >= 0 ? 'text-emerald-400' : 'text-white'}
        />
        <Metric
          icon={Calendar}
          label="Point bas"
          value={fmt(runway.lowest.balance)}
          valueClass={runway.lowest.balance < buffer ? 'text-amber-400' : 'text-white'}
          hint={formatMonthLong(runway.lowest.date)}
        />
      </div>
    </div>
  )
}

function TopUpCard({ topUp, runway, fmt, onAdd }) {
  return (
    <div className="mt-4 lg:mt-0 bg-white/[0.03] border border-white/5 rounded-2xl p-5 flex flex-col">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/30 mb-3">
        Réappro sur {HORIZON_MONTHS} mois
      </p>

      {topUp.isNeeded ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-white tabular leading-none">
              {fmt(topUp.perPerson)}
            </span>
            <span className="text-sm text-white/40">chacun</span>
          </div>
          <p className="text-xs text-white/45 mt-2.5">
            Soit {fmt(topUp.total)} à remettre au pot pour tenir jusqu'en{' '}
            {formatMonthLong(addMonths(new Date(), HORIZON_MONTHS))} sans passer
            sous le seuil.
          </p>
          <p className="text-[11px] text-white/30 mt-1.5">
            Point le plus bas : {fmt(topUp.lowest)} le {formatDateShort(topUp.lowestDate)}
          </p>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-emerald-400 tabular leading-none">
              Rien à remettre
            </span>
          </div>
          <p className="text-xs text-white/45 mt-2.5">
            Le compte tient jusqu'en {formatMonthLong(addMonths(new Date(), HORIZON_MONTHS))}
            {' '}avec un point bas à {fmt(topUp.lowest)}.
          </p>
        </>
      )}

      <button
        onClick={onAdd}
        className="mt-auto pt-4 inline-flex items-center justify-center gap-2 text-sm font-medium text-white/70 hover:text-white transition"
      >
        <Plus size={14} />
        Enregistrer un virement
      </button>
    </div>
  )
}

function Metric({ icon: Icon, label, value, valueClass, hint }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-white/35 mb-1">
        <Icon size={11} />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-sm font-semibold tabular ${valueClass || 'text-white'}`}>{value}</p>
      {hint && <p className="text-[10px] text-white/25 capitalize mt-0.5">{hint}</p>}
    </div>
  )
}

function Loader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <span className="h-6 w-6 border-2 border-white/15 border-t-white/80 rounded-full animate-spin" />
    </div>
  )
}
