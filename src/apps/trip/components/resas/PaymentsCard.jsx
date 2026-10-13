import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { formatDateFr } from '@/shared/lib/dates.js'
import { formatPrice, plural } from '../../utils/format.js'
import { paymentSummary } from '../../utils/payment.js'
import { resaTitle } from './resaDisplay.jsx'
import EurHint, { EurTotalHint } from '../EurHint.jsx'

const totals = (list) => list.map((t) => formatPrice(t.total, t.currency)).join(' · ')

/**
 * Qui a payé quoi : ce que chacun a déjà versé (par devise, jamais converti),
 * ce qui reste à payer sur place, et les échéances, de la plus proche à la
 * plus lointaine. Rien tant qu'aucune réservation ne dit où en est son paiement.
 */
export default function PaymentsCard({ entries, onOpen, className }) {
  const summary = useMemo(() => paymentSummary(entries), [entries])
  if (!summary.paid.length && !summary.onsite.length && !summary.due.length) return null

  return (
    <section className={cn('rounded-2xl bg-surface shadow-sm px-4 py-3.5', className)}>
      <h2 className="text-[15px] font-semibold text-fg">Paiements</h2>
      <dl className="mt-2 space-y-1.5 text-[14px]">
        {summary.paid.map((p) => (
          <Row key={p.payer || '?'} label={p.payer ? `Payé par ${p.label}` : 'Payé, payeur à préciser'} list={p.totals} />
        ))}
        {summary.onsite.length > 0 && (
          <Row label="À payer sur place" list={summary.onsite} tone="todo" />
        )}
      </dl>

      {summary.due.length > 0 && (
        <ul className="mt-2.5 -mx-2">
          {summary.due.map(({ kind, item, amount, currency, dueDate }) => (
            <li key={`${kind}-${item.id}`}>
              <button
                type="button"
                onClick={() => onOpen(kind, item.id)}
                className="w-full flex items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-surface-2"
              >
                <span className="shrink-0 rounded-lg bg-amber-100 px-2 py-1 text-[12px] font-semibold text-amber-900 tabular">
                  {dueDate ? `Avant le ${formatDateFr(dueDate)}` : 'À payer'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-fg">{resaTitle(kind, item)}</span>
                {amount != null && (
                  <span className="shrink-0 text-right text-[14px] font-semibold text-fg tabular">
                    {formatPrice(amount, currency)}
                    <EurHint amount={amount} currency={currency} className="block text-[12px] font-normal text-muted" />
                  </span>
                )}
                <ChevronRight size={15} className="shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {summary.unknown > 0 && (
        <p className="mt-2 text-[13px] text-muted">
          {plural(summary.unknown, 'réservation', 'réservations')} sans état de paiement.
        </p>
      )}
    </section>
  )
}

function Row({ label, list, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn('min-w-0 truncate', tone === 'todo' ? 'text-amber-800 font-medium' : 'text-muted')}>{label}</dt>
      <dd className={cn('min-w-0 text-right font-semibold tabular', tone === 'todo' ? 'text-amber-900' : 'text-fg')}>
        {totals(list)}
        <EurTotalHint totals={list} className="block text-[12px] font-normal text-muted" />
      </dd>
    </div>
  )
}
