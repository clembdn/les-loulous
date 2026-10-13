import { useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { Input } from '@/shared/ui/Input.jsx'
import Field from '../Field.jsx'
import { CURRENCIES } from '../../config/reservations.js'
import { formatPrice } from '../../utils/format.js'
import { amountLeft, payerLabel, PAYMENT_STATUSES } from '../../utils/payment.js'
import EurHint from '../EurHint.jsx'
import { useEurRates } from '../../hooks/useEurRates.js'
import { showsEur } from '../../utils/fx.js'

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

/**
 * Choix parmi quelques options, avec icône ou non (type d'hébergement, mode
 * de transport, payeur). `clearable` : retaper l'option choisie la retire.
 */
export function ChoiceChips({ options, value, onChange, clearable = false, children = null }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const Icon = o.icon
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(clearable && active ? null : o.id)}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-sm transition',
              active ? 'border-accent bg-accent/10 text-accent font-medium' : 'border-border text-muted hover:text-fg hover:border-border-strong',
            )}
          >
            {Icon && <Icon size={15} />}
            {o.short || o.label}
          </button>
        )
      })}
      {children}
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

/** Les champs de paiement du formulaire, tels qu'on les édite (chaînes). */
export function paymentForm(item) {
  return {
    paidBy: item?.paidBy || null,
    paymentStatus: item?.paymentStatus || null,
    deposit: item?.deposit != null ? String(item.deposit).replace('.', ',') : '',
    dueDate: item?.dueDate || '',
  }
}

/** « 23 200 F · acompte · Laure » : le résumé du bloc replié. */
export function paymentSummaryText(form) {
  const price = Number(String(form.price).replace(',', '.'))
  return [
    form.price && Number.isFinite(price) && formatPrice(price, form.currency),
    PAYMENT_STATUSES.find((s) => s.id === form.paymentStatus)?.label.replace('…', '').toLowerCase(),
    payerLabel(form.paidBy),
  ].filter(Boolean).join(' · ')
}

/**
 * Le prix, qui paie, et où en est le paiement. L'acompte se saisit dans la
 * devise du prix ; l'échéance n'apparaît qu'avec « À payer avant… ».
 */
export function PaymentFields({ form, payers, onChange, onAddPayer = null, highlightPrice = false }) {
  const rates = useEurRates()
  const [adding, setAdding] = useState(false)
  const [newPayer, setNewPayer] = useState('')
  const price = Number(String(form.price).replace(',', '.'))
  const deposit = Number(String(form.deposit).replace(',', '.'))
  const left = form.paymentStatus === 'deposit' && form.price && form.deposit && Number.isFinite(price) && Number.isFinite(deposit)
    ? amountLeft({ price, deposit, paymentStatus: 'deposit' })
    : null
  function addPayer() {
    const name = newPayer.trim()
    if (!name) return setAdding(false)
    const known = payers.find((p) => p.label.toLowerCase() === name.toLowerCase())
    if (known) {
      onChange({ paidBy: known.id })
    } else {
      // Le voyage le garde : il sera proposé dans les autres réservations.
      onAddPayer(name)
      onChange({ paidBy: name })
    }
    setNewPayer('')
    setAdding(false)
  }

  return (
    <>
      <PriceField price={form.price} currency={form.currency} onChange={onChange} highlight={highlightPrice} />
      {form.price && Number.isFinite(price) && showsEur(form.currency, rates) && (
        <p className="-mt-2 text-[13px] text-muted"><EurHint amount={price} currency={form.currency} /> au taux du jour</p>
      )}
      <ChipGroup label="Qui paie">
        <ChoiceChips options={payers} value={form.paidBy} onChange={(paidBy) => onChange({ paidBy })} clearable>
          {onAddPayer && !adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-full border border-dashed border-border-strong text-sm text-muted hover:text-fg transition"
            >
              <Plus size={14} /> Autre
            </button>
          )}
        </ChoiceChips>
        {adding && (
          <div className="mt-2 flex gap-2">
            <Input
              value={newPayer}
              onChange={(e) => setNewPayer(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPayer() } }}
              placeholder="Prénom (ajouté au voyage)"
              maxLength={40}
              autoFocus
              className="flex-1 min-w-0"
            />
            <button type="button" onClick={addPayer} className="h-11 px-4 rounded-xl bg-accent text-accent-fg text-sm font-semibold">
              Ajouter
            </button>
          </div>
        )}
      </ChipGroup>
      <ChipGroup label="État">
        <ChoiceChips options={PAYMENT_STATUSES} value={form.paymentStatus} onChange={(paymentStatus) => onChange({ paymentStatus })} clearable />
      </ChipGroup>
      {form.paymentStatus === 'deposit' && (
        <Field label={`Acompte versé (${form.currency})`} hint={left != null ? `Reste ${formatPrice(left, form.currency)} à payer sur place.` : 'Le reste se paie sur place.'}>
          <Input inputMode="decimal" value={form.deposit} onChange={(e) => onChange({ deposit: e.target.value })} placeholder="0" className="tabular" />
        </Field>
      )}
      {form.paymentStatus === 'due' && (
        <Field label="À payer avant le">
          <Input type="date" value={form.dueDate} onChange={(e) => onChange({ dueDate: e.target.value })} />
        </Field>
      )}
    </>
  )
}

// Comme Field, mais pas un <label> : toucher le libellé ne doit pas choisir la
// première pastille.
function ChipGroup({ label, children }) {
  return (
    <div role="group" aria-label={label}>
      <span className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="text-[12px] text-muted">facultatif</span>
      </span>
      {children}
    </div>
  )
}
