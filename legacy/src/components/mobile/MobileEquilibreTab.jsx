import { useMemo, useState } from 'react'
import { Scale, ArrowRight, ArrowLeftRight, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { calculateCurrentMonthSettlement } from '../../utils/settlement.js'
import { getPersonWithColor, CLEMENT_UID, LISE_UID } from '../../config/people.js'
import { isTransactionActiveForMonth, isOneOffInMonth, getAllocatedAmountForPerson } from '../../utils/cashflow.js'
import CategoryBadge from '../australia/CategoryBadge.jsx'
import PersonEvolutionChart from '../australia/PersonEvolutionChart.jsx'
import { MobilePersonBreakdown } from '../australia/PersonBreakdown.jsx'

export default function MobileEquilibreTab({ data }) {
  const { transactions, format, settings, personBreakdown } = data
  const [selectedDate, setSelectedDate] = useState(new Date())

  const year = selectedDate.getFullYear()
  const month = selectedDate.getMonth()

  const monthLabel = selectedDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const formattedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

  // Get contributing transactions
  const contributingTx = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.type !== 'expense') return false
      if (tx.recurrence === 'monthly' && !isTransactionActiveForMonth(tx, year, month)) return false
      if (tx.recurrence === 'one-off' && !isOneOffInMonth(tx, year, month)) return false
      return true
    }).sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [transactions, year, month])

  const settlement = useMemo(() => calculateCurrentMonthSettlement(contributingTx), [contributingTx])

  const isBalanced = settlement.isBalanced
  const payer = getPersonWithColor(settlement.payerUid, settings?.personColors)
  const receiver = getPersonWithColor(settlement.receiverUid, settings?.personColors)

  const clementColor = getPersonWithColor(CLEMENT_UID, settings?.personColors)
  const liseColor = getPersonWithColor(LISE_UID, settings?.personColors)



  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="px-1 mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Équilibre</h2>
          <p className="text-sm text-text-muted">Qui doit quoi pour {formattedMonth} ?</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate(new Date(year, month - 1, 1))}
            className="h-8 w-8 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center active:scale-95 transition-all text-text-secondary hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setSelectedDate(new Date(year, month + 1, 1))}
            className="h-8 w-8 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center active:scale-95 transition-all text-text-secondary hover:text-text-primary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main State Card */}
      <div className={`relative rounded-3xl border overflow-hidden transition-all duration-300 ${isBalanced ? 'bg-gradient-to-b from-emerald-500/10 to-bg-card border-emerald-500/20' : 'bg-gradient-to-b from-blue-500/10 to-bg-card border-blue-500/20'}`}>
        <div className="relative z-10 px-6 py-8 flex flex-col items-center text-center">
          {isBalanced ? (
            <>
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400 ring-4 ring-emerald-500/10">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight mb-2">Tout est équilibré</h3>
              <p className="text-sm text-emerald-400/80">Aucun remboursement nécessaire ce mois-ci.</p>
            </>
          ) : (
            <>
              <div className="h-16 w-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 text-brand ring-4 ring-blue-500/10">
                <Scale className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight mb-2">
                <span className={payer?.text}>{payer?.shortLabel}</span> doit{' '}
                <span className="tabular-nums">{format(settlement.amountEUR)}</span> à{' '}
                <span className={receiver?.text}>{receiver?.shortLabel}</span>
              </h3>
              <p className="text-sm text-text-muted">Basé sur les dépenses partagées de {formattedMonth}.</p>
            </>
          )}
        </div>
        <div className="absolute top-[-20%] left-[-10%] w-64 h-64 rounded-full bg-brand/5 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      {/* Detail section */}
      <div className="bg-bg-card rounded-2xl border border-border-subtle overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle/60">
          <h4 className="text-xs font-medium uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Détails des calculs
          </h4>
        </div>
        
        <div className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted mb-1">Clément a payé</p>
              <p className="text-lg font-bold tabular-nums text-text-primary">{format(settlement.paidTotalsByPerson[CLEMENT_UID] || 0)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-text-muted mb-1">Lise a payé</p>
              <p className="text-lg font-bold tabular-nums text-text-primary">{format(settlement.paidTotalsByPerson[LISE_UID] || 0)}</p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-border-subtle/50"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-bg-card px-2 text-[10px] uppercase tracking-wider text-text-muted font-medium">Part réelle</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className={`text-lg font-bold tabular-nums ${clementColor.text}`}>{format(settlement.fairShareByPerson[CLEMENT_UID] || 0)}</p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold tabular-nums ${liseColor.text}`}>{format(settlement.fairShareByPerson[LISE_UID] || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contributing Transactions */}
      {contributingTx.length > 0 && (
        <div className="pt-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3 px-1">Dépenses prises en compte</h4>
          <div className="space-y-2">
            {contributingTx.map(tx => {
              const txPayer = getPersonWithColor(tx.paidByUid, settings?.personColors)
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
                <div key={tx.id} className="bg-bg-card border border-border-subtle rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <CategoryBadge category={tx.category} />
                    <div className="overflow-hidden">
                      <p className="font-semibold text-sm truncate text-text-primary">{tx.title}</p>
                      <p className="text-xs text-text-muted mt-0.5 truncate">
                        <span className={txPayer?.text}>{txPayer?.shortLabel} a payé</span>
                        <span className="mx-1.5 opacity-50">·</span>
                        {reimbTitle}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-semibold tabular-nums">{format(tx.amountEUR)}</p>
                    {debt > 0 && (
                      <p className="text-xs text-text-muted mt-0.5">dette : {format(debt)}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Person Evolution Chart */}
      <PersonEvolutionChart transactions={transactions} format={format} settings={settings} />

      {/* Mobile Person Breakdown */}
      {personBreakdown && (
        <div className="pt-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3 px-1">Répartition globale</h4>
          <MobilePersonBreakdown personBreakdown={personBreakdown} format={format} settings={settings} />
        </div>
      )}
    </div>
  )
}
