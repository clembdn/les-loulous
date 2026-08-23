import { Repeat, ArrowRight } from 'lucide-react'
import { getPerson } from '@/shared/config/people.js'
import { getCategory } from '../../config/categories.js'
import { SETTLES_DEBT, SETTLES_CONTRIBUTION } from '../../utils/ledger.js'
import { getAccount, SPLIT_COMMON, JOINT_ACCOUNT_ID } from '../../config/accounts.js'
import { getRecurrenceLabel } from '../../utils/recurrence.js'
import { formatDateShort } from '../../utils/cashflow.js'
import { useAppData } from '../../context/AppDataContext.jsx'
import { useCurrency } from '../../context/CurrencyContext.jsx'

// Le montant s'affiche dans la devise du compte qui bouge : un loyer
// australien reste un loyer en A$, pas une conversion approximative.
export default function TransactionRow({ tx, onClick }) {
  const { settings } = useAppData()
  const { formatNative } = useCurrency()
  const category = getCategory(tx.category)
  const Icon = category.icon
  const recurrenceLabel = getRecurrenceLabel(tx.recurrence)

  const isTransfer = tx.kind === 'transfer'
  const isIncome = tx.kind === 'income'
  const account = getAccount(isIncome ? tx.toAccount : tx.fromAccount)

  const sign = isTransfer ? '' : (isIncome ? '+' : '−')
  const amountClass = isTransfer ? 'text-sky-400' : (isIncome ? 'text-emerald-400' : 'text-white')

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/[0.03] transition text-left rounded-xl"
    >
      <div className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center ${category.bgClass} ${category.textClass}`}>
        <Icon size={16} strokeWidth={2.2} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate">{tx.title}</p>
          {recurrenceLabel && (
            <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-white/40 flex-shrink-0">
              <Repeat size={10} />
              {recurrenceLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-white/40 min-w-0">
          {isTransfer ? (
            <TransferRoute tx={tx} />
          ) : (
            <>
              <span className={account.textClass}>{account.short}</span>
              <span>·</span>
              <SplitTag split={tx.split} userColors={settings.userColors} />
            </>
          )}
          <span>·</span>
          <span className="truncate">{formatDateShort(tx.date)}</span>
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className={`text-sm font-semibold tabular ${amountClass}`}>
          {sign}{formatNative(tx.amount, tx.currency)}
        </p>
        {/* Sur un virement inter-devises, on montre ce qui est vraiment arrivé. */}
        {isTransfer && tx.amountReceived != null && (
          <p className="text-[10px] text-white/30 tabular mt-0.5">
            → {formatNative(tx.amountReceived, getAccount(tx.toAccount).currency)}
          </p>
        )}
      </div>
    </button>
  )
}

function TransferRoute({ tx }) {
  const from = getAccount(tx.fromAccount)
  const to = getAccount(tx.toAccount)
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span className={`${from.textClass} truncate`}>{from.short}</span>
      <ArrowRight size={10} className="text-white/25 flex-shrink-0" />
      <span className={`${to.textClass} truncate`}>{to.short}</span>
      {tx.settles === SETTLES_DEBT && (
        <span className="text-teal-400 ml-1 flex-shrink-0">· remb.</span>
      )}
      {tx.settles === SETTLES_CONTRIBUTION && (
        <span className="text-sky-400 ml-1 flex-shrink-0">· rééquil.</span>
      )}
      {!tx.settles && to.id === JOINT_ACCOUNT_ID && (
        <span className="text-sky-400 ml-1 flex-shrink-0">· apport</span>
      )}
    </span>
  )
}

function SplitTag({ split, userColors }) {
  if (split === SPLIT_COMMON) {
    return <span className="text-sky-400">Commun</span>
  }
  const person = getPerson(split, userColors)
  if (!person) return <span>—</span>
  return (
    <span className={`inline-flex items-center gap-1 ${person.textClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${person.dotClass}`} />
      {person.label}
    </span>
  )
}
