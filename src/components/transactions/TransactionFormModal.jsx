import { useState, useEffect } from 'react'
import { Users, User } from 'lucide-react'
import { createTransaction, updateTransaction, deleteTransaction } from '../../services/transactionService.js'
import { AUTHORIZED_UIDS, getPerson, CLEMENT_UID } from '../../config/people.js'
import { getCategoriesByType, getDefaultCategoryId, getCategory } from '../../config/categories.js'
import Modal from '../ui/Modal.jsx'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const RECURRENCES = [
  { id: 'one-off', label: 'Ponctuelle' },
  { id: 'monthly', label: 'Mensuelle' },
  { id: 'weekly', label: 'Hebdo' },
]

export default function TransactionFormModal({ onClose, currentUid, existing }) {
  const isEdit = !!existing
  const [type, setType] = useState(existing?.type || 'expense')
  const [account, setAccount] = useState(existing?.account || 'common')
  const [title, setTitle] = useState(existing?.title || '')
  const [amount, setAmount] = useState(existing?.amountEUR != null ? String(existing.amountEUR) : '')
  const [recurrence, setRecurrence] = useState(existing?.recurrence || 'one-off')
  const [date, setDate] = useState(existing?.date ? existing.date.slice(0, 10) : todayISO())
  const [endDate, setEndDate] = useState(existing?.endDate ? existing.endDate.slice(0, 10) : '')
  const [personUid, setPersonUid] = useState(existing?.personUid || currentUid || CLEMENT_UID)
  const [categoryId, setCategoryId] = useState(existing?.category || getDefaultCategoryId(existing?.type || 'expense'))
  const [notes, setNotes] = useState(existing?.notes || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!AUTHORIZED_UIDS.includes(personUid)) {
      setPersonUid(currentUid && AUTHORIZED_UIDS.includes(currentUid) ? currentUid : CLEMENT_UID)
    }
  }, [personUid, currentUid])

  useEffect(() => {
    const cat = getCategory(categoryId)
    if (cat.type !== type) setCategoryId(getDefaultCategoryId(type))
  }, [type, categoryId])

  const categoriesForType = getCategoriesByType(type)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    const amt = parseFloat(amount.replace(',', '.'))
    if (!title.trim()) return setError('Donne un titre')
    if (!isFinite(amt) || amt <= 0) return setError('Montant invalide')
    setBusy(true)
    try {
      const payload = {
        title: title.trim(),
        amountEUR: amt,
        type,
        recurrence,
        date,
        endDate: recurrence !== 'one-off' && endDate ? endDate : null,
        personUid,
        category: categoryId,
        account,
        notes: notes.trim() || null,
        isActive: existing?.isActive !== false,
      }
      if (isEdit) {
        await updateTransaction(existing.id, payload, currentUid)
      } else {
        await createTransaction(payload, currentUid)
      }
      onClose()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Erreur, réessaie')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!existing?.id) return
    if (!confirm('Supprimer cette transaction ?')) return
    setBusy(true)
    try {
      await deleteTransaction(existing.id)
      onClose()
    } catch (err) {
      setError(err.message || 'Suppression impossible')
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Modifier' : 'Nouvelle transaction'}>
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-white/[0.04] rounded-xl">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`py-2 rounded-lg text-sm font-medium transition ${
              type === 'expense' ? 'bg-red-500/15 text-red-400' : 'text-white/40'
            }`}
          >
            Dépense
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`py-2 rounded-lg text-sm font-medium transition ${
              type === 'income' ? 'bg-emerald-500/15 text-emerald-400' : 'text-white/40'
            }`}
          >
            Revenu
          </button>
        </div>

        {/* Account toggle */}
        <Field label="Compte">
          <div className="grid grid-cols-2 gap-1 p-1 bg-white/[0.04] rounded-xl">
            <button
              type="button"
              onClick={() => setAccount('common')}
              className={`py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                account === 'common' ? 'bg-sky-500/15 text-sky-400' : 'text-white/40'
              }`}
            >
              <Users size={14} />
              Commun
            </button>
            <button
              type="button"
              onClick={() => setAccount('personal')}
              className={`py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                account === 'personal' ? 'bg-white/10 text-white' : 'text-white/40'
              }`}
            >
              <User size={14} />
              Personnel
            </button>
          </div>
        </Field>

        <Field label="Titre">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === 'income' ? 'Ex: Salaire, Prime…' : 'Ex: Loyer, Courses…'}
            className={inputClass}
            autoFocus
          />
        </Field>

        <Field label="Montant (EUR)">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className={`${inputClass} text-lg tabular`}
          />
        </Field>

        <Field label="Catégorie">
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
            {categoriesForType.map((cat) => {
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
          <div className="grid grid-cols-3 gap-1 p-1 bg-white/[0.04] rounded-xl">
            {RECURRENCES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRecurrence(r.id)}
                className={`py-2 rounded-lg text-xs font-medium transition ${
                  recurrence === r.id ? 'bg-white text-black' : 'text-white/50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={recurrence === 'one-off' ? 'Date' : 'Début'}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          {recurrence !== 'one-off' && (
            <Field label="Fin (optionnel)">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}
        </div>

        <Field label="Payé par">
          <div className="grid grid-cols-2 gap-1 p-1 bg-white/[0.04] rounded-xl">
            {AUTHORIZED_UIDS.map((uid) => {
              const p = getPerson(uid)
              const active = personUid === uid
              return (
                <button
                  key={uid}
                  type="button"
                  onClick={() => setPersonUid(uid)}
                  className={`py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                    active ? `${p.bgClass} ${p.textClass}` : 'text-white/40'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${p.dotClass}`} />
                  {p.label}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Notes (optionnel)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 pt-2">
          {isEdit && (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 text-sm font-medium transition disabled:opacity-50"
            >
              Supprimer
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex-1 py-3 rounded-xl bg-white text-black font-medium text-sm disabled:opacity-50 hover:bg-white/90 transition"
          >
            {busy ? '…' : isEdit ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const inputClass = 'w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">{label}</span>
      {children}
    </label>
  )
}
