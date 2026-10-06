import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { Input } from '@/shared/ui/Input.jsx'
import Field from '../Field.jsx'
import { CURRENCIES } from '../../config/reservations.js'

// Morceaux communs aux formulaires d'hébergement et de trajet.

const CURRENCY_KEY = 'trip:lastCurrency'

/** La dernière devise saisie : on réserve souvent plusieurs fois dans le même pays. */
export function lastCurrency() {
  try {
    return localStorage.getItem(CURRENCY_KEY) || 'EUR'
  } catch {
    return 'EUR'
  }
}

export function rememberCurrency(currency) {
  try {
    if (currency) localStorage.setItem(CURRENCY_KEY, currency)
  } catch {
    // Navigation privée : on reprendra l'euro, sans plus.
  }
}

/** Un champ rempli par la lecture d'une capture : surligné, à relire. */
export const FILLED = 'ring-2 ring-accent/50 bg-accent/5'

export function PriceField({ price, currency, onChange, highlight = false }) {
  return (
    <Field label="Prix" optional>
      <div className="flex gap-2">
        <Input
          inputMode="decimal"
          value={price}
          onChange={(e) => onChange({ price: e.target.value, currency })}
          placeholder="0"
          className={cn('flex-1 min-w-0 tabular', highlight && FILLED)}
        />
        <select
          value={currency}
          onChange={(e) => onChange({ price, currency: e.target.value })}
          className="h-11 px-3 rounded-xl bg-surface-2 border border-border text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Devise"
        >
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </Field>
  )
}

/** Une date et une heure facultative, côte à côte. */
export function DateTimeField({ label, date, time, onChange, min, timeOptional = true, highlight = false }) {
  return (
    <Field label={label}>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
        <Input type="date" value={date} min={min || undefined} onChange={(e) => onChange({ date: e.target.value, time })} className={cn(highlight && FILLED)} />
        <Input
          type="time"
          value={time}
          className={cn(highlight && FILLED)}
          onChange={(e) => onChange({ date, time: e.target.value })}
          aria-label={timeOptional ? `${label} — heure (facultative)` : `${label} — heure`}
        />
      </div>
    </Field>
  )
}

/** Choix parmi quelques options avec icône (type d'hébergement, mode de transport). */
export function ChoiceChips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const Icon = o.icon
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-sm transition',
              active ? 'border-accent bg-accent/10 text-accent font-medium' : 'border-border text-muted hover:text-fg hover:border-border-strong',
            )}
          >
            <Icon size={15} />
            {o.short || o.label}
          </button>
        )
      })}
    </div>
  )
}

export function FormSection({ title, children }) {
  return (
    <section className="space-y-3">
      {title && <h3 className="text-[13px] font-semibold text-muted">{title}</h3>}
      {children}
    </section>
  )
}

/**
 * « Plus d'options » : ce qu'on ne remplit pas à chaque fois (téléphone,
 * prix, lien du mail, notes), replié sous un résumé de ce qui est déjà saisi.
 */
export function Disclosure({ label = 'Plus d’options', summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-border pt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full h-11 flex items-center justify-between gap-3 text-left"
      >
        <span className="text-[15px] text-fg">{label}</span>
        <span className="min-w-0 inline-flex items-center gap-1.5 text-[13px] text-muted">
          {!open && <span className="truncate">{summary}</span>}
          <ChevronDown size={16} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && <div className="space-y-4 pt-2">{children}</div>}
    </div>
  )
}
