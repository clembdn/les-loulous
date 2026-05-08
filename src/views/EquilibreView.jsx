import { useMemo } from 'react'
import { Scale, ArrowLeftRight, CheckCircle2 } from 'lucide-react'
import { useAustraliaData } from '../hooks/useAustraliaData.js'
import { calculateCurrentMonthSettlement } from '../utils/settlement.js'
import { getPersonByUid, CLEMENT_UID, LISE_UID } from '../config/people.js'
import { isTransactionActiveForMonth, isOneOffInMonth, getAllocatedAmountForPerson } from '../utils/cashflow.js'
import CategoryBadge from '../components/australia/CategoryBadge.jsx'

export default function EquilibreView() {
  const { transactions, format, isLoading } = useAustraliaData()

  const settlement = useMemo(() => calculateCurrentMonthSettlement(transactions || []), [transactions])

  const now = new Date()
  const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const formattedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

  const isBalanced = settlement.isBalanced
  const payer = getPersonByUid(settlement.payerUid)
  const receiver = getPersonByUid(settlement.receiverUid)

  const contributingTx = useMemo(() => {
    if (!transactions) return []
    const year = now.getFullYear()
    const month = now.getMonth()

    return transactions.filter(tx => {
      if (tx.type !== 'expense') return false
      if (tx.recurrence === 'monthly' && !isTransactionActiveForMonth(tx, year, month)) return false
      if (tx.recurrence === 'one-off' && !isOneOffInMonth(tx, year, month)) return false
      return true
    }).sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [transactions, now])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="inline-block h-6 w-6 border-2 border-brand/30 border-t-brand-glow rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Scale className="h-6 w-6 text-brand" /> Équilibre
        </h1>
        <p className="text-sm text-text-secondary">
          Qui doit quoi ce mois-ci ? ({formattedMonth})
        </p>
      </div>

      {/* Main State Card */}
      <div className={`relative rounded-3xl border overflow-hidden transition-all duration-300 ${isBalanced ? 'bg-gradient-to-b from-emerald-500/10 to-bg-card border-emerald-500/20' : 'bg-gradient-to-b from-blue-500/10 to-bg-card border-blue-500/20'}`}>
        <div className="relative z-10 px-8 py-12 flex flex-col items-center text-center">
          {isBalanced ? (
            <>
              <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6 text-emerald-400 ring-4 ring-emerald-500/10">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-3xl font-bold tracking-tight mb-3">Tout est équilibré</h3>
              <p className="text-emerald-400/80">Aucun remboursement nécessaire ce mois-ci.</p>
            </>
          ) : (
            <>
              <div className="h-20 w-20 rounded-full bg-blue-500/20 flex items-center justify-center mb-6 text-brand ring-4 ring-blue-500/10">
                <Scale className="h-10 w-10" />
              </div>
              <h3 className="text-3xl font-bold tracking-tight mb-3">
                <span className={payer?.text}>{payer?.shortLabel}</span> doit{' '}
                <span className="tabular-nums">{format(settlement.amountEUR)}</span> à{' '}
                <span className={receiver?.text}>{receiver?.shortLabel}</span>
              </h3>
              <p className="text-text-muted">Basé sur les dépenses partagées de {formattedMonth}.</p>
            </>
          )}
        </div>
        <div className="absolute top-[-20%] left-[-10%] w-64 h-64 rounded-full bg-brand/5 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Detail section */}
        <div className="bg-bg-card rounded-2xl border border-border-subtle overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle/60">
            <h4 className="text-sm font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <ArrowLeftRight className="h-4 w-4" />
              Détails des calculs
            </h4>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-muted mb-1">Clément a payé</p>
                <p className="text-2xl font-bold tabular-nums text-text-primary">{format(settlement.paidTotalsByPerson[CLEMENT_UID] || 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-muted mb-1">Lise a payé</p>
                <p className="text-2xl font-bold tabular-nums text-text-primary">{format(settlement.paidTotalsByPerson[LISE_UID] || 0)}</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-border-subtle/50"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-bg-card px-3 text-xs uppercase tracking-wider text-text-muted font-medium">Part réelle</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold tabular-nums text-emerald-400">{format(settlement.fairShareByPerson[CLEMENT_UID] || 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-blue-400">{format(settlement.fairShareByPerson[LISE_UID] || 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contributing Transactions */}
        <div className="bg-bg-card rounded-2xl border border-border-subtle overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle/60">
            <h4 className="text-sm font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              Dépenses prises en compte
            </h4>
          </div>
          <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
            {contributingTx.length > 0 ? contributingTx.map(tx => {
              const txPayer = getPersonByUid(tx.paidByUid)
              const clementShare = getAllocatedAmountForPerson(tx, CLEMENT_UID)
              const liseShare = getAllocatedAmountForPerson(tx, LISE_UID)
              const total = tx.amountEUR
              
              let reimbTitle = "Pas de remboursement"
              let debt = 0
              if (clementShare > 0 && liseShare > 0) {
                // Shared expense
                if (txPayer?.uid === CLEMENT_UID) {
                  reimbTitle = `Lise rembourse ${Math.round((liseShare / total) * 100)}%`
                  debt = liseShare
                } else if (txPayer?.uid === LISE_UID) {
                  reimbTitle = `Clément rembourse ${Math.round((clementShare / total) * 100)}%`
                  debt = clementShare
                }
              }

              return (
                <div key={tx.id} className="bg-bg-elevated border border-border-subtle rounded-xl p-3 flex items-center justify-between hover:border-border-strong transition-colors">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <CategoryBadge category={tx.category} />
                    <div className="overflow-hidden">
                      <p className="font-medium text-sm truncate text-text-primary">{tx.title}</p>
                      <p className="text-xs text-text-muted mt-0.5 truncate">
                        <span className={txPayer?.text}>{txPayer?.shortLabel} a payé</span>
                        <span className="mx-1.5 opacity-50">·</span>
                        {reimbTitle}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-semibold tabular-nums text-sm">{format(tx.amountEUR)}</p>
                    {debt > 0 && (
                      <p className="text-[10px] text-text-muted mt-0.5">dette : {format(debt)}</p>
                    )}
                  </div>
                </div>
              )
            }) : (
              <p className="text-sm text-text-muted text-center py-6">Aucune dépense ce mois-ci.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
