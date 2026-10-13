import { cn } from '@/shared/lib/utils.js'
import { useEurRates } from '../hooks/useEurRates.js'
import { eurTotal, showsEur, toEur } from '../utils/fx.js'
import { formatPrice } from '../utils/format.js'

const approx = (eur) => `≈ ${formatPrice(Math.round(eur), 'EUR')}`

/**
 * « ≈ 194 € » à côté d'un prix dans une autre devise, au taux du jour
 * (arrondi : c'est un repère, le prix d'origine fait foi). Rien pour un prix
 * en euros, ni sans taux connu.
 */
export default function EurHint({ amount, currency, className }) {
  const rates = useEurRates()
  if (!showsEur(currency, rates)) return null
  const eur = toEur(amount, currency, rates)
  if (eur == null) return null
  return <span className={cn('tabular whitespace-nowrap', className)}>{approx(eur)}</span>
}

/**
 * Le total en euros de plusieurs montants `{ total, currency }` — seulement
 * s'il y a autre chose que des euros. `missing` : montants sans taux, laissés
 * de côté (et dits).
 */
export function EurTotalHint({ totals, className, suffix = '' }) {
  const rates = useEurRates()
  if (!totals.some((t) => t.currency && t.currency !== 'EUR')) return null
  const { total, missing } = eurTotal(totals, rates)
  if (missing === totals.length) return null
  return (
    <span className={cn('tabular', className)}>
      {approx(total)}{suffix}{missing > 0 ? ` (sans ${totals.filter((t) => !showsEur(t.currency, rates) && t.currency !== 'EUR').map((t) => t.currency).join(', ')})` : ''}
    </span>
  )
}
