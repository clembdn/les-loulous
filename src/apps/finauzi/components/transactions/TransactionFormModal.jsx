import { useState, useEffect, useMemo } from 'react'
import { ArrowRight, Info } from 'lucide-react'
import { createTransaction, updateTransaction, deleteTransaction } from '../../services/transactionService.js'
import { AUTHORIZED_UIDS, getPerson } from '@/shared/config/people.js'
import { useAppData } from '../../context/AppDataContext.jsx'
import { useCurrency } from '../../context/CurrencyContext.jsx'
import { getCategoriesByType, getDefaultCategoryId, getCategory } from '../../config/categories.js'
import {
  ACCOUNTS, JOINT_ACCOUNT_ID, SPLIT_COMMON,
  getAccount, getAccountCurrency, getDefaultSplit, getPersonalAccountId,
} from '../../config/accounts.js'
import { RECURRENCES } from '../../utils/recurrence.js'
import { SETTLES_DEBT, SETTLES_CONTRIBUTION } from '../../utils/ledger.js'
import { convert } from '../../utils/money.js'
import Modal from '@/shared/ui/Modal.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { DatePicker } from '@/shared/ui/date-picker.jsx'
import { todayISO } from '../../utils/dates.js'


const KINDS = [
  { id: 'expense', label: 'Dépense', activeClass: 'bg-red-500/15 text-red-400' },
  { id: 'income', label: 'Revenu', activeClass: 'bg-emerald-500/15 text-emerald-400' },
  { id: 'transfer', label: 'Virement', activeClass: 'bg-sky-500/15 text-sky-400' },
]

const CURRENCY_SYMBOL = { EUR: '€', AUD: 'A$' }

// Un virement entre les deux comptes persos peut vouloir dire trois choses,
// et se tromper de case fausse un compteur entier.
const SETTLES_OPTIONS = [
  {
    id: null,
    label: 'Rien',
    activeClass: 'bg-white/10 text-white',
    hint: 'Un simple mouvement d\'argent, sans effet sur les compteurs.',
  },
  {
    id: SETTLES_DEBT,
    label: 'Une dette',
    activeClass: 'bg-teal-500/15 text-teal-400',
    hint: 'Remet à zéro ce que l\'un doit à l\'autre (dépenses avancées, perso payé sur le joint).',
  },
  {
    id: SETTLES_CONTRIBUTION,
    label: 'Des apports',
    activeClass: 'bg-sky-500/15 text-sky-400',
    hint: 'Rattrape un retard de versements au pot sans virer à l\'étranger : l\'écart se referme de deux fois le montant.',
  },
]

export default function TransactionFormModal({ onClose, currentUid, existing }) {
  const { settings } = useAppData()
  const { rate } = useCurrency()
  const userColors = settings.userColors
  const isEdit = !!existing

  // Mon compte perso — la source naturelle d'un virement vers le pot.
  const myAccountId = getPersonalAccountId(currentUid) || JOINT_ACCOUNT_ID

  const [kind, setKind] = useState(existing?.kind || 'expense')
  const [fromAccount, setFromAccount] = useState(existing?.fromAccount || JOINT_ACCOUNT_ID)
  const [toAccount, setToAccount] = useState(existing?.toAccount || JOINT_ACCOUNT_ID)
  const [split, setSplit] = useState(existing?.split || SPLIT_COMMON)
  const [title, setTitle] = useState(existing?.title || '')
  const [amount, setAmount] = useState(existing?.amount != null ? String(existing.amount) : '')
  const [amountReceived, setAmountReceived] = useState(
    existing?.amountReceived != null ? String(existing.amountReceived) : '',
  )
  // Ce que ce virement solde : rien, une dette, ou un retard d'apports.
  const [settles, setSettles] = useState(existing?.settles ?? null)
  const [recurrence, setRecurrence] = useState(existing?.recurrence || 'one-off')
  const [date, setDate] = useState(existing?.date ? existing.date.slice(0, 10) : todayISO())
  const [endDate, setEndDate] = useState(existing?.endDate ? existing.endDate.slice(0, 10) : '')
  const [categoryId, setCategoryId] = useState(
    existing?.category || getDefaultCategoryId(existing?.kind || 'expense'),
  )
  const [notes, setNotes] = useState(existing?.notes || '')

  // Le compte qui porte le montant saisi : la source pour une dépense ou un
  // virement, la destination pour un revenu.
  const sourceAccountId = kind === 'income' ? toAccount : fromAccount
  const sourceCurrency = getAccountCurrency(sourceAccountId)
  const destCurrency = getAccountCurrency(toAccount)
  const isCrossCurrency = kind === 'transfer' && sourceCurrency !== destCurrency
  const isBetweenPersonals = getAccount(fromAccount).kind === 'personal'
    && getAccount(toAccount).kind === 'personal'

  // Passer en mode virement pré-remplit le cas courant : mon perso → le pot.
  useEffect(() => {
    if (isEdit || kind !== 'transfer') return
    setFromAccount(myAccountId)
    setToAccount(JOINT_ACCOUNT_ID)
  }, [kind, isEdit, myAccountId])

  // Un virement doit partir et arriver sur deux comptes différents.
  useEffect(() => {
    if (kind === 'transfer' && fromAccount === toAccount) {
      const fallback = ACCOUNTS.find((a) => a.id !== fromAccount)
      if (fallback) setToAccount(fallback.id)
    }
  }, [kind, fromAccount, toAccount])

  // La catégorie suit toujours la nature du mouvement.
  useEffect(() => {
    if (getCategory(categoryId).type !== kind) setCategoryId(getDefaultCategoryId(kind))
  }, [kind, categoryId])

  // Le défaut de répartition suit le compte : ce qui sort du joint est
  // commun, ce qui sort d'un perso est perso. Modifiable ensuite.
  useEffect(() => {
    if (isEdit) return
    setSplit(getDefaultSplit(sourceAccountId))
  }, [sourceAccountId, isEdit])

  // Hors virement, il n'y a rien à solder.
  useEffect(() => {
    if (kind !== 'transfer') setSettles(null)
  }, [kind])

  useEffect(() => {
    if (isEdit || kind !== 'transfer') return
    // Un virement entre persos solde presque toujours quelque chose, et la
    // dette est le cas le plus courant — le rééquilibrage se choisit juste à
    // côté. Dès qu'un bout n'est plus un compte perso, « des apports » n'a
    // plus de sens : on le retire plutôt que de laisser un choix impossible.
    if (isBetweenPersonals) setSettles((prev) => prev ?? SETTLES_DEBT)
    else setSettles((prev) => (prev === SETTLES_CONTRIBUTION ? null : prev))
  }, [kind, isBetweenPersonals, isEdit])

  const parsedAmount = useMemo(() => {
    const raw = parseFloat(String(amount).replace(',', '.'))
    return isFinite(raw) ? raw : null
  }, [amount])

  const parsedReceived = useMemo(() => {
    const raw = parseFloat(String(amountReceived).replace(',', '.'))
    return isFinite(raw) ? raw : null
  }, [amountReceived])

  // Estimation du montant crédité tant que l'utilisateur n'a pas saisi le
  // vrai chiffre relevé sur le compte d'arrivée.
  const estimatedReceived = useMemo(() => {
    if (!isCrossCurrency || parsedAmount == null) return null
    return convert(parsedAmount, sourceCurrency, destCurrency, rate)
  }, [isCrossCurrency, parsedAmount, sourceCurrency, destCurrency, rate])

  const categoriesForKind = getCategoriesByType(kind)

  function onSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return toast.error('Donne un titre')
    if (parsedAmount == null || parsedAmount <= 0) return toast.error('Montant invalide')
    if (kind === 'transfer' && fromAccount === toAccount) {
      return toast.error('Choisis deux comptes différents')
    }

    const payload = {
      kind,
      title: title.trim(),
      amount: parsedAmount,
      amountReceived: isCrossCurrency ? (parsedReceived ?? estimatedReceived) : null,
      fromAccount: kind === 'income' ? null : fromAccount,
      toAccount: kind === 'expense' ? null : toAccount,
      split,
      settles,
      recurrence,
      date,
      endDate: recurrence !== 'one-off' && endDate ? endDate : null,
      category: categoryId,
      notes: notes.trim() || null,
      isActive: existing?.isActive !== false,
    }

    // Écritures optimistes : le cache local Firestore rafraîchit l'UI tout de
    // suite, et hors-ligne un `await` ne se résoudrait qu'au retour du réseau.
    if (isEdit) {
      updateTransaction(existing.id, payload, currentUid)
        .catch((err) => { console.error(err); toast.error(err.message || 'Erreur de synchronisation') })
      toast.success('Transaction mise à jour')
    } else {
      createTransaction(payload, currentUid)
        .catch((err) => { console.error(err); toast.error(err.message || 'Erreur de synchronisation') })
      toast.success(kind === 'transfer' ? 'Virement enregistré' : 'Transaction ajoutée')
    }
    onClose()
  }

  function onDelete() {
    if (!existing?.id) return
    if (!confirm('Supprimer cette transaction ?')) return
    deleteTransaction(existing.id)
      .catch((err) => toast.error(err.message || 'Suppression impossible'))
    toast.success('Transaction supprimée')
    onClose()
  }

  const modalTitle = isEdit
    ? 'Modifier'
    : { expense: 'Nouvelle dépense', income: 'Nouveau revenu', transfer: 'Nouveau virement' }[kind]

  return (
    <Modal open onClose={onClose} title={modalTitle}>
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Nature du mouvement */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-white/[0.04] rounded-xl">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={`py-2 rounded-lg text-sm font-medium transition ${
                kind === k.id ? k.activeClass : 'text-white/40 hover:text-white/70'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {/* Comptes */}
        {kind === 'transfer' ? (
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <Field label="Depuis">
              <AccountSelect value={fromAccount} onChange={setFromAccount} />
            </Field>
            <div className="pb-3 text-white/25">
              <ArrowRight size={16} />
            </div>
            <Field label="Vers">
              <AccountSelect value={toAccount} onChange={setToAccount} exclude={fromAccount} />
            </Field>
          </div>
        ) : (
          <Field label={kind === 'income' ? 'Sur quel compte' : 'Payé avec'}>
            <AccountPicker
              value={kind === 'income' ? toAccount : fromAccount}
              onChange={kind === 'income' ? setToAccount : setFromAccount}
            />
          </Field>
        )}

        <Field label="Titre">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              kind === 'income' ? 'Ex: Salaire, Aide…'
                : kind === 'transfer' ? 'Ex: Apport compte joint'
                  : 'Ex: Loyer, Courses…'
            }
            className={inputClass}
            autoFocus
          />
        </Field>

        {/* Montant — la devise découle du compte, elle ne se choisit pas. */}
        <Field label={`Montant en ${sourceCurrency}`}>
          <div className="relative">
            <span className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-base font-semibold text-white/50 border-r border-white/10 pointer-events-none">
              {CURRENCY_SYMBOL[sourceCurrency]}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className={`${inputClass} pl-14 text-lg tabular`}
            />
          </div>
          <p className="text-[11px] text-white/35 mt-1.5">
            Devise du compte {getAccount(sourceAccountId).label.toLowerCase()}
            {sourceCurrency === 'EUR' && parsedAmount > 0 && (
              <> · ≈ {convert(parsedAmount, 'EUR', 'AUD', rate).toFixed(0)} A$</>
            )}
            {sourceCurrency === 'AUD' && parsedAmount > 0 && (
              <> · ≈ {convert(parsedAmount, 'AUD', 'EUR', rate).toFixed(0)} €</>
            )}
          </p>
        </Field>

        {/* Montant réellement crédité — capte le vrai taux et les frais. */}
        {isCrossCurrency && (
          <Field label={`Reçu en ${destCurrency} (optionnel)`}>
            <div className="relative">
              <span className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-base font-semibold text-white/50 border-r border-white/10 pointer-events-none">
                {CURRENCY_SYMBOL[destCurrency]}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder={estimatedReceived != null ? estimatedReceived.toFixed(2).replace('.', ',') : '0,00'}
                className={`${inputClass} pl-14 text-lg tabular`}
              />
            </div>
            <p className="text-[11px] text-white/35 mt-1.5 flex items-start gap-1.5">
              <Info size={12} className="mt-0.5 flex-shrink-0" />
              Le montant réellement crédité, frais de change inclus. Laissé vide,
              on estime au taux 1 € = {rate} A$.
            </p>
          </Field>
        )}

        {/* Répartition — le cœur du système de remboursement. */}
        {kind !== 'transfer' && (
          <Field label={kind === 'income' ? 'Revenu de' : 'À la charge de'}>
            <div className="grid grid-cols-3 gap-1 p-1 bg-white/[0.04] rounded-xl">
              <SplitButton
                active={split === SPLIT_COMMON}
                onClick={() => setSplit(SPLIT_COMMON)}
                label="Commun"
                activeClass="bg-sky-500/15 text-sky-400"
              />
              {AUTHORIZED_UIDS.map((uid) => {
                const p = getPerson(uid, userColors)
                return (
                  <SplitButton
                    key={uid}
                    active={split === uid}
                    onClick={() => setSplit(uid)}
                    label={p.label}
                    dotClass={p.dotClass}
                    activeClass={`${p.bgClass} ${p.textClass}`}
                  />
                )
              })}
            </div>
            <p className="text-[11px] text-white/35 mt-1.5">
              {getSplitHint(kind, sourceAccountId, split)}
            </p>
          </Field>
        )}

        {/* Ce que ce virement solde. Entre deux comptes persos il y a trois
            réponses possibles, et elles ne tombent pas dans le même compteur :
            un rééquilibrage d'apports n'est PAS une dette. */}
        {kind === 'transfer' && isBetweenPersonals && (
          <Field label="Ce virement solde">
            <div className="grid grid-cols-3 gap-1.5">
              {SETTLES_OPTIONS.map((option) => {
                const active = settles === option.id
                return (
                  <button
                    key={option.id || 'none'}
                    type="button"
                    onClick={() => setSettles(option.id)}
                    className={`px-2 py-2.5 rounded-xl text-[11px] font-medium transition border ${
                      active
                        ? `${option.activeClass} border-white/20`
                        : 'bg-white/[0.03] text-white/50 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-white/40 mt-1.5 leading-relaxed">
              {SETTLES_OPTIONS.find((o) => o.id === settles)?.hint}
            </p>
          </Field>
        )}

        {kind === 'transfer' && !isBetweenPersonals && (
          <label className="flex items-start gap-3 px-3 py-3 bg-white/[0.03] border border-white/10 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={settles === SETTLES_DEBT}
              onChange={(e) => setSettles(e.target.checked ? SETTLES_DEBT : null)}
              className="mt-0.5 h-4 w-4 accent-sky-400"
            />
            <span className="min-w-0">
              <span className="block text-sm text-white">C'est un remboursement</span>
              <span className="block text-[11px] text-white/40 mt-0.5">
                {settles === SETTLES_DEBT
                  ? 'Ce virement solde une dette et ne compte pas comme un apport au pot.'
                  : 'Un virement vers le joint compte comme un apport et rééquilibre les versements.'}
              </span>
            </span>
          </label>
        )}

        <Field label="Catégorie">
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
            {categoriesForKind.map((cat) => {
              const Icon = cat.icon
              const active = categoryId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={`flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-xl text-[10px] font-medium transition border ${
                    active
                      ? `${cat.bgClass} ${cat.textClass} ${cat.borderClass}`
                      : 'border-transparent text-white/40 hover:bg-white/[0.03]'
                  }`}
                  title={cat.label}
                >
                  <Icon size={16} strokeWidth={2} />
                  <span className="leading-tight truncate w-full text-center">{cat.label}</span>
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Fréquence">
          <div className="grid grid-cols-4 gap-1 p-1 bg-white/[0.04] rounded-xl">
            {RECURRENCES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRecurrence(r.id)}
                className={`py-2 rounded-lg text-[11px] font-medium transition ${
                  recurrence === r.id ? 'bg-white text-black' : 'text-white/50'
                }`}
              >
                {r.short}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={recurrence === 'one-off' ? 'Date' : 'Début'}>
            <DatePicker value={date} onChange={setDate} />
          </Field>
          {recurrence !== 'one-off' && (
            <Field label="Fin (optionnel)">
              <DatePicker value={endDate} onChange={setEndDate} placeholder="Sans fin" clearable />
            </Field>
          )}
        </div>

        <Field label="Notes (optionnel)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>

        <div className="flex gap-2 pt-2">
          {isEdit && (
            <button
              type="button"
              onClick={onDelete}
              className="px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 text-sm font-medium transition"
            >
              Supprimer
            </button>
          )}
          <button
            type="submit"
            className="flex-1 py-3 rounded-xl bg-white text-black font-medium text-sm hover:bg-white/90 transition"
          >
            {isEdit ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Explique la conséquence du choix de répartition, en clair, au moment
// où on le fait — c'est là que se joue la compréhension du système.
function getSplitHint(kind, accountId, split) {
  const account = getAccount(accountId)
  const isJoint = account.id === JOINT_ACCOUNT_ID

  if (kind === 'income') {
    if (isJoint) {
      return split === SPLIT_COMMON
        ? 'Revenu du pot commun, il profite aux deux.'
        : 'Compté comme un apport au pot pour cette personne.'
    }
    return split === SPLIT_COMMON
      ? 'Revenu commun encaissé sur un compte perso : la moitié est due à l\'autre.'
      : 'Revenu personnel, aucune dette générée.'
  }

  if (isJoint) {
    return split === SPLIT_COMMON
      ? 'Dépense commune payée par le pot : rien à rembourser.'
      : 'Dépense perso payée par le pot : la moitié sera à rembourser.'
  }
  return split === SPLIT_COMMON
    ? 'Dépense commune avancée depuis un compte perso : l\'autre en doit la moitié.'
    : 'Dépense personnelle, aucune dette générée.'
}

function SplitButton({ active, onClick, label, dotClass, activeClass }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
        active ? activeClass : 'text-white/40 hover:text-white/70'
      }`}
    >
      {dotClass && <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />}
      {label}
    </button>
  )
}

// Sélecteur de compte en cartes — assez large pour être tapé au pouce.
function AccountPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {ACCOUNTS.map((account) => {
        const Icon = account.icon
        const active = value === account.id
        return (
          <button
            key={account.id}
            type="button"
            onClick={() => onChange(account.id)}
            className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border transition ${
              active
                ? `${account.bgClass} ${account.textClass} ${account.borderClass}`
                : 'border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/[0.04]'
            }`}
          >
            <Icon size={16} strokeWidth={2.2} />
            <span className="text-[11px] font-medium leading-tight text-center">{account.short}</span>
            <span className="text-[9px] uppercase tracking-wider opacity-60">{account.currency}</span>
          </button>
        )
      })}
    </div>
  )
}

// Version compacte, pour les deux colonnes d'un virement.
function AccountSelect({ value, onChange, exclude }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} appearance-none cursor-pointer`}
    >
      {ACCOUNTS.filter((a) => a.id !== exclude).map((account) => (
        <option key={account.id} value={account.id} className="bg-neutral-900">
          {account.short} · {account.currency}
        </option>
      ))}
    </select>
  )
}

const inputClass = 'w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition'

function Field({ label, children }) {
  return (
    <div>
      <span className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">{label}</span>
      {children}
    </div>
  )
}
