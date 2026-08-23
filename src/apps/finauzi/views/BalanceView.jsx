import { useMemo, useState } from 'react'
import { CheckCircle2, ArrowRight, Scale, PiggyBank } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useCurrency } from '../context/CurrencyContext.jsx'
import { AUTHORIZED_UIDS, getPerson, getPersonLabel } from '@/shared/config/people.js'
import { getContributions, getDebtLedger } from '../utils/settlement.js'
import { getCategory } from '../config/categories.js'
import { formatDateShort } from '../utils/cashflow.js'
import { COMMON_SUBS } from '../config/navigation.js'
import SettleModal from '../components/balance/SettleModal.jsx'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'

// Les deux compteurs ne se règlent pas au même endroit :
//   • les apports se rééquilibrent soit en virant la MOITIÉ de l'écart à
//     l'autre en France (gratuit, chemin par défaut), soit en versant TOUT
//     l'écart au pot (virement international, quand le pot doit être rempli)
//   • les dettes se soldent en virant à l'autre
// D'où deux blocs distincts, chacun avec son propre bouton d'action.
export default function BalanceView({ onNavigate }) {
  const { transactions, settings, isLoading } = useAppData()
  const { currentUser } = useAuth()
  const { format } = useCurrency()
  const [settling, setSettling] = useState(null)

  const rate = settings.eurToAud
  const userColors = settings.userColors
  const target = Number(settings.contributionTargetEUR) || 0

  const contributions = useMemo(
    () => getContributions(transactions, rate),
    [transactions, rate],
  )
  const debts = useMemo(
    () => getDebtLedger(transactions, rate),
    [transactions, rate],
  )

  const maxContribution = Math.max(
    ...AUTHORIZED_UIDS.map((uid) => contributions.total[uid] || 0),
    1,
  )

  const recentMonths = useMemo(() => {
    return Object.entries(contributions.byMonth)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6)
  }, [contributions.byMonth])

  if (isLoading) return <Loader />

  return (
    <div className="fade-in pb-32 lg:pb-12">
      <div className="max-w-3xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 pt-8 lg:pt-10">
        <SegmentedTabs items={COMMON_SUBS} active="balance" onChange={onNavigate} className="mb-6" />

        <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Équilibre</h1>
        <p className="text-xs text-white/40 mb-8">
          Ce que chacun a mis au pot, et ce que chacun doit à l'autre.
        </p>

        <div className="lg:grid lg:grid-cols-2 lg:gap-6 xl:gap-8 space-y-6 lg:space-y-0">

          {/* ─── Apports au pot commun ─────────────────────────────── */}
          <section className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <PiggyBank size={15} className="text-sky-400" />
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                Apports au compte joint
              </span>
            </div>

            {contributions.isBalanced ? (
              <div className="flex items-start gap-2.5 mb-5">
                <CheckCircle2 size={17} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-base font-semibold text-emerald-400">Versements à égalité</p>
                  <p className="text-xs text-white/45 mt-0.5">
                    Vous avez mis exactement la même somme dans le pot.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mb-5">
                <p className="text-2xl font-semibold text-white tabular leading-none">
                  {format(contributions.amountToRebalance)}
                </p>
                <p className="text-xs text-white/45 mt-2">
                  <span className="text-white/70">{getPersonLabel(contributions.behindUid)}</span>
                  {' '}vire ça à {getPersonLabel(contributions.aheadUid)} depuis son compte
                  français : virement gratuit, et l'écart est refermé.
                </p>
                <p className="text-[11px] text-white/30 mt-2 leading-relaxed">
                  Ou {format(contributions.amountToEqualize)} versés directement au pot,
                  si le compte joint a besoin d'être réalimenté — mais c'est un virement
                  international, avec frais et change.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {AUTHORIZED_UIDS.map((uid) => {
                const person = getPerson(uid, userColors)
                const amount = contributions.total[uid] || 0
                const pct = (amount / maxContribution) * 100
                return (
                  <div key={uid}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className={`inline-flex items-center gap-2 text-sm font-medium ${person.textClass}`}>
                        <span className={`h-2 w-2 rounded-full ${person.dotClass}`} />
                        {person.label}
                      </span>
                      <span className="text-sm font-semibold text-white tabular">
                        {format(amount)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${person.dotClass} transition-all duration-500 ease-out`}
                        style={{ width: `${Math.max(pct, 0)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => setSettling({
                mode: 'contribution',
                fromUid: contributions.behindUid || currentUser?.uid,
                // À égalité, il n'y a personne à qui virer : le seul geste
                // qui reste est d'alimenter le pot.
                toUid: contributions.aheadUid,
                suggestedEUR: contributions.isBalanced ? target : contributions.amountToEqualize,
                suggestedDirectEUR: contributions.amountToRebalance,
              })}
              className="w-full mt-5 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-sm font-medium hover:bg-sky-500/15 transition"
            >
              {contributions.isBalanced ? 'Enregistrer un apport' : 'Rééquilibrer'}
            </button>
          </section>

          {/* ─── Dettes croisées ───────────────────────────────────── */}
          <section className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Scale size={15} className="text-teal-400" />
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                Qui doit quoi
              </span>
            </div>

            {debts.isSettled ? (
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={17} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-base font-semibold text-emerald-400">Tout est réglé</p>
                  <p className="text-xs text-white/45 mt-0.5">
                    Personne ne doit rien à personne.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5 mb-2">
                  <PersonChip uid={debts.debtorUid} userColors={userColors} />
                  <ArrowRight size={14} className="text-white/25" />
                  <PersonChip uid={debts.creditorUid} userColors={userColors} />
                </div>
                <p className="text-2xl font-semibold text-white tabular leading-none mt-3">
                  {format(debts.amount)}
                </p>
                <p className="text-xs text-white/45 mt-2">
                  {getPersonLabel(debts.debtorUid)} doit ça à {getPersonLabel(debts.creditorUid)},
                  d'après les dépenses avancées et les achats perso passés sur le joint.
                </p>

                <button
                  onClick={() => setSettling({
                    mode: 'debt',
                    fromUid: debts.debtorUid,
                    toUid: debts.creditorUid,
                    suggestedEUR: debts.amount,
                  })}
                  className="w-full mt-5 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-medium hover:bg-teal-500/15 transition"
                >
                  Régler {format(debts.amount)}
                </button>
              </>
            )}

            {debts.reasons.length > 0 && (
              <div className="mt-5 pt-5 border-t border-white/5">
                <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">
                  D'où ça vient
                </p>
                <div className="space-y-1">
                  {debts.reasons.slice(0, 6).map((reason, i) => (
                    <ReasonRow key={`${reason.tx.id}-${i}`} reason={reason} userColors={userColors} format={format} />
                  ))}
                </div>
                {debts.reasons.length > 6 && (
                  <p className="text-[10px] text-white/25 mt-2">
                    et {debts.reasons.length - 6} autre{debts.reasons.length - 6 > 1 ? 's' : ''} ligne{debts.reasons.length - 6 > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ─── Historique des apports ─────────────────────────────── */}
        {recentMonths.length > 0 && (
          <section className="mt-10">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/30 mb-3 px-1">
              Apports mois par mois
            </p>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
              {recentMonths.map(([key, byPerson]) => {
                const gap = (byPerson[AUTHORIZED_UIDS[0]] || 0) - (byPerson[AUTHORIZED_UIDS[1]] || 0)
                const even = Math.abs(gap) < 1
                return (
                  <div key={key} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
                    <span className="text-xs text-white/50 w-20 flex-shrink-0 capitalize">
                      {monthLabelFromKey(key)}
                    </span>
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      {AUTHORIZED_UIDS.map((uid) => {
                        const person = getPerson(uid, userColors)
                        return (
                          <span key={uid} className="inline-flex items-center gap-1.5 text-xs tabular min-w-0">
                            <span className={`h-1.5 w-1.5 rounded-full ${person.dotClass} flex-shrink-0`} />
                            <span className="text-white/70 truncate">{format(byPerson[uid] || 0)}</span>
                          </span>
                        )
                      })}
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider flex-shrink-0 ${even ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {even ? 'à égalité' : `écart ${format(Math.abs(gap))}`}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>

      {settling && (
        <SettleModal
          {...settling}
          currentUid={currentUser?.uid}
          onClose={() => setSettling(null)}
        />
      )}
    </div>
  )
}

function ReasonRow({ reason, userColors, format }) {
  const person = getPerson(reason.uid, userColors)
  const category = getCategory(reason.tx.category)
  const Icon = category.icon
  const positive = reason.amountEUR > 0

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon size={12} className={`${category.textClass} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/70 truncate">{reason.tx.title}</p>
        <p className="text-[10px] text-white/30 truncate">
          <span className={person.textClass}>{person.label}</span> {reason.label}
          {' · '}{formatDateShort(reason.date)}
        </p>
      </div>
      <span className={`text-[11px] font-medium tabular flex-shrink-0 ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
        {positive ? '+' : '−'}{format(Math.abs(reason.amountEUR))}
      </span>
    </div>
  )
}

function PersonChip({ uid, userColors }) {
  const person = getPerson(uid, userColors)
  if (!person) return null
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${person.bgClass} ${person.textClass} ${person.borderClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${person.dotClass}`} />
      {person.label}
    </span>
  )
}

function monthLabelFromKey(key) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

function Loader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <span className="h-6 w-6 border-2 border-white/15 border-t-white/80 rounded-full animate-spin" />
    </div>
  )
}
