import { Repeat, Users } from 'lucide-react'
import { getPerson } from '@/shared/config/people.js'
import { getCategory } from '../../config/categories.js'
import { formatDateShort } from '../../utils/cashflow.js'
import { useAppData } from '../../context/AppDataContext.jsx'
import { useCurrency } from '../../context/CurrencyContext.jsx'

const RECURRENCE_LABEL = {
  'one-off': null,
  'monthly': 'Mensuel',
  'weekly': 'Hebdo',
}

export default function TransactionRow({ tx, onClick }) {
  const { settings } = useAppData()
  const { format: formatEUR } = useCurrency()
  const person = getPerson(tx.personUid, settings.userColors)
  const category = getCategory(tx.category)
  const isIncome = tx.type === 'income'
  const isCommon = tx.account === 'common'
  const Icon = category.icon
  const recurrenceLabel = RECURRENCE_LABEL[tx.recurrence]

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
          {isCommon && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-md flex-shrink-0">
              <Users size={9} strokeWidth={2.4} />
              Commun
            </span>
          )}
          {recurrenceLabel && (
            <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-white/40 flex-shrink-0">
              <Repeat size={10} />
              {recurrenceLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-white/40 truncate">
          <span className={category.textClass}>{category.label}</span>
          <span>·</span>
          {person && (
            <>
              <span className={`inline-flex items-center gap-1 ${person.textClass}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${person.dotClass}`} />
                {person.label}
              </span>
              <span>·</span>
            </>
          )}
          <span>{formatDateShort(tx.date)}</span>
        </div>
      </div>
      <p className={`text-sm font-semibold tabular flex-shrink-0 ${isIncome ? 'text-emerald-400' : 'text-white'}`}>
        {isIncome ? '+' : '−'}{formatEUR(tx.amountEUR)}
      </p>
    </button>
  )
}
