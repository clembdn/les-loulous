import { useMemo, useState } from 'react'
import { CheckCircle2, ArrowRight, Scale, PiggyBank } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useCurrency } from '../context/CurrencyContext.jsx'
import { AUTHORIZED_UIDS, getPerson, getPersonLabel } from '@/shared/config/people.js'
import { getBalanceSummary } from '../utils/settlement.js'
import { getCategory } from '../config/categories.js'
import { formatDateShort } from '../utils/cashflow.js'
import { COMMON_SUBS } from '../config/navigation.js'
import SettleModal from '../components/balance/SettleModal.jsx'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'

// UN chiffre en tête, et un seul geste pour le solder.
//
// Avant, deux compteurs séparés — « qui a mis le plus au pot » et « qui doit
// quoi à qui » — obligeaient à faire deux virements pour un seul déséquilibre,
// parfois en sens inverse l'un de l'autre. Ils sont maintenant additionnés
// (voir settlement.js) : une avance de 500 € et un retard d'apports de 200 €
// se compensent, et il ne reste qu'un virement à faire.
//
// Les composantes restent affichées en dessous, mais comme EXPLICATION du
// chiffre, jamais comme actions séparées.
export default function BalanceView({ onNavigate }) {
  const { transactions, settings, isLoading } = useAppData()
  const { currentUser } = useAuth()
  const { format } = useCurrency()
  const [settling, setSettling] = useState(null)

  const rate = settings.eurToAud
  const userColors = settings.userColors
  // Ce que chacun s'est engagé à verser au pot chaque mois — le montant
  // pré-rempli quand on vient l'alimenter.
  const contributionTarget = Number(settings.contributionTargetEUR) || 0

  const balance = useMemo(
    () => getBalanceSummary(transactions, rate),
    [transactions, rate],
  )
  const { contributions, advances, settlements } = balance

  const maxContribution = Math.max(
    ...AUTHORIZED_UIDS.map((uid) => contributions.total[uid] || 0),
    1,
  )

  const recentMonths = useMemo(() => {
    return Object.entries(contributions.byMonth)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6)
  }, [contributions.byMonth])

  // Le détail du chiffre, du point de vue de celui à qui on doit. Les trois
  // lignes s'additionnent exactement au solde affiché.
  const breakdown = useMemo(() => {
    const uid = balance.creditorUid || AUTHORIZED_UIDS[0]
    return [
      {
        key: 'contributions',
        label: 'Écart d\'apports au pot',
        hint: 'la moitié de l\'écart, le pot étant financé 50/50',
        value: contributions.credit[uid],
      },
      {
        key: 'advances',
        label: 'Avances et dépenses perso',
        hint: 'dépenses communes avancées, perso passé sur le joint',
        value: advances.net[uid],
      },
      {
        key: 'settlements',
        label: 'Règlements déjà faits',
        hint: 'les virements de l\'un à l\'autre',
        value: settlements.net[uid],
      },
    ].filter((row) => Math.abs(row.value) >= 0.01)
  }, [balance.creditorUid, contributions.credit, advances.net, settlements.net])

  if (isLoading) return <Loader />

  return (
    <div className="fade-in pb-32 lg:pb-12">
      <div className="max-w-3xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 pt-8 lg:pt-10">
        <SegmentedTabs items={COMMON_SUBS} active="balance" onChange={onNavigate} className="mb-6" />

        <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Équilibre</h1>
        <p className="text-xs text-white/40 mb-8">
          Tout compris : apports au pot, avances, règlements déjà faits.
        </p>

        {/* ─── Le solde, seul chiffre actionnable ──────────────────── */}
        <section className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 lg:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Scale size={15} className="text-teal-400" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Solde entre vous
            </span>
          </div>

          {balance.isSettled ? (
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={17} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-base font-semibold text-emerald-400">Tout est équilibré</p>
                <p className="text-xs text-white/45 mt-0.5">
                  Personne ne doit rien à personne, apports compris.
                </p>
              </div>
            </div>
          ) : (
            <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <PersonChip uid={balance.debtorUid} userColors={userColors} />
                  <ArrowRight size={14} className="text-white/25" />
                  <PersonChip uid={balance.creditorUid} userColors={userColors} />
                </div>
                <p className="text-3xl font-semibold text-white tabular leading-none">
                  {format(balance.amount)}
                </p>
                <p className="text-xs text-white/45 mt-2 leading-relaxed">
                  {getPersonLabel(balance.debtorUid)} doit ça à {getPersonLabel(balance.creditorUid)},
                  tout compris. Un seul virement de compte français à compte
                  français remet le compteur à zéro.
                </p>

                <button
                  onClick={() => setSettling({
                    mode: 'settle',
                    fromUid: balance.debtorUid,
                    toUid: balance.creditorUid,
                    suggestedEUR: balance.amount,
                  })}
                  className="w-full mt-5 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-medium hover:bg-teal-500/15 transition"
                >
                  Régler {format(balance.amount)}
                </button>
              </div>

              {/* D'où sort le chiffre — explication, pas action. */}
              {breakdown.length > 0 && (
                <div className="mt-6 lg:mt-0 pt-5 lg:pt-0 border-t lg:border-t-0 lg:border-l border-white/5 lg:pl-8">
                  <p className="text-[10px] uppercase tracking-wider text-white/30 mb-3">
                    En faveur de {getPersonLabel(balance.creditorUid)}
                  </p>
                  <div className="space-y-2.5">
                    {breakdown.map((row) => (
                      <div key={row.key} className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-white/70">{row.label}</p>
                          <p className="text-[10px] text-white/30 leading-snug">{row.hint}</p>
                        </div>
                        <span className={`text-xs font-medium tabular flex-shrink-0 ${row.value > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {row.value > 0 ? '+' : '−'}{format(Math.abs(row.value))}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-baseline justify-between gap-3 pt-2.5 border-t border-white/5">
                      <p className="text-xs font-medium text-white">Solde</p>
                      <span className="text-sm font-semibold text-white tabular">
                        {format(balance.amount)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="lg:grid lg:grid-cols-2 lg:gap-6 xl:gap-8 space-y-6 lg:space-y-0">

          {/* ─── Apports au pot commun ─────────────────────────────── */}
          <section className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <PiggyBank size={15} className="text-sky-400" />
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                Apports au compte joint
              </span>
            </div>

            <p className="text-xs text-white/45 mb-5 leading-relaxed">
              {contributions.isBalanced
                ? 'Vous avez mis exactement la même somme dans le pot.'
                : <>
                    <span className="text-white/70">{getPersonLabel(contributions.aheadUid)}</span>
                    {' '}a mis {format(contributions.amountToEqualize)} de plus que
                    {' '}{getPersonLabel(contributions.behindUid)}. C'est déjà compté dans
                    le solde ci-dessus — inutile de le régler à part.
                  </>}
            </p>

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

            {/* Alimenter le pot est une question de trésorerie, pas d'équité :
                c'est « le compte joint a-t-il de quoi payer le loyer ». */}
            <button
              onClick={() => setSettling({
                mode: 'contribution',
                fromUid: currentUser?.uid,
                suggestedEUR: contributionTarget,
              })}
              className="w-full mt-5 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-sm font-medium hover:bg-sky-500/15 transition"
            >
              Alimenter le compte joint
            </button>
          </section>

          {/* ─── D'où viennent les avances ─────────────────────────── */}
          <section className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Scale size={15} className="text-teal-400" />
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                Avances et dépenses perso
              </span>
            </div>

            {advances.reasons.length === 0 ? (
              <p className="text-xs text-white/40">
                Aucune dépense commune avancée d'un compte perso, aucun achat
                perso passé sur le joint.
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  {advances.reasons.slice(0, 8).map((reason, i) => (
                    <ReasonRow key={`${reason.tx.id}-${i}`} reason={reason} userColors={userColors} format={format} />
                  ))}
                </div>
                {advances.reasons.length > 8 && (
                  <p className="text-[10px] text-white/25 mt-2">
                    et {advances.reasons.length - 8} autre{advances.reasons.length - 8 > 1 ? 's' : ''} ligne{advances.reasons.length - 8 > 1 ? 's' : ''}
                  </p>
                )}
              </>
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
