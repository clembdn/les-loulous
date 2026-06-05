import { Input } from '@/shared/ui/Input.jsx'
import { cn } from '@/shared/lib/utils.js'
import { UNITS } from '../utils/quantity.js'

const SELECT_CLS =
  'h-11 px-2 rounded-xl bg-surface-2 border border-border text-sm text-fg shrink-0 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition'

// Saisie d'une quantité structurée : nombre + unité (— = sans unité).
// `quantity` est une chaîne (état de formulaire) ; le parent convertit au save.
export default function QuantityField({ quantity, unit, onChange, className, numberClassName = 'w-20' }) {
  return (
    <div className={cn('flex gap-2', className)}>
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={quantity}
        onChange={(e) => onChange({ quantity: e.target.value, unit })}
        placeholder="Qté"
        aria-label="Quantité"
        className={numberClassName}
      />
      <select
        value={unit || ''}
        onChange={(e) => onChange({ quantity, unit: e.target.value || null })}
        aria-label="Unité"
        className={SELECT_CLS}
      >
        <option value="">—</option>
        {UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
      </select>
    </div>
  )
}
