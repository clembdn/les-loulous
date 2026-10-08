import { useEffect, useMemo, useState } from 'react'
import { Link2, Loader2 } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { AUTHORIZED_UIDS, getPersonLabel } from '@/shared/config/people.js'
import { cn } from '@/shared/lib/utils.js'
import { formatDayFr } from '@/shared/lib/dates.js'
import { ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import {
  getAccount, getAccountCurrency, getOrderedAccounts, JOINT_ACCOUNT_ID, SPLIT_COMMON,
} from '@/apps/finauzi/config/accounts.js'
import { todayISO } from '@/apps/finauzi/utils/dates.js'
import Field from '../Field.jsx'
import { useTripData } from '../../context/TripDataContext.jsx'
import { getTransportMode } from '../../config/reservations.js'
import { findTransactionsBetween, linkExpense, sendExpense, updateSentExpense } from '../../services/expenseService.js'
import { formatPrice } from '../../utils/format.js'
import {
  expenseDefaults, expenseTitle, FINAUZI_CURRENCIES, linkWindow, rankCandidates,
} from '../../utils/expense.js'

const chip = (active) => cn(
  'h-10 px-3.5 rounded-full border text-[14px] inline-flex items-center gap-1.5 transition',
  active ? 'bg-fg border-fg text-bg font-medium' : 'border-border text-fg hover:border-border-strong',
)

function initialForm(kind, item, tx, tripTitle) {
  const defaults = expenseDefaults(item)
  if (tx) {
    // Mise à jour : la dépense telle qu'elle est, au nouveau prix s'il se lit en € ou A$.
    return {
      amount: String(defaults.amount ?? tx.amount),
      currency: defaults.currency || tx.currency,
      fromAccount: tx.fromAccount || JOINT_ACCOUNT_ID,
      split: tx.split || SPLIT_COMMON,
      date: tx.date || todayISO(),
      title: tx.title,
    }
  }
  return {
    amount: defaults.amount != null ? String(defaults.amount) : '',
    currency: defaults.currency || getAccountCurrency(JOINT_ACCOUNT_ID),
    fromAccount: JOINT_ACCOUNT_ID,
    split: SPLIT_COMMON,
    date: todayISO(),
    title: expenseTitle(kind, item, tripTitle, kind === 'transport' ? getTransportMode(item.mode).label : ''),
  }
}

/**
 * Le prix d'une réservation vers FinAuzi : une dépense « Voyage », payée avec
 * l'un des trois comptes, pour le couple (50/50) ou l'un des deux, datée du
 * jour du paiement.
 *
 * Deux façons : la créer, ou la rattacher à une dépense que FinAuzi connaît
 * déjà (une ligne de relevé importée) — sinon le même paiement compterait
 * deux fois. Avec `tx` : mettre à jour la dépense déjà envoyée.
 */
export default function ExpenseSheet({ open, kind, item, tx = null, onClose }) {
  const { currentUid } = useAuth()
  const { trip, tripId, stays, transports } = useTripData()
  const [form, setForm] = useState(() => initialForm(kind, item, tx, trip.title))
  const [tab, setTab] = useState('create')
  const [error, setError] = useState(null)
  const defaults = expenseDefaults(item)
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(null) }
  const amount = Number(String(form.amount).replace(',', '.'))

  function chooseAccount(fromAccount) {
    // Sans devise imposée par la réservation, celle du compte qui paie.
    set(defaults.currency ? { fromAccount } : { fromAccount, currency: getAccountCurrency(fromAccount) })
  }

  function submit(e) {
    e.preventDefault()
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(defaults.charged ? 'Saisissez le montant débité, en euros ou en dollars australiens.' : 'Saisissez le montant payé.')
      return
    }
    const expense = { ...form, amount: Math.round(amount * 100) / 100, title: form.title.trim() || expenseTitle(kind, item, trip.title) }
    if (tx) {
      updateSentExpense(kind, tripId, item, tx, expense, currentUid).catch(() => toast.error('Mise à jour impossible'))
      toast.success('Dépense mise à jour dans FinAuzi')
    } else {
      sendExpense(kind, tripId, item, expense, currentUid).done.catch(() => toast.error('Envoi impossible'))
      toast.success(`${formatPrice(expense.amount, expense.currency)} ajouté à FinAuzi`)
    }
    onClose()
  }

  function link(candidate) {
    linkExpense(kind, tripId, item, candidate, currentUid).catch(() => toast.error('Rattachement impossible'))
    toast.success('Rattachée à la dépense de FinAuzi')
    onClose()
  }

  return (
    <ThemedSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title={tx ? 'Mettre à jour la dépense' : 'Envoyer à FinAuzi'}
      description={item.price != null ? `Prix de la réservation : ${formatPrice(item.price, item.currency)}` : 'Pas de prix sur la réservation'}
      footer={tab === 'create' ? (
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="expense-form" className="flex-1">{tx ? 'Mettre à jour' : 'Ajouter la dépense'}</Button>
        </div>
      ) : null}
    >
      {!tx && (
        <div className="mb-5 grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-2">
          {[['create', 'Créer la dépense'], ['link', 'Déjà dans FinAuzi']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={cn('h-10 rounded-lg text-[14px] font-medium transition', tab === id ? 'bg-surface text-fg shadow-sm' : 'text-muted')}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'link' ? (
        <LinkPanel date={form.date} onDate={(date) => set({ date })} amount={Number.isFinite(amount) ? amount : null} currency={form.currency} stays={stays} transports={transports} onLink={link} />
      ) : (
        <form id="expense-form" onSubmit={submit} className="space-y-5" noValidate>
          <Field label={defaults.charged ? 'Montant débité' : 'Montant'}>
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => set({ amount: e.target.value })}
                placeholder="0,00"
                className="flex-1 text-[17px] font-semibold tabular"
                autoFocus={!form.amount}
              />
              <div className="flex gap-1">
                {FINAUZI_CURRENCIES.map((c) => (
                  <button key={c} type="button" onClick={() => set({ currency: c })} aria-pressed={form.currency === c} className={chip(form.currency === c)}>
                    {c === 'EUR' ? '€' : 'A$'}
                  </button>
                ))}
              </div>
            </div>
            {defaults.charged && (
              <p className="mt-1.5 text-[13px] text-muted">
                FinAuzi compte en euros et en dollars australiens : le montant que la banque a débité.
              </p>
            )}
          </Field>

          <div>
            <p className="text-[13px] font-medium text-muted mb-1.5">Payé avec</p>
            <div className="flex flex-wrap gap-1.5">
              {getOrderedAccounts(currentUid).map((a) => (
                <button key={a.id} type="button" onClick={() => chooseAccount(a.id)} aria-pressed={form.fromAccount === a.id} className={chip(form.fromAccount === a.id)}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.hex }} /> {a.short}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-muted mb-1.5">Pour</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => set({ split: SPLIT_COMMON })} aria-pressed={form.split === SPLIT_COMMON} className={chip(form.split === SPLIT_COMMON)}>
                Tous les deux (50/50)
              </button>
              {AUTHORIZED_UIDS.map((uid) => (
                <button key={uid} type="button" onClick={() => set({ split: uid })} aria-pressed={form.split === uid} className={chip(form.split === uid)}>
                  {getPersonLabel(uid)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Field label="Payé le">
              <Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value || todayISO() })} className="text-[15px]" />
            </Field>
            <Field label="Libellé">
              <Input value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} className="text-[15px]" />
            </Field>
          </div>
          <p className="-mt-2 text-[13px] text-muted">Catégorie « Voyage » dans FinAuzi.</p>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </form>
      )}
    </ThemedSheet>
  )
}

/**
 * Les dépenses de FinAuzi autour de la date du paiement : on touche celle
 * qui correspond au paiement de la réservation (une ligne de relevé importée).
 */
function LinkPanel({ date, onDate, amount, currency, stays, transports, onLink }) {
  const [txs, setTxs] = useState(null)
  const range = useMemo(() => linkWindow(date), [date])
  const taken = useMemo(
    () => new Set([...stays, ...transports].map((r) => r.expense?.txId).filter(Boolean)),
    [stays, transports],
  )

  useEffect(() => {
    let alive = true
    setTxs(null)
    findTransactionsBetween(range.from, range.to)
      .then((list) => { if (alive) setTxs(list) })
      .catch(() => { if (alive) setTxs([]) })
    return () => { alive = false }
  }, [range])

  const ranked = txs ? rankCandidates(txs, { amount, currency, date }, taken) : []

  return (
    <div>
      <Field label="Payé vers le">
        <Input type="date" value={date} onChange={(e) => onDate(e.target.value || todayISO())} className="text-[15px]" />
      </Field>
      <p className="mt-1.5 text-[13px] text-muted">Les dépenses de FinAuzi à dix jours près, les plus probables d’abord.</p>
      {!txs ? (
        <p className="py-8 flex justify-center text-muted"><Loader2 className="animate-spin" /></p>
      ) : ranked.length === 0 ? (
        <p className="py-6 text-[15px] text-muted text-center">Aucune dépense ponctuelle à ces dates.</p>
      ) : (
        <ul className="mt-3 -mx-2 space-y-0.5">
          {ranked.map(({ tx, match }) => {
            const account = getAccount(tx.fromAccount)
            return (
              <li key={tx.id}>
                <button type="button" onClick={() => onLink(tx)} className="w-full min-h-14 flex items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2 transition">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: account.hex }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-fg truncate">{tx.title || 'Sans libellé'}</span>
                    <span className="block text-[13px] text-muted first-letter:uppercase">{formatDayFr(tx.date)} · {account.short}</span>
                  </span>
                  <span className={cn('shrink-0 text-[15px] tabular', match ? 'font-semibold text-accent' : 'text-fg')}>
                    {formatPrice(tx.amount, tx.currency)}
                  </span>
                  <Link2 size={16} className="shrink-0 text-muted" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
